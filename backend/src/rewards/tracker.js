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
 * Calculate pending (uncredited) reward in KTH minimal units.
 *
 * Two tiers:
 *   - Uploader tier  : sessions on torrents the user uploaded → reward_rate_per_hour
 *   - Seeder tier    : sessions on torrents uploaded by others → user_seeding_rate_per_hour
 *                      (only counted when user_seeding_rewards_enabled = true)
 */
export function calculatePendingRewards(userId) {
  const db = getDb();

  // ── Uploader sessions ──────────────────────────────────────
  const uploaderRate = getSetting('reward_rate_per_hour') ?? config.rewards.ratePerHour;
  const uploaderRow  = db.queryOne(
    `SELECT COALESCE(SUM(s.seed_seconds - s.rewarded_seconds), 0) AS pending_secs
     FROM seeding_sessions s
     JOIN torrents t ON t.id = s.torrent_id
     WHERE s.user_id = ? AND s.seed_seconds > s.rewarded_seconds AND t.uploader_id = s.user_id`,
    [userId],
  );
  const uploaderAmount = Math.floor((Number(uploaderRow?.pending_secs ?? 0) / 3600) * uploaderRate);

  // ── Non-uploader seeder sessions ───────────────────────────
  const userSeedingEnabled = getSetting('user_seeding_rewards_enabled') ?? false;
  if (!userSeedingEnabled) return uploaderAmount;

  const userRate   = getSetting('user_seeding_rate_per_hour') ?? 0;
  if (!userRate)   return uploaderAmount;

  const seederRow  = db.queryOne(
    `SELECT COALESCE(SUM(s.seed_seconds - s.rewarded_seconds), 0) AS pending_secs
     FROM seeding_sessions s
     JOIN torrents t ON t.id = s.torrent_id
     WHERE s.user_id = ? AND s.seed_seconds > s.rewarded_seconds AND t.uploader_id != s.user_id`,
    [userId],
  );
  const seederAmount = Math.floor((Number(seederRow?.pending_secs ?? 0) / 3600) * userRate);

  return uploaderAmount + seederAmount;
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

  // Mark uploader sessions as rewarded (always paid out)
  db.run(
    `UPDATE seeding_sessions SET rewarded_seconds = seed_seconds
     WHERE user_id = ? AND seed_seconds > rewarded_seconds
     AND torrent_id IN (SELECT id FROM torrents WHERE uploader_id = ?)`,
    [userId, userId],
  );

  // Mark non-uploader seeder sessions as rewarded only when that tier was active.
  // Leaving them un-marked preserves the accrued time if the admin enables the
  // feature later — the user won't lose hours that hadn't been paid out yet.
  if (getSetting('user_seeding_rewards_enabled')) {
    db.run(
      `UPDATE seeding_sessions SET rewarded_seconds = seed_seconds
       WHERE user_id = ? AND seed_seconds > rewarded_seconds
       AND torrent_id NOT IN (SELECT id FROM torrents WHERE uploader_id = ?)`,
      [userId, userId],
    );
  }

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
