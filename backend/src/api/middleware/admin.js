import { config } from '../../config/index.js';
import { requireAuth } from './auth.js';

/**
 * Middleware: requires a valid session AND that the wallet matches OWNER_WALLET.
 * Chains on top of requireAuth so the user object is always available.
 */
export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!config.ownerWallet) {
      return res.status(503).json({ error: 'OWNER_WALLET not configured in .env' });
    }
    if (req.user.wallet !== config.ownerWallet) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
}
