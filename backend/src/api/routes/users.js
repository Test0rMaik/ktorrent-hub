import { Router } from 'express';
import { randomUUID } from 'crypto';
import { getDb } from '../../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../../config/index.js';

const router = Router();

// ── GET /api/users/me ───────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  const db   = getDb();
  const user = db.queryOne(
    `SELECT id, wallet, username, bio, avatar_seed, uploaded, downloaded,
            total_rewards, claimed_rewards, created_at, last_seen
     FROM users WHERE id = ?`,
    [req.user.id],
  );
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { rows: torrents } = db.query(
    `SELECT id, name, category, seeders, leechers, created_at
     FROM torrents WHERE uploader_id = ? AND status = 'active'
     ORDER BY created_at DESC LIMIT 50`,
    [user.id],
  );

  const { rows: bookmarks } = db.query(
    `SELECT t.id, t.name, t.category, t.seeders, t.leechers, b.created_at
     FROM bookmarks b JOIN torrents t ON t.id = b.torrent_id
     WHERE b.user_id = ? ORDER BY b.created_at DESC LIMIT 50`,
    [user.id],
  );

  const pendingRewardRow = db.queryOne(
    `SELECT COALESCE(SUM(seed_seconds - rewarded_seconds), 0) as pending_secs,
            COALESCE(SUM(seed_seconds), 0) as total_secs
     FROM seeding_sessions WHERE user_id = ?`,
    [user.id],
  );

  const { rows: vouchers } = db.query(
    `SELECT id, wallet, amount, tx_hash, status, created_at, token_id, token_precision
     FROM reward_claims WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`,
    [user.id],
  );

  // Total earned for the currently configured token only — avoids mixing
  // amounts from a previous token if the admin changed the reward token.
  const totalEarnedRow = db.queryOne(
    `SELECT COALESCE(SUM(amount), 0) as total
     FROM reward_claims WHERE user_id = ? AND token_id = ? AND status = 'completed'`,
    [user.id, config.rewards.tokenId],
  );

  res.json({
    ...user,
    total_rewards:      totalEarnedRow?.total ?? 0,
    torrents,
    bookmarks,
    pendingSeedSeconds: pendingRewardRow?.pending_secs ?? 0,
    totalSeedSeconds:   pendingRewardRow?.total_secs   ?? 0,
    vouchers,
  });
});

// ── PATCH /api/users/me ─────────────────────────────────────
router.patch('/me', requireAuth, (req, res) => {
  const { username, bio } = req.body;
  const db = getDb();

  if (username !== undefined) {
    if (typeof username !== 'string' || username.length > 32) {
      return res.status(400).json({ error: 'Username must be ≤32 chars' });
    }
    // Uniqueness check
    const existing = db.queryOne(
      `SELECT id FROM users WHERE username = ? AND id != ?`,
      [username.trim(), req.user.id],
    );
    if (existing) return res.status(409).json({ error: 'Username already taken' });
  }

  if (bio !== undefined && bio !== null && bio.length > 500) {
    return res.status(400).json({ error: 'Bio must be ≤500 chars' });
  }

  const updates = [];
  const vals    = [];
  if (username !== undefined) { updates.push('username = ?'); vals.push(username.trim() || null); }
  if (bio !== undefined)       { updates.push('bio = ?');      vals.push(bio?.trim() || null); }

  if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });

  db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, [...vals, req.user.id]);
  res.json({ success: true });
});

// ── GET /api/users/me/passkey ───────────────────────────────
// Returns the user's personalized tracker passkey, generating one if needed.
// The passkey is embedded in the announce URL so the tracker auto-links peers.
router.get('/me/passkey', requireAuth, (req, res) => {
  const db = getDb();
  let { passkey } = db.queryOne(`SELECT passkey FROM users WHERE id = ?`, [req.user.id]) || {};
  if (!passkey) {
    passkey = randomUUID().replace(/-/g, '');
    db.run(`UPDATE users SET passkey = ? WHERE id = ?`, [passkey, req.user.id]);
  }
  res.json({ passkey });
});

// ── GET /api/users/:wallet ──────────────────────────────────
router.get('/:wallet', (req, res) => {
  const wallet = req.params.wallet.toLowerCase();
  const db     = getDb();
  const user   = db.queryOne(
    `SELECT id, wallet, username, bio, avatar_seed, uploaded, downloaded,
            total_rewards, claimed_rewards, created_at
     FROM users WHERE wallet = ?`,
    [wallet],
  );
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { rows: torrents } = db.query(
    `SELECT id, name, category, seeders, leechers, created_at
     FROM torrents WHERE uploader_id = ? AND status = 'active'
     ORDER BY created_at DESC LIMIT 20`,
    [user.id],
  );

  res.json({ ...user, torrents });
});

export default router;
