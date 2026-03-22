import { Router }      from 'express';
import multer          from 'multer';
import path            from 'path';
import { requireAdmin } from '../middleware/admin.js';
import { getAllSettings, getSetting, setSetting, getEnabledCategories } from '../../db/settings.js';
import { ALL_CATEGORIES, config }  from '../../config/index.js';
import { getDb }       from '../../db/index.js';
import { getAdminWalletInfo } from '../../rewards/klever.js';

const router = Router();

const logoUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, config.upload.dir),
    filename:    (req, file, cb) => cb(null, `site-logo${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];
    cb(allowed.includes(file.mimetype) ? null : new Error('Only image files are allowed'), allowed.includes(file.mimetype));
  },
});

// All admin routes require the owner wallet
router.use(requireAdmin);

// ── GET /api/admin/settings ─────────────────────────────────
// Returns all current settings plus the full category master list.
router.get('/settings', (req, res) => {
  res.json({
    settings:      getAllSettings(),
    allCategories: ALL_CATEGORIES,
  });
});

// ── PATCH /api/admin/settings ───────────────────────────────
// Update one or more settings at once.
router.patch('/settings', (req, res) => {
  const allowed = [
    'enabled_categories',
    'reward_rate_per_hour',
    'user_seeding_rewards_enabled',
    'user_seeding_rate_per_hour',
    'require_invite',
    'admin_only_uploads',
    'show_features_section',
    'show_hero_section',
    'rewards_enabled',
    'hero_title',
    'hero_subtitle',
    'site_name',
    'site_description',
    'announcement',
    'home_latest_count',
    'home_hot_count',
    'enabled_extensions',
    'active_theme',
  ];

  // Max lengths for freeform text settings
  const STRING_MAX = {
    hero_title:       100,
    hero_subtitle:    200,
    site_name:        100,
    site_description: 500,
    announcement:     1000,
  };

  const errors = [];

  for (const key of allowed) {
    if (!(key in req.body)) continue;
    const value = req.body[key];

    // Per-key validation
    if (key === 'enabled_categories') {
      if (!Array.isArray(value)) { errors.push('enabled_categories must be an array'); continue; }
      const validIds = ALL_CATEGORIES.map(c => c.id);
      const invalid  = value.filter(id => !validIds.includes(id));
      if (invalid.length) { errors.push(`Unknown category IDs: ${invalid.join(', ')}`); continue; }
      if (value.length === 0) { errors.push('At least one category must be enabled'); continue; }
    }

    if (['reward_rate_per_hour', 'user_seeding_rate_per_hour', 'home_latest_count', 'home_hot_count'].includes(key)) {
      const n = parseInt(value, 10);
      if (isNaN(n) || n < 0) { errors.push(`${key} must be a non-negative integer`); continue; }
      setSetting(key, n);
      continue;
    }

    if (key === 'enabled_extensions') {
      if (!Array.isArray(value)) { errors.push('enabled_extensions must be an array'); continue; }
      setSetting(key, value.map(String));
      continue;
    }

    if (key === 'active_theme') {
      if (typeof value !== 'string' || value.length > 50) { errors.push('active_theme must be a string (≤50 chars)'); continue; }
      setSetting(key, value);
      continue;
    }

    if (['require_invite', 'admin_only_uploads', 'show_features_section', 'show_hero_section', 'rewards_enabled', 'user_seeding_rewards_enabled'].includes(key)) {
      setSetting(key, Boolean(value));
      continue;
    }

    // Freeform string — enforce max length to prevent DB bloat
    if (STRING_MAX[key] !== undefined) {
      if (typeof value !== 'string') { errors.push(`${key} must be a string`); continue; }
      if (value.length > STRING_MAX[key]) { errors.push(`${key} must be ≤${STRING_MAX[key]} chars`); continue; }
    }

    setSetting(key, value);
  }

  if (errors.length) return res.status(400).json({ errors });
  res.json({ settings: getAllSettings() });
});

// ── POST /api/admin/logo ────────────────────────────────────
// Upload a new site logo image.
router.post('/logo', logoUpload.single('logo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  const logoUrl = `/uploads/${req.file.filename}`;
  setSetting('site_logo', logoUrl);
  res.json({ logoUrl });
});

// ── DELETE /api/admin/logo ───────────────────────────────────
// Remove the custom logo (revert to default).
router.delete('/logo', (req, res) => {
  setSetting('site_logo', '');
  res.json({ success: true });
});

// ── GET /api/admin/stats ────────────────────────────────────
router.get('/stats', (req, res) => {
  const db = getDb();

  const torrents   = db.queryOne(`SELECT COUNT(*) as c FROM torrents WHERE status = 'active'`);
  const deleted    = db.queryOne(`SELECT COUNT(*) as c FROM torrents WHERE status = 'deleted'`);
  const users      = db.queryOne(`SELECT COUNT(*) as c FROM users`);
  const bans       = db.queryOne(`SELECT COUNT(*) as c FROM bans`);
  const comments   = db.queryOne(`SELECT COUNT(*) as c FROM comments`);
  const claims     = db.queryOne(`SELECT COUNT(*) as c FROM reward_claims`);
  const totalMinted = db.queryOne(`SELECT COALESCE(SUM(amount), 0) as s FROM reward_claims WHERE status = 'completed'`);

  const { rows: topUploaders } = db.query(
    `SELECT u.wallet, u.username, COUNT(t.id) as count
     FROM users u JOIN torrents t ON t.uploader_id = u.id AND t.status = 'active'
     GROUP BY u.id ORDER BY count DESC LIMIT 10`,
  );

  const { rows: recentTorrents } = db.query(
    `SELECT t.id, t.name, t.category, t.created_at, u.wallet, u.username
     FROM torrents t JOIN users u ON u.id = t.uploader_id
     WHERE t.status = 'active' ORDER BY t.created_at DESC LIMIT 20`,
  );

  const { rows: recentUsers } = db.query(
    `SELECT id, wallet, username, created_at FROM users ORDER BY created_at DESC LIMIT 20`,
  );

  res.json({
    counts: {
      torrents:    torrents?.c    ?? 0,
      deleted:     deleted?.c     ?? 0,
      users:       users?.c       ?? 0,
      bans:        bans?.c        ?? 0,
      comments:    comments?.c    ?? 0,
      claims:      claims?.c      ?? 0,
      totalMinted: totalMinted?.s ?? 0,
    },
    topUploaders,
    recentTorrents,
    recentUsers,
  });
});

// ── GET /api/admin/torrents ─────────────────────────────────
// Admin torrent list — includes deleted torrents.
router.get('/torrents', (req, res) => {
  const { page = 1, limit = 50, status = 'active', q } = req.query;
  const db = getDb();

  const conditions = [];
  const params     = [];

  if (['active', 'deleted', 'pending'].includes(status)) {
    conditions.push(`t.status = ?`); params.push(status);
  }
  if (q) {
    conditions.push(`t.name LIKE ? ESCAPE '\\'`); params.push(`%${escapeLike(String(q).slice(0, 200))}%`);
  }

  const where     = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitNum  = Math.min(200, Math.max(1, parseInt(limit, 10)));
  const offset    = (Math.max(1, parseInt(page, 10)) - 1) * limitNum;

  const { rows } = db.query(
    `SELECT t.id, t.info_hash, t.name, t.category, t.status, t.is_featured,
            t.is_freeleech, t.seeders, t.leechers, t.completed, t.size,
            t.created_at, u.wallet as uploader_wallet, u.username as uploader_username
     FROM torrents t JOIN users u ON u.id = t.uploader_id
     ${where} ORDER BY t.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limitNum, offset],
  );

  const total = db.queryOne(`SELECT COUNT(*) as c FROM torrents t ${where}`, params);
  res.json({ torrents: rows, total: total?.c ?? 0 });
});

// ── PATCH /api/admin/torrents/:id ───────────────────────────
// Admin can update status, featured, freeleech on any torrent.
router.patch('/torrents/:id', (req, res) => {
  const db      = getDb();
  const torrent = db.queryOne(`SELECT * FROM torrents WHERE id = ?`, [req.params.id]);
  if (!torrent) return res.status(404).json({ error: 'Not found' });

  const allowed = ['status', 'is_featured', 'is_freeleech'];
  const updates = [];
  const vals    = [];

  for (const key of allowed) {
    if (!(key in req.body)) continue;
    if (key === 'status' && !['active', 'deleted', 'pending'].includes(req.body[key])) continue;
    updates.push(`${key} = ?`);
    vals.push(key === 'status' ? req.body[key] : req.body[key] ? 1 : 0);
  }
  if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });

  updates.push(`updated_at = datetime('now')`);
  db.run(`UPDATE torrents SET ${updates.join(', ')} WHERE id = ?`, [...vals, torrent.id]);
  res.json({ success: true });
});

// ── GET /api/admin/users ────────────────────────────────────
router.get('/users', (req, res) => {
  const { page = 1, limit = 50, q } = req.query;
  const db = getDb();

  const conditions = [];
  const params     = [];
  if (q) {
    const safeQ = `%${escapeLike(String(q).slice(0, 200))}%`;
    conditions.push(`(u.wallet LIKE ? ESCAPE '\\' OR u.username LIKE ? ESCAPE '\\')`);
    params.push(safeQ, safeQ);
  }

  const where    = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
  const offset   = (Math.max(1, parseInt(page, 10)) - 1) * limitNum;

  const { rows } = db.query(
    `SELECT u.id, u.wallet, u.username, u.total_rewards, u.created_at, u.last_seen,
            COUNT(t.id) as torrent_count,
            CASE WHEN b.wallet IS NOT NULL THEN 1 ELSE 0 END as is_banned
     FROM users u
     LEFT JOIN torrents t ON t.uploader_id = u.id AND t.status = 'active'
     LEFT JOIN bans b ON b.wallet = u.wallet
     ${where}
     GROUP BY u.id ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limitNum, offset],
  );

  const total = db.queryOne(`SELECT COUNT(*) as c FROM users u ${where}`, params);
  res.json({ users: rows, total: total?.c ?? 0 });
});

// ── POST /api/admin/users/:wallet/ban ───────────────────────
router.post('/users/:wallet/ban', (req, res) => {
  const wallet = req.params.wallet.toLowerCase();
  const db     = getDb();

  if (wallet === req.user.wallet) return res.status(400).json({ error: 'Cannot ban yourself' });

  const existing = db.queryOne(`SELECT 1 FROM bans WHERE wallet = ?`, [wallet]);
  if (existing)  return res.status(409).json({ error: 'Already banned' });

  db.run(
    `INSERT INTO bans (wallet, reason, banned_by) VALUES (?, ?, ?)`,
    [wallet, req.body.reason?.trim() || null, req.user.wallet],
  );

  // Expire all sessions for this wallet
  db.run(
    `DELETE FROM sessions WHERE wallet = ?`,
    [wallet],
  );

  res.json({ success: true });
});

// ── DELETE /api/admin/users/:wallet/ban ─────────────────────
router.delete('/users/:wallet/ban', (req, res) => {
  const wallet = req.params.wallet.toLowerCase();
  getDb().run(`DELETE FROM bans WHERE wallet = ?`, [wallet]);
  res.json({ success: true });
});

// ── GET /api/admin/bans ─────────────────────────────────────
router.get('/bans', (req, res) => {
  const { rows } = getDb().query(
    `SELECT wallet, reason, banned_by, created_at FROM bans ORDER BY created_at DESC`,
  );
  res.json({ bans: rows });
});

// ── GET /api/admin/reward-wallet ────────────────────────────
// Returns the reward wallet address, its configured token balance,
// and its native KLV balance (used to pay minting fees).
router.get('/reward-wallet', async (req, res) => {
  try {
    const info = await getAdminWalletInfo();
    res.json({ ...info, tokenId: config.rewards.tokenId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Escape SQL LIKE wildcards so user input is treated as a literal string. */
function escapeLike(str) {
  return str.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export default router;
