import { Router } from 'express';
import multer from 'multer';
import { randomUUID, createHash } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import rateLimit from 'express-rate-limit';
import { resolve } from 'path';
import { getDb } from '../../db/index.js';
import { config } from '../../config/index.js';
import { getEnabledCategories, getSetting } from '../../db/settings.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { getStats } from '../../tracker/peerStore.js';

const router = Router();

// Per-IP rate limiter for torrent uploads — prevents spam uploads
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max:      20,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many uploads, please slow down.' },
});

// Per-IP rate limiter for comments
const commentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max:      30,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many comments, please slow down.' },
});

// ── Multer for .torrent file uploads ────────────────────────
mkdirSync(config.upload.dir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.upload.dir),
  filename:    (req, file, cb) => cb(null, `${randomUUID()}.torrent`),
});

const upload = multer({
  storage,
  limits: { fileSize: config.upload.maxSize },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/x-bittorrent' || file.originalname.endsWith('.torrent')) {
      cb(null, true);
    } else {
      cb(new Error('Only .torrent files are allowed'));
    }
  },
});

// ── GET /api/torrents ───────────────────────────────────────
router.get('/', optionalAuth, (req, res) => {
  const {
    page     = 1,
    limit    = 20,
    category,
    q,
    sort     = 'created_at',
    order    = 'desc',
  } = req.query;

  const pageNum  = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset   = (pageNum - 1) * limitNum;

  const validSorts  = ['created_at', 'seeders', 'leechers', 'size', 'name', 'completed', 'views'];
  const validOrders = ['asc', 'desc'];
  const safeSort    = validSorts.includes(sort)  ? sort  : 'created_at';
  const safeOrder   = validOrders.includes(order) ? order : 'desc';

  const conditions = [`t.status = 'active'`];
  const params     = [];

  const enabledCategoryIds = getEnabledCategories().map(c => c.id);
  if (category && enabledCategoryIds.includes(category)) {
    conditions.push(`t.category = ?`);
    params.push(category);
  }

  if (q) {
    const safeQ = escapeLike(String(q).slice(0, 200));
    conditions.push(`(t.name LIKE ? ESCAPE '\\' OR t.description LIKE ? ESCAPE '\\')`);
    params.push(`%${safeQ}%`, `%${safeQ}%`);
  }

  const where = conditions.join(' AND ');
  const db    = getDb();

  const { rows: torrents } = db.query(
    `SELECT t.id, t.info_hash, t.name, t.description, t.category, t.tags,
            t.size, t.file_count, t.seeders, t.leechers, t.completed,
            t.views, t.is_freeleech, t.is_featured, t.poster_url,
            t.magnet, t.created_at,
            u.wallet as uploader_wallet, u.username as uploader_username
     FROM torrents t
     JOIN users u ON u.id = t.uploader_id
     WHERE ${where}
     ORDER BY t.${safeSort} ${safeOrder}
     LIMIT ? OFFSET ?`,
    [...params, limitNum, offset],
  );

  const countRow = db.queryOne(
    `SELECT COUNT(*) as total FROM torrents t WHERE ${where}`,
    params,
  );

  res.json({
    torrents: torrents.map(formatTorrent),
    total:     countRow?.total ?? 0,
    page:      pageNum,
    limit:     limitNum,
    totalPages: Math.ceil((countRow?.total ?? 0) / limitNum),
  });
});

// ── GET /api/torrents/:id ───────────────────────────────────
router.get('/:id', optionalAuth, (req, res) => {
  const db = getDb();
  const torrent = db.queryOne(
    `SELECT t.*, u.wallet as uploader_wallet, u.username as uploader_username
     FROM torrents t
     JOIN users u ON u.id = t.uploader_id
     WHERE t.id = ? AND t.status = 'active'`,
    [req.params.id],
  );

  if (!torrent) return res.status(404).json({ error: 'Torrent not found' });

  // Increment view count (fire and forget)
  db.run(`UPDATE torrents SET views = views + 1 WHERE id = ?`, [torrent.id]);

  // Fetch file list
  const { rows: files } = db.query(
    `SELECT path, size FROM torrent_files WHERE torrent_id = ? ORDER BY path`,
    [torrent.id],
  );

  // Fetch comments
  const { rows: comments } = db.query(
    `SELECT c.id, c.body, c.created_at, u.wallet, u.username, u.avatar_seed
     FROM comments c JOIN users u ON u.id = c.user_id
     WHERE c.torrent_id = ? ORDER BY c.created_at ASC`,
    [torrent.id],
  );

  // Live stats from peer store
  const liveStats = getStats(torrent.info_hash);

  res.json({
    ...formatTorrent(torrent),
    files,
    comments,
    liveSeeders:  liveStats.seeders,
    liveLeechers: liveStats.leechers,
    bookmarked:   req.user
      ? !!db.queryOne(`SELECT 1 FROM bookmarks WHERE user_id = ? AND torrent_id = ?`, [req.user.id, torrent.id])
      : false,
  });
});

// ── POST /api/torrents ──────────────────────────────────────
router.post('/', requireAuth, uploadLimiter, upload.single('torrentFile'), async (req, res) => {
  try {
    // Check if uploads are restricted to the tracker admin
    if (getSetting('admin_only_uploads') && req.user.wallet !== config.ownerWallet) {
      return res.status(403).json({ error: 'Torrent uploads are currently restricted to the tracker admin.' });
    }

    const { name, description, category, tags, magnet, infoHash, size, fileCount, posterUrl } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
    if (name.trim().length > 255) return res.status(400).json({ error: 'name must be ≤255 chars' });
    if (description && description.length > 10000) return res.status(400).json({ error: 'description must be ≤10000 chars' });

    const enabledIds = getEnabledCategories().map(c => c.id);
    if (!enabledIds.includes(category)) return res.status(400).json({ error: 'Invalid or disabled category' });

    // Validate poster URL is a safe http/https URL
    if (posterUrl?.trim()) {
      try {
        const u = new URL(posterUrl.trim());
        if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('bad protocol');
      } catch {
        return res.status(400).json({ error: 'posterUrl must be a valid http/https URL' });
      }
    }

    // Need either a .torrent file, a magnet, or an explicit info_hash
    const resolvedInfoHash = infoHash?.trim() || extractInfoHashFromMagnet(magnet);
    if (!resolvedInfoHash && !req.file) {
      return res.status(400).json({ error: 'Provide a .torrent file, magnet link, or info_hash' });
    }

    // Parse .torrent file if uploaded
    let parsedMeta = {};
    if (req.file) {
      parsedMeta = await parseTorrentFile(req.file.path);
    }

    const finalInfoHash = (resolvedInfoHash || parsedMeta.infoHash || '').toLowerCase();
    if (!finalInfoHash) return res.status(400).json({ error: 'Could not determine info_hash' });

    const db = getDb();

    // Check for duplicate
    const existing = db.queryOne(`SELECT id FROM torrents WHERE info_hash = ?`, [finalInfoHash]);
    if (existing) return res.status(409).json({ error: 'Torrent already exists', id: existing.id });

    const id = randomUUID();
    const parsedTags = tags
      ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())).slice(0, 10).map(t => t.slice(0, 50))
      : [];
    const tagsJson = JSON.stringify(parsedTags);

    db.run(
      `INSERT INTO torrents
         (id, info_hash, name, description, category, tags, size, file_count,
          uploader_id, torrent_file, magnet, poster_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        finalInfoHash,
        name.trim(),
        description?.trim() || null,
        category,
        tagsJson,
        parseInt(size || parsedMeta.size || 0, 10),
        parseInt(fileCount || parsedMeta.fileCount || 1, 10),
        req.user.id,
        req.file?.filename || null,
        magnet?.trim() || parsedMeta.magnet || null,
        posterUrl?.trim() || null,
      ],
    );

    // Insert file list if available
    if (parsedMeta.files?.length) {
      for (const f of parsedMeta.files) {
        db.run(
          `INSERT INTO torrent_files (id, torrent_id, path, size) VALUES (?, ?, ?, ?)`,
          [randomUUID(), id, f.path, f.size],
        );
      }
    }

    res.status(201).json({ id, infoHash: finalInfoHash });
  } catch (err) {
    console.error('[torrents/create]', err);
    res.status(500).json({ error: err.message || 'Failed to create torrent' });
  }
});

// ── GET /api/torrents/:id/download ─────────────────────────
// Serves the .torrent file with the announce URL rewritten to embed the
// requesting user's passkey so their seeding is auto-tracked for rewards.
// Uses raw byte surgery instead of bencode decode+encode to avoid corrupting
// binary fields (e.g. 'piece layers' in BitTorrent v2 / hybrid torrents).
// Unauthenticated users receive the original file unchanged.
router.get('/:id/download', optionalAuth, async (req, res) => {
  const db = getDb();
  const torrent = db.queryOne(
    `SELECT id, name, torrent_file FROM torrents WHERE id = ? AND status = 'active'`,
    [req.params.id],
  );
  if (!torrent?.torrent_file) return res.status(404).json({ error: 'Torrent file not found' });

  const filePath = resolve(config.upload.dir, torrent.torrent_file);
  if (!existsSync(filePath)) return res.status(404).json({ error: 'Torrent file not found on disk' });

  const { readFileSync } = await import('fs');
  let buf = readFileSync(filePath);

  if (req.user) {
    // Fetch or generate the user's passkey
    let { passkey } = db.queryOne(`SELECT passkey FROM users WHERE id = ?`, [req.user.id]) || {};
    if (!passkey) {
      passkey = randomUUID().replace(/-/g, '');
      db.run(`UPDATE users SET passkey = ? WHERE id = ?`, [passkey, req.user.id]);
    }

    const announceUrl = `${req.protocol}://${req.get('host')}/announce?passkey=${passkey}`;

    // Replace (or insert) the announce string and rewrite announce-list.
    // Raw byte surgery preserves every other field byte-for-byte — critical
    // for BitTorrent v2 torrents whose 'piece layers' contains raw SHA-256 hashes.
    buf = bencodeSetString(buf, 'announce', announceUrl);
    buf = bencodeSetValue(buf, 'announce-list',
      Buffer.from(`ll${Buffer.byteLength(announceUrl)}:${announceUrl}ee`));
  }

  const filename = `${torrent.name.replace(/[^a-zA-Z0-9._-]/g, '_')}.torrent`;
  res.setHeader('Content-Type', 'application/x-bittorrent');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buf);
});

// ── PATCH /api/torrents/:id ─────────────────────────────────
router.patch('/:id', requireAuth, (req, res) => {
  const db = getDb();
  const torrent = db.queryOne(
    `SELECT * FROM torrents WHERE id = ? AND status = 'active'`,
    [req.params.id],
  );
  if (!torrent) return res.status(404).json({ error: 'Torrent not found' });
  if (torrent.uploader_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  const allowed = ['name', 'description', 'tags', 'poster_url'];
  const updates = [];
  const vals    = [];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      updates.push(`${key} = ?`);
      vals.push(key === 'tags' ? JSON.stringify(req.body[key]) : req.body[key]);
    }
  }
  if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });

  updates.push(`updated_at = datetime('now')`);
  db.run(`UPDATE torrents SET ${updates.join(', ')} WHERE id = ?`, [...vals, torrent.id]);

  res.json({ success: true });
});

// ── DELETE /api/torrents/:id ────────────────────────────────
router.delete('/:id', requireAuth, (req, res) => {
  const db = getDb();
  const torrent = db.queryOne(`SELECT * FROM torrents WHERE id = ?`, [req.params.id]);
  if (!torrent) return res.status(404).json({ error: 'Torrent not found' });
  if (torrent.uploader_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  db.run(`UPDATE torrents SET status = 'deleted' WHERE id = ?`, [torrent.id]);
  res.json({ success: true });
});

// ── POST /api/torrents/:id/comments ────────────────────────
router.post('/:id/comments', requireAuth, commentLimiter, (req, res) => {
  const { body } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: 'Comment body is required' });
  if (body.length > 5000) return res.status(400).json({ error: 'Comment must be ≤5000 chars' });

  const db = getDb();
  const torrent = db.queryOne(`SELECT id FROM torrents WHERE id = ? AND status = 'active'`, [req.params.id]);
  if (!torrent) return res.status(404).json({ error: 'Torrent not found' });

  const id = randomUUID();
  db.run(
    `INSERT INTO comments (id, torrent_id, user_id, body) VALUES (?, ?, ?, ?)`,
    [id, torrent.id, req.user.id, body.trim()],
  );

  const comment = db.queryOne(
    `SELECT c.id, c.body, c.created_at, u.wallet, u.username, u.avatar_seed
     FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?`,
    [id],
  );
  res.status(201).json(comment);
});

// ── POST /api/torrents/:id/bookmark ────────────────────────
router.post('/:id/bookmark', requireAuth, (req, res) => {
  const db = getDb();
  const existing = db.queryOne(
    `SELECT 1 FROM bookmarks WHERE user_id = ? AND torrent_id = ?`,
    [req.user.id, req.params.id],
  );
  if (existing) {
    db.run(`DELETE FROM bookmarks WHERE user_id = ? AND torrent_id = ?`, [req.user.id, req.params.id]);
    res.json({ bookmarked: false });
  } else {
    db.run(
      `INSERT INTO bookmarks (user_id, torrent_id) VALUES (?, ?)`,
      [req.user.id, req.params.id],
    );
    res.json({ bookmarked: true });
  }
});

// ── Bencode byte-surgery helpers ────────────────────────────
// Returns the index immediately after the end of the bencode value at `pos`.
function bencodeEnd(buf, pos) {
  const b = buf[pos];
  if (b === 100) { // 'd'ict
    pos++;
    while (buf[pos] !== 101) { pos = bencodeEnd(buf, pos); pos = bencodeEnd(buf, pos); }
    return pos + 1;
  }
  if (b === 108) { // 'l'ist
    pos++;
    while (buf[pos] !== 101) pos = bencodeEnd(buf, pos);
    return pos + 1;
  }
  if (b === 105) { // 'i'nteger  ie5 → i42e
    pos++;
    while (buf[pos] !== 101) pos++;
    return pos + 1;
  }
  // Byte string: <decimal-length>:<bytes>
  let colon = pos;
  while (buf[colon] !== 58) colon++;
  return colon + 1 + parseInt(buf.slice(pos, colon).toString('ascii'), 10);
}

// Replace a bencode string value for `key`.  If the key is absent it is
// inserted right after the opening 'd' of the outer dict — safe for
// 'announce' because 'a' sorts before all other standard torrent dict keys.
function bencodeSetString(buf, key, newStr) {
  const keyBytes = Buffer.from(`${key.length}:${key}`);
  const newVal   = Buffer.from(`${Buffer.byteLength(newStr)}:${newStr}`);
  const keyIdx   = buf.indexOf(keyBytes);
  if (keyIdx !== -1) {
    const valStart = keyIdx + keyBytes.length;
    const valEnd   = bencodeEnd(buf, valStart);
    return Buffer.concat([buf.slice(0, valStart), newVal, buf.slice(valEnd)]);
  }
  // Key absent — insert at start of dict (position 1, right after 'd')
  return Buffer.concat([buf.slice(0, 1), keyBytes, newVal, buf.slice(1)]);
}

// Replace an arbitrary bencode value for `key` with raw `newValueBytes`.
// If the key is absent the buffer is returned unchanged.
function bencodeSetValue(buf, key, newValueBytes) {
  const keyBytes = Buffer.from(`${key.length}:${key}`);
  const keyIdx   = buf.indexOf(keyBytes);
  if (keyIdx === -1) return buf;
  const valStart = keyIdx + keyBytes.length;
  const valEnd   = bencodeEnd(buf, valStart);
  return Buffer.concat([buf.slice(0, valStart), newValueBytes, buf.slice(valEnd)]);
}

// ── Helpers ─────────────────────────────────────────────────
function formatTorrent(t) {
  return {
    ...t,
    tags: tryParseJson(t.tags, []),
    isFreeleech: !!t.is_freeleech,
    isFeatured:  !!t.is_featured,
  };
}

function tryParseJson(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

/** Escape SQL LIKE wildcards so user input is treated as a literal string. */
function escapeLike(str) {
  return str.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function extractInfoHashFromMagnet(magnet) {
  if (!magnet) return null;
  const match = magnet.match(/xt=urn:btih:([a-fA-F0-9]{40}|[A-Z2-7]{32})/i);
  return match?.[1]?.toLowerCase() ?? null;
}

async function parseTorrentFile(filePath) {
  // Dynamic import to keep startup fast — bencode is only needed when parsing
  const bencode = await import('bencode');
  const { readFileSync } = await import('fs');

  try {
    const buf  = readFileSync(filePath);
    const meta = bencode.default.decode(buf);

    const info     = meta.info;
    const infoHash = computeInfoHash(bencode.default.encode(info));
    const name     = info.name?.toString() || 'Unknown';

    let files = [];
    let totalSize = 0;

    if (info.files) {
      for (const f of info.files) {
        const path = f.path.map(p => p.toString()).join('/');
        files.push({ path, size: f.length });
        totalSize += f.length;
      }
    } else {
      totalSize = info.length || 0;
      files = [{ path: name, size: totalSize }];
    }

    const trackerList = [];
    if (meta.announce) trackerList.push(meta.announce.toString());

    const magnet = buildMagnet(infoHash, name, trackerList);

    return { infoHash, name, size: totalSize, fileCount: files.length, files, magnet };
  } catch (err) {
    console.warn('[parseTorrent] Failed to parse:', err.message);
    return {};
  }
}

function computeInfoHash(infoBuf) {
  return createHash('sha1').update(infoBuf).digest('hex');
}

function buildMagnet(infoHash, name, trackers = []) {
  let magnet = `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(name)}`;
  for (const tr of trackers) magnet += `&tr=${encodeURIComponent(tr)}`;
  return magnet;
}

export default router;
