import { getDb } from '../../db/index.js';

/**
 * Express middleware — validates the session token from the Authorization header.
 * Attaches req.user and req.session on success.
 *
 * Header format: Authorization: Bearer <session_id>
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const sessionId = header.slice(7).trim();
  if (!sessionId) return res.status(401).json({ error: 'Missing session token' });

  const db = getDb();
  const session = db.queryOne(
    `SELECT s.*, u.id as user_id, u.wallet, u.username, u.total_rewards, u.claimed_rewards
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > datetime('now')`,
    [sessionId],
  );

  if (!session) return res.status(401).json({ error: 'Invalid or expired session' });

  req.session = session;
  req.user    = {
    id:             session.user_id,
    wallet:         session.wallet,
    username:       session.username,
    totalRewards:   session.total_rewards,
    claimedRewards: session.claimed_rewards,
  };

  next();
}

/** Optional auth — attaches req.user if token is present and valid, otherwise continues. */
export function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next();

  const sessionId = header.slice(7).trim();
  if (!sessionId) return next();

  const db = getDb();
  const session = db.queryOne(
    `SELECT s.*, u.id as user_id, u.wallet, u.username
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > datetime('now')`,
    [sessionId],
  );

  if (session) {
    req.session = session;
    req.user = { id: session.user_id, wallet: session.wallet, username: session.username };
  }
  next();
}
