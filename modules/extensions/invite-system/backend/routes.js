import { Router } from '../../../../backend/src/extensions/shared.js';
import { randomBytes, randomUUID } from 'crypto';
import { getDb } from '../../../../backend/src/db/index.js';
import { getSetting, setSetting } from '../../../../backend/src/db/settings.js';
import { requireAuth } from '../../../../backend/src/api/middleware/auth.js';
import { requireAdmin } from '../../../../backend/src/api/middleware/admin.js';

const router = Router();

// ── Ensure invite_requests table exists ───────────────────
(function ensureTables() {
  const db = getDb();
  db.run(`
    CREATE TABLE IF NOT EXISTS invite_requests (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status      TEXT NOT NULL DEFAULT 'pending',
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT,
      resolved_by TEXT
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_invite_requests_user ON invite_requests(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_invite_requests_status ON invite_requests(status)`);
})();

// Defaults for user-invite settings
function getUserInvitesEnabled() { return getSetting('user_invites_enabled') ?? false; }
function getUserInviteCount()   { return getSetting('user_invites_count') ?? 3; }

/**
 * Auto-allocate invite codes to a user if they have fewer than their quota.
 * Called lazily when a user checks their invites.
 */
function ensureUserInvites(userId) {
  if (!getUserInvitesEnabled()) return;

  const db = getDb();
  const quota = getUserInviteCount();
  const existing = db.queryOne(
    `SELECT COUNT(*) as c FROM invites WHERE created_by = ?`,
    [userId],
  );
  const have = existing?.c ?? 0;
  if (have >= quota) return;

  const toCreate = quota - have;
  for (let i = 0; i < toCreate; i++) {
    const code = randomBytes(6).toString('hex');
    db.run(
      `INSERT INTO invites (code, created_by) VALUES (?, ?)`,
      [code, userId],
    );
  }
}

// ═══════════════════════════════════════════════════════════
// USER ENDPOINTS
// ═══════════════════════════════════════════════════════════

// ── GET /api/ext/invite-system/my-invites ─────────────────
// Auth: get the current user's invite codes.
router.get('/my-invites', requireAuth, (req, res) => {
  // Lazily allocate invites on first visit
  ensureUserInvites(req.user.id);

  const db = getDb();
  const { rows } = db.query(`
    SELECT i.code, i.created_at, i.used_at,
           uu.wallet  as used_by_wallet,
           uu.username as used_by_username
    FROM invites i
    LEFT JOIN users uu ON uu.id = i.used_by
    WHERE i.created_by = ?
    ORDER BY i.used_at IS NULL DESC, i.created_at DESC
  `, [req.user.id]);

  const total = rows.length;
  const used  = rows.filter(r => r.used_by_wallet).length;
  const available = total - used;

  res.json({
    invites: rows,
    total,
    used,
    available,
    enabled: getUserInvitesEnabled(),
    quota: getUserInviteCount(),
  });
});

// ── POST /api/ext/invite-system/request ───────────────────
// Auth: request more invite codes (when all are used up).
router.post('/request', requireAuth, (req, res) => {
  if (!getUserInvitesEnabled()) {
    return res.status(400).json({ error: 'User invites are not enabled' });
  }

  const db = getDb();

  // Check if user has unused invites remaining
  const available = db.queryOne(
    `SELECT COUNT(*) as c FROM invites WHERE created_by = ? AND used_by IS NULL`,
    [req.user.id],
  );
  if ((available?.c ?? 0) > 0) {
    return res.status(400).json({ error: 'You still have unused invite codes' });
  }

  // Check for existing pending request
  const pending = db.queryOne(
    `SELECT id FROM invite_requests WHERE user_id = ? AND status = 'pending'`,
    [req.user.id],
  );
  if (pending) {
    return res.status(409).json({ error: 'You already have a pending request' });
  }

  const id = randomUUID();
  db.run(
    `INSERT INTO invite_requests (id, user_id) VALUES (?, ?)`,
    [id, req.user.id],
  );

  res.json({ success: true, requestId: id });
});

// ═══════════════════════════════════════════════════════════
// ADMIN ENDPOINTS
// ═══════════════════════════════════════════════════════════

// ── GET /api/ext/invite-system/settings ───────────────────
// Admin: get invite system settings.
router.get('/settings', requireAdmin, (req, res) => {
  res.json({
    user_invites_enabled: getUserInvitesEnabled(),
    user_invites_count: getUserInviteCount(),
  });
});

// ── PATCH /api/ext/invite-system/settings ─────────────────
// Admin: update invite system settings.
router.patch('/settings', requireAdmin, (req, res) => {
  const { user_invites_enabled, user_invites_count } = req.body;

  if (user_invites_enabled !== undefined) {
    setSetting('user_invites_enabled', Boolean(user_invites_enabled));
  }
  if (user_invites_count !== undefined) {
    const n = parseInt(user_invites_count, 10);
    if (isNaN(n) || n < 1 || n > 100) {
      return res.status(400).json({ error: 'Invite count must be between 1 and 100' });
    }
    setSetting('user_invites_count', n);
  }

  res.json({
    user_invites_enabled: getUserInvitesEnabled(),
    user_invites_count: getUserInviteCount(),
  });
});

// ── GET /api/ext/invite-system/invites ────────────────────
// Admin: list all invite codes with usage info.
router.get('/invites', requireAdmin, (req, res) => {
  const db = getDb();
  const { rows } = db.query(`
    SELECT i.code, i.created_at, i.used_at,
           cu.wallet  as created_by_wallet,
           cu.username as created_by_username,
           uu.wallet  as used_by_wallet,
           uu.username as used_by_username
    FROM invites i
    JOIN users cu ON cu.id = i.created_by
    LEFT JOIN users uu ON uu.id = i.used_by
    ORDER BY i.created_at DESC
    LIMIT 200
  `);
  res.json({ invites: rows });
});

// ── POST /api/ext/invite-system/invites ───────────────────
// Admin: generate new invite codes (assigned to admin).
router.post('/invites', requireAdmin, (req, res) => {
  const count = Math.min(20, Math.max(1, parseInt(req.body.count, 10) || 1));
  const db = getDb();
  const codes = [];

  for (let i = 0; i < count; i++) {
    const code = randomBytes(6).toString('hex');
    db.run(
      `INSERT INTO invites (code, created_by) VALUES (?, ?)`,
      [code, req.user.id],
    );
    codes.push(code);
  }

  res.json({ codes });
});

// ── DELETE /api/ext/invite-system/invites/:code ───────────
// Admin: revoke an unused invite code.
router.delete('/invites/:code', requireAdmin, (req, res) => {
  const db = getDb();
  const invite = db.queryOne(`SELECT * FROM invites WHERE code = ?`, [req.params.code]);
  if (!invite) return res.status(404).json({ error: 'Invite not found' });
  if (invite.used_by) return res.status(400).json({ error: 'Invite already used, cannot revoke' });

  db.run(`DELETE FROM invites WHERE code = ?`, [req.params.code]);
  res.json({ success: true });
});

// ── GET /api/ext/invite-system/stats ──────────────────────
// Admin: invite stats.
router.get('/stats', requireAdmin, (req, res) => {
  const db = getDb();
  const total = db.queryOne(`SELECT COUNT(*) as c FROM invites`);
  const used  = db.queryOne(`SELECT COUNT(*) as c FROM invites WHERE used_by IS NOT NULL`);
  const available = db.queryOne(`SELECT COUNT(*) as c FROM invites WHERE used_by IS NULL`);
  const pendingRequests = db.queryOne(`SELECT COUNT(*) as c FROM invite_requests WHERE status = 'pending'`);

  res.json({
    total:           total?.c ?? 0,
    used:            used?.c ?? 0,
    available:       available?.c ?? 0,
    pendingRequests: pendingRequests?.c ?? 0,
  });
});

// ── GET /api/ext/invite-system/requests ───────────────────
// Admin: list invite requests.
router.get('/requests', requireAdmin, (req, res) => {
  const db = getDb();
  const { rows } = db.query(`
    SELECT ir.id, ir.status, ir.created_at, ir.resolved_at,
           u.wallet, u.username,
           (SELECT COUNT(*) FROM invites WHERE created_by = ir.user_id) as total_invites,
           (SELECT COUNT(*) FROM invites WHERE created_by = ir.user_id AND used_by IS NOT NULL) as used_invites
    FROM invite_requests ir
    JOIN users u ON u.id = ir.user_id
    ORDER BY CASE ir.status WHEN 'pending' THEN 0 ELSE 1 END, ir.created_at DESC
    LIMIT 100
  `);
  res.json({ requests: rows });
});

// ── POST /api/ext/invite-system/requests/:id/approve ──────
// Admin: approve a request — generates new invites for the user.
router.post('/requests/:id/approve', requireAdmin, (req, res) => {
  const db = getDb();
  const request = db.queryOne(
    `SELECT * FROM invite_requests WHERE id = ? AND status = 'pending'`,
    [req.params.id],
  );
  if (!request) return res.status(404).json({ error: 'Request not found or already resolved' });

  // Generate new invite codes for the user
  const count = getUserInviteCount();
  for (let i = 0; i < count; i++) {
    const code = randomBytes(6).toString('hex');
    db.run(
      `INSERT INTO invites (code, created_by) VALUES (?, ?)`,
      [code, request.user_id],
    );
  }

  db.run(
    `UPDATE invite_requests SET status = 'approved', resolved_at = datetime('now'), resolved_by = ? WHERE id = ?`,
    [req.user.id, req.params.id],
  );

  res.json({ success: true, count });
});

// ── POST /api/ext/invite-system/requests/:id/deny ─────────
// Admin: deny a request.
router.post('/requests/:id/deny', requireAdmin, (req, res) => {
  const db = getDb();
  const request = db.queryOne(
    `SELECT * FROM invite_requests WHERE id = ? AND status = 'pending'`,
    [req.params.id],
  );
  if (!request) return res.status(404).json({ error: 'Request not found or already resolved' });

  db.run(
    `UPDATE invite_requests SET status = 'denied', resolved_at = datetime('now'), resolved_by = ? WHERE id = ?`,
    [req.user.id, req.params.id],
  );

  res.json({ success: true });
});

export default router;
