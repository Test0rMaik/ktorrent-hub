import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';

const claimLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max:      5,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many reward claims, please slow down.' },
});
import { calculatePendingRewards, mintRewardsToUser } from '../../rewards/tracker.js';
import { getKthBalance } from '../../rewards/klever.js';
import { getDb }   from '../../db/index.js';
import { config }  from '../../config/index.js';
import { randomUUID } from 'crypto';

const router = Router();

// ── GET /api/rewards/pending ────────────────────────────────
router.get('/pending', requireAuth, (req, res) => {
  const amount    = calculatePendingRewards(req.user.id);
  const divisor   = 10 ** config.rewards.tokenPrecision;
  const amountKth = (amount / divisor).toFixed(config.rewards.tokenPrecision);
  res.json({ amount, amountKth, tokenId: config.rewards.tokenId });
});

// ── POST /api/rewards/claim ─────────────────────────────────
// Backend directly mints KTH to the user's Klever wallet.
// No on-chain interaction needed from the frontend side.
router.post('/claim', requireAuth, claimLimiter, async (req, res) => {
  try {
    const result = await mintRewardsToUser(req.user.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── POST /api/rewards/register-peer ────────────────────────
// Links a BitTorrent peer_id to the authenticated user for reward tracking.
router.post('/register-peer', requireAuth, (req, res) => {
  const { peerId, infoHash } = req.body;
  if (!peerId || !infoHash) {
    return res.status(400).json({ error: 'peerId and infoHash required' });
  }
  // Accept 40-char hex (from auto-detection UI) or 20-char binary string
  if (typeof peerId !== 'string' || (peerId.length !== 40 && peerId.length > 20)) {
    return res.status(400).json({ error: 'Invalid peerId' });
  }
  const peerHex = peerId.length === 40 && /^[0-9a-f]+$/i.test(peerId)
    ? peerId.toLowerCase()
    : Buffer.from(peerId, 'binary').toString('hex');
  if (typeof infoHash !== 'string' || !/^[0-9a-fA-F]{40}$/.test(infoHash)) {
    return res.status(400).json({ error: 'Invalid infoHash: must be a 40-char hex string' });
  }

  const db      = getDb();
  const torrent = db.queryOne(
    `SELECT id FROM torrents WHERE info_hash = ? AND status = 'active'`,
    [infoHash.toLowerCase()],
  );
  if (!torrent) return res.status(404).json({ error: 'Torrent not found' });

  // Prevent hijacking: only allow updating a peer_id registration if it belongs to this user
  const existing = db.queryOne(
    `SELECT user_id FROM peer_registrations WHERE peer_id = ? AND info_hash = ?`,
    [peerHex, infoHash.toLowerCase()],
  );
  if (existing && existing.user_id !== req.user.id) {
    return res.status(409).json({ error: 'This peer is already registered to another account' });
  }

  db.run(
    `INSERT INTO peer_registrations (id, user_id, peer_id, info_hash)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(peer_id, info_hash) DO UPDATE SET user_id = excluded.user_id
     WHERE peer_registrations.user_id = excluded.user_id`,
    [randomUUID(), req.user.id, peerHex, infoHash.toLowerCase()],
  );

  res.json({ success: true });
});

// ── GET /api/rewards/history ────────────────────────────────
router.get('/history', requireAuth, (req, res) => {
  const db = getDb();
  const { rows } = db.query(
    `SELECT id, amount, tx_hash, status, created_at, token_id, token_precision
     FROM reward_claims WHERE user_id = ? ORDER BY created_at DESC`,
    [req.user.id],
  );
  res.json({ claims: rows });
});

// ── GET /api/rewards/balance ────────────────────────────────
// Live on-chain KTH balance for the authenticated user.
router.get('/balance', requireAuth, async (req, res) => {
  try {
    const balance = await getKthBalance(req.user.wallet);
    res.json({ balance, tokenId: config.rewards.tokenId });
  } catch {
    res.json({ balance: 0, tokenId: config.rewards.tokenId });
  }
});

export default router;
