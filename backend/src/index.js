import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { mkdirSync } from 'fs';

import { config } from './config/index.js';
import { initDatabase } from './db/index.js';
import { handleAnnounce } from './tracker/announce.js';
import { handleScrape } from './tracker/scrape.js';
import { startCleanup } from './tracker/peerStore.js';
import authRouter    from './api/routes/auth.js';
import torrentsRouter from './api/routes/torrents.js';
import usersRouter   from './api/routes/users.js';
import rewardsRouter from './api/routes/rewards.js';
import metaRouter    from './api/routes/meta.js';
import adminRouter   from './api/routes/admin.js';
import { loadExtensions } from './extensions/loader.js';

// ── Ensure required directories exist ───────────────────────
mkdirSync(config.upload.dir, { recursive: true });

// ── Initialise database ──────────────────────────────────────
await initDatabase();

// ── Create tables not yet in main schema ─────────────────────
import { getDb } from './db/index.js';
getDb().run(`
  CREATE TABLE IF NOT EXISTS peer_registrations (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    peer_id    TEXT NOT NULL,
    info_hash  TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(peer_id, info_hash)
  )
`);

// Add passkey column to users if not yet present (safe on repeated runs)
try { getDb().run(`ALTER TABLE users ADD COLUMN passkey TEXT`); } catch { /* already exists */ }

// Add token metadata columns to reward_claims so history survives token changes
try { getDb().run(`ALTER TABLE reward_claims ADD COLUMN token_id        TEXT`); } catch { /* already exists */ }
try { getDb().run(`ALTER TABLE reward_claims ADD COLUMN token_precision INTEGER`); } catch { /* already exists */ }

if (config.ownerWallet) {
  console.log(`[admin] Owner wallet: ${config.ownerWallet}`);
} else {
  console.warn(`[admin] OWNER_WALLET not set — admin dashboard is disabled`);
}

// ── Express app ──────────────────────────────────────────────
const app = express();

// Trust one proxy hop (nginx/load-balancer) so req.ip resolves to the real
// client IP for rate limiting. Increase if there are multiple reverse proxies.
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", ...config.cors.origins],
    },
  },
}));

// CORS
app.use(cors({
  origin: config.cors.origins,
  credentials: true,
}));

// Body parsing — keep limits small; file uploads are handled by multer separately
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max:      300,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many requests, please slow down.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      20,
  message: { error: 'Too many auth requests.' },
});

const trackerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      120,
});

// ── BitTorrent tracker endpoints ─────────────────────────────
app.get('/announce', trackerLimiter, handleAnnounce);
app.get('/scrape',   trackerLimiter, handleScrape);

// ── REST API ─────────────────────────────────────────────────
app.use('/api/auth',     authLimiter, authRouter);
app.use('/api/torrents', apiLimiter,  torrentsRouter);
app.use('/api/users',    apiLimiter,  usersRouter);
app.use('/api/rewards',  apiLimiter,  rewardsRouter);
app.use('/api/meta',     apiLimiter,  metaRouter);
app.use('/api/admin',   apiLimiter,  adminRouter);

// ── Extension routes (loaded dynamically) ─────────────────
await loadExtensions(app, apiLimiter);

// Static uploads (torrent files — served so clients can download .torrent)
app.use('/uploads', express.static(config.upload.dir, {
  index:    false,      // no directory listing
  dotfiles: 'deny',     // block hidden files
}));

// ── Health check ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ── 404 ──────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// ── Error handler ────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large' });
  }
  console.error('[error]', err);
  res.status(500).json({ error: config.isDev ? err.message : 'Internal server error' });
});

// ── Start server ─────────────────────────────────────────────
app.listen(config.port, () => {
  console.log(`\n🚀 KleverTorrentHub backend running on http://localhost:${config.port}`);
  console.log(`   Tracker: http://localhost:${config.port}/announce`);
  console.log(`   API:     http://localhost:${config.port}/api`);
  console.log(`   DB:      ${config.db.type} (${config.db.type === 'sqlite' ? config.db.sqlite.path : config.db.postgres.host})\n`);
});

// Start peer cleanup loop
startCleanup();

// Periodically purge expired/used nonces and expired sessions to prevent DB bloat
setInterval(() => {
  try {
    const db = getDb();
    db.run(`DELETE FROM nonces   WHERE expires_at < datetime('now') OR used = 1`);
    db.run(`DELETE FROM sessions WHERE expires_at < datetime('now')`);
  } catch { /* non-critical */ }
}, 60 * 60 * 1000); // every hour
