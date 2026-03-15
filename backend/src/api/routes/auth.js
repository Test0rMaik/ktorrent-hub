import { Router }   from 'express';
import { bech32 }   from 'bech32';
import { verify as cryptoVerify, randomUUID } from 'crypto';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { getDb }    from '../../db/index.js';
import { config }   from '../../config/index.js';
import { getSetting } from '../../db/settings.js';

const router = Router();

// ── GET /api/auth/nonce ─────────────────────────────────────
// Returns a one-time challenge message for the wallet to sign.
router.get('/nonce', (req, res) => {
  const { wallet } = req.query;
  if (!wallet) return res.status(400).json({ error: 'wallet address required' });
  if (!wallet.startsWith('klv1')) return res.status(400).json({ error: 'Invalid Klever address' });

  const nonce     = randomUUID().replace(/-/g, '').slice(0, 16);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const db        = getDb();

  db.run(
    `INSERT INTO nonces (nonce, wallet, expires_at) VALUES (?, ?, ?)
     ON CONFLICT(nonce) DO NOTHING`,
    [nonce, wallet.toLowerCase(), expiresAt],
  );

  // The full message the frontend will sign
  const message = buildChallengeMessage(wallet, nonce);
  res.json({ nonce, message });
});

// ── POST /api/auth/verify ───────────────────────────────────
// Verifies a Klever Ed25519 signature and returns a session token.
router.post('/verify', async (req, res) => {
  try {
    const { wallet, nonce, signature } = req.body;
    if (!wallet || !nonce || !signature) {
      return res.status(400).json({ error: 'wallet, nonce, and signature required' });
    }
    if (!wallet.startsWith('klv1')) {
      return res.status(400).json({ error: 'Invalid Klever address' });
    }

    const db = getDb();

    // Atomically claim the nonce in a single UPDATE — prevents a race condition
    // where two concurrent requests both pass the used=0 SELECT check.
    const { rowCount } = db.run(
      `UPDATE nonces SET used = 1
       WHERE nonce = ? AND expires_at > datetime('now') AND used = 0`,
      [nonce],
    );
    if (rowCount === 0) return res.status(401).json({ error: 'Invalid or expired nonce' });

    // Read back to check wallet binding (nonce is now irrevocably consumed)
    const stored = db.queryOne(`SELECT wallet FROM nonces WHERE nonce = ?`, [nonce]);
    if (!stored || stored.wallet !== wallet.toLowerCase()) {
      return res.status(401).json({ error: 'Wallet mismatch' });
    }

    // Verify Ed25519 signature: public key is decoded from the klv1 bech32 address
    const message = buildChallengeMessage(wallet, nonce);
    const valid   = verifyKleverSignature(message, signature, wallet);
    if (!valid) return res.status(401).json({ error: 'Signature verification failed' });

    // Check if wallet is banned
    const ban = db.queryOne(`SELECT reason FROM bans WHERE wallet = ?`, [wallet.toLowerCase()]);
    if (ban) return res.status(403).json({ error: `Wallet is banned${ban.reason ? `: ${ban.reason}` : ''}` });

    // Find or create user
    let user = db.queryOne(`SELECT * FROM users WHERE wallet = ?`, [wallet.toLowerCase()]);
    if (!user) {
      const userId = randomUUID();
      db.run(
        `INSERT INTO users (id, wallet, avatar_seed) VALUES (?, ?, ?)`,
        [userId, wallet.toLowerCase(), randomUUID()],
      );
      user = db.queryOne(`SELECT * FROM users WHERE id = ?`, [userId]);
    }

    db.run(`UPDATE users SET last_seen = datetime('now') WHERE id = ?`, [user.id]);

    // Create session (7 days)
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.run(
      `INSERT INTO sessions (id, user_id, wallet, expires_at) VALUES (?, ?, ?, ?)`,
      [sessionId, user.id, wallet.toLowerCase(), expiresAt],
    );

    res.json({
      token:     sessionId,
      expiresAt,
      user: {
        id:             user.id,
        wallet:         user.wallet,
        username:       user.username,
        avatarSeed:     user.avatar_seed,
        totalRewards:   user.total_rewards,
        claimedRewards: user.claimed_rewards,
      },
    });
  } catch (err) {
    console.error('[auth/verify]', err);
    res.status(401).json({ error: 'Verification failed' });
  }
});

// ── POST /api/auth/logout ───────────────────────────────────
router.post('/logout', (req, res) => {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const sessionId = header.slice(7).trim();
    getDb().run(`DELETE FROM sessions WHERE id = ?`, [sessionId]);
  }
  res.json({ success: true });
});

// ── Helpers ─────────────────────────────────────────────────

/**
 * Build the human-readable challenge string the wallet must sign.
 * Keeping it short and clear so users understand what they're signing.
 */
function buildChallengeMessage(wallet, nonce) {
  const siteName = getSetting('site_name') || 'KleverTorrentHub';
  return `${siteName} sign-in\n\nAddress: ${wallet}\nNonce: ${nonce}\nDomain: ${config.auth.domain}`;
}

/**
 * Verify a Klever Ed25519 signature.
 *
 * Klever signing format (from Klever Extension):
 *   1. Prefix:  \x17 + "Klever Signed Message:\n" + len(message as decimal) + message
 *   2. Hash:    Keccak-256 of the prefixed bytes
 *   3. Sign:    Ed25519 sign the 32-byte hash
 *
 * The klv1 address is a bech32-encoded 32-byte Ed25519 public key.
 */
function verifyKleverSignature(message, signatureHex, klvAddress) {
  try {
    // 1. Decode public key from bech32 address
    const decoded     = bech32.decode(klvAddress);
    const pubKeyBytes = Buffer.from(bech32.fromWords(decoded.words));

    // 2. Build the Klever prefixed message and Keccak-256 hash it
    const prefix    = Buffer.from('\x17Klever Signed Message:\n', 'utf8');
    const msgBytes  = Buffer.from(message, 'utf8');
    const lenBytes  = Buffer.from(String(msgBytes.length), 'utf8');
    const prefixed  = Buffer.concat([prefix, lenBytes, msgBytes]);
    const msgHash   = Buffer.from(keccak_256(prefixed));

    // 3. Build SPKI-DER public key for Node.js crypto
    const spkiHeader = Buffer.from('302a300506032b6570032100', 'hex');
    const spkiDer    = Buffer.concat([spkiHeader, pubKeyBytes]);

    const sigBuf = Buffer.from(signatureHex, 'hex');

    return cryptoVerify(null, msgHash, { key: spkiDer, format: 'der', type: 'spki' }, sigBuf);
  } catch (err) {
    console.warn('[auth] Signature verification error:', err.message);
    return false;
  }
}

export default router;
