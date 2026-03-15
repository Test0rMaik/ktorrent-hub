import { getDb }      from '../db/index.js';
import { config }     from '../config/index.js';
import { getSetting } from '../db/settings.js';
import { randomUUID } from 'crypto';
import { kleverMintKth } from './klever.js';

/**
 * Called every time a seeder announces to the tracker.
 * Updates the seeding session and accumulates seed time.
 */
export async function trackSeedingActivity({ infoHash, peerId }) {
  const db = getDb();

  const torrent = db.queryOne(
    `SELECT id FROM torrents WHERE info_hash = ? AND status = 'active'`,
    [infoHash],
  );
  if (!torrent) return;

  // peer_ids are stored as hex for safe JSON/DB handling
  const peerHex = Buffer.from(peerId, 'binary').toString('hex');

  // Check if this peer is registered to a user
  const peerLink = db.queryOne(
    `SELECT user_id FROM peer_registrations WHERE peer_id = ? AND info_hash = ?`,
    [peerHex, infoHash],
  );
  if (!peerLink) return; // anonymous peer — no reward

  const userId = peerLink.user_id;
  const now    = new Date().toISOString();

  let session = db.queryOne(
    `SELECT * FROM seeding_sessions
     WHERE user_id = ? AND info_hash = ? AND peer_id = ? AND ended_at IS NULL`,
    [userId, infoHash, peerHex],
  );

  if (!session) {
    db.run(
      `INSERT INTO seeding_sessions (id, user_id, torrent_id, info_hash, peer_id, started_at, last_announce)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), userId, torrent.id, infoHash, peerHex, now, now],
    );
    return;
  }

  const elapsed    = Math.floor((Date.now() - new Date(session.last_announce).getTime()) / 1000);
  const creditable = Math.min(elapsed, config.tracker.peerTtl * 2);

  db.run(
    `UPDATE seeding_sessions SET last_announce = ?, seed_seconds = seed_seconds + ? WHERE id = ?`,
    [now, creditable, session.id],
  );
}

export function endSeedingSession({ infoHash, peerId }) {
  const peerHex = Buffer.from(peerId, 'binary').toString('hex');
  getDb().run(
    `UPDATE seeding_sessions SET ended_at = datetime('now')
     WHERE info_hash = ? AND peer_id = ? AND ended_at IS NULL`,
    [infoHash, peerHex],
  );
}

/**
 * Calculate pending (uncredited) reward in KTH minimal units (6 decimals).
 * Returns a number.
 */
export function calculatePendingRewards(userId) {
  const db  = getDb();
  const row = db.queryOne(
    `SELECT COALESCE(SUM(seed_seconds - rewarded_seconds), 0) AS pending_secs
     FROM seeding_sessions
     WHERE user_id = ? AND seed_seconds > rewarded_seconds`,
    [userId],
  );
  const pendingSecs  = Number(row?.pending_secs ?? 0);
  const pendingHours = pendingSecs / 3600;
  const ratePerHour = getSetting('reward_rate_per_hour') ?? config.rewards.ratePerHour;
  return Math.floor(pendingHours * ratePerHour);
}

/**
 * Send reward tokens directly to the user's Klever wallet.
 * Returns { id, amount, amountKth, txHash }.
 */
export async function mintRewardsToUser(userId) {
  const db     = getDb();
  const user   = db.queryOne(`SELECT wallet, total_rewards, claimed_rewards FROM users WHERE id = ?`, [userId]);
  if (!user)   throw new Error('User not found');

  const amount = calculatePendingRewards(userId);
  if (amount === 0) throw new Error('No pending rewards');

  const txHash = await kleverMintKth(user.wallet, amount);

  // Mark seeding seconds as rewarded
  db.run(
    `UPDATE seeding_sessions SET rewarded_seconds = seed_seconds
     WHERE user_id = ? AND seed_seconds > rewarded_seconds`,
    [userId],
  );

  // Record the claim
  const id         = randomUUID();
  const newTotal   = (Number(user.total_rewards)   + amount).toString();
  const newClaimed = (Number(user.claimed_rewards) + amount).toString();

  db.run(
    `INSERT INTO reward_claims (id, user_id, wallet, amount, tx_hash, status, token_id, token_precision)
     VALUES (?, ?, ?, ?, ?, 'completed', ?, ?)`,
    [id, userId, user.wallet, amount.toString(), txHash, config.rewards.tokenId, config.rewards.tokenPrecision],
  );

  db.run(
    `UPDATE users SET total_rewards = ?, claimed_rewards = ? WHERE id = ?`,
    [newTotal, newClaimed, userId],
  );

  const divisor = 10 ** config.rewards.tokenPrecision;
  return { id, amount, amountKth: (amount / divisor).toFixed(config.rewards.tokenPrecision), txHash };
}
