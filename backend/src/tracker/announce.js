import bencode from 'bencode';
import { randomUUID } from 'crypto';
import { upsertPeer, removePeer, getPeers, getStats } from './peerStore.js';
import { getDb } from '../db/index.js';
import { trackSeedingActivity } from '../rewards/tracker.js';

const DEFAULT_INTERVAL = 300;  // seconds between announces (5 min)
const MIN_INTERVAL    = 60;

/**
 * GET /announce
 *
 * Standard BitTorrent HTTP tracker announce endpoint.
 * Clients send: info_hash, peer_id, port, uploaded, downloaded, left, event, numwant, compact
 */
export async function handleAnnounce(req, res) {
  try {
    // Must parse query string with latin1 — the default UTF-8 parser corrupts
    // binary info_hash/peer_id bytes (e.g. %c3%a9 becomes one char instead of two).
    const q = parseTrackerQuery(req.url);

    const {
      info_hash,
      peer_id,
      port,
      uploaded   = '0',
      downloaded = '0',
      left       = '0',
      event      = '',
      numwant    = '50',
      compact    = '1',
      passkey    = '',
    } = q;

    // Validate required fields
    if (!info_hash || !peer_id || !port) {
      return sendError(res, 'Missing required fields: info_hash, peer_id, port');
    }

    // peer_id must be exactly 20 bytes; use Buffer to count bytes, not JS chars
    if (Buffer.byteLength(peer_id, 'binary') !== 20) {
      return sendError(res, 'Invalid peer_id: must be 20 bytes');
    }

    const infoHashHex = bufferToHex(info_hash);
    // info_hash must decode to a 40-char hex SHA1
    if (infoHashHex.length !== 40) {
      return sendError(res, 'Invalid info_hash length');
    }

    const peerIdStr   = peer_id;
    const leftInt     = Math.max(0, parseInt(left, 10) || 0);
    const uploadedInt = Math.max(0, parseInt(uploaded, 10) || 0);
    const numwantInt  = Math.min(parseInt(numwant, 10) || 50, 200);

    // Normalize IP — map IPv6 loopback/mapped addresses to IPv4 so compact
    // peer lists work correctly when tracker and client are on the same machine.
    const rawIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const ip    = normalizeIp(rawIp);
    const portInt = parseInt(port, 10);

    // Port must be in valid range
    if (isNaN(portInt) || portInt < 1 || portInt > 65535) {
      return sendError(res, 'Invalid port');
    }

    // Handle events
    if (event === 'stopped') {
      removePeer(infoHashHex, peerIdStr);
      return res.send(bencode.encode({ interval: DEFAULT_INTERVAL, peers: compact === '1' ? Buffer.alloc(0) : [] }));
    }

    // Upsert peer
    upsertPeer(infoHashHex, peerIdStr, {
      peerId:     peerIdStr,
      ip,
      port:       portInt,
      left:       leftInt,
      uploaded:   uploadedInt,
      downloaded: parseInt(downloaded, 10),
    });

    // Update torrent stats in DB (non-blocking)
    updateTorrentStats(infoHashHex, event === 'completed').catch(() => {});

    // Auto-register peer when a valid passkey is present in the announce URL.
    // This is the primary way users link their torrent client to their account.
    if (passkey) {
      autoRegisterPeer(infoHashHex, peerIdStr, passkey);
    }

    // Track seeding for reward calculation (non-blocking)
    if (leftInt === 0) {
      trackSeedingActivity({ infoHash: infoHashHex, peerId: peerIdStr, ip }).catch(() => {});
    }

    // Build peer list
    const allPeers = getPeers(infoHashHex)
      .filter(p => !(p.ip === ip && p.port === portInt)) // exclude self
      .slice(0, numwantInt);

    const { seeders, leechers } = getStats(infoHashHex);

    const response = {
      interval:     DEFAULT_INTERVAL,
      'min interval': MIN_INTERVAL,
      complete:     seeders,
      incomplete:   leechers,
      peers: compact === '1' ? buildCompactPeerList(allPeers) : buildVerbosePeerList(allPeers),
    };

    res.set('Content-Type', 'text/plain');
    res.send(bencode.encode(response));
  } catch (err) {
    console.error('[announce] Error:', err);
    sendError(res, 'Internal server error');
  }
}

async function updateTorrentStats(infoHashHex, completed) {
  const db = getDb();
  const { seeders, leechers } = getStats(infoHashHex);
  if (completed) {
    db.run(
      `UPDATE torrents SET seeders = ?, leechers = ?, completed = completed + 1, updated_at = datetime('now') WHERE info_hash = ?`,
      [seeders, leechers, infoHashHex],
    );
  } else {
    db.run(
      `UPDATE torrents SET seeders = ?, leechers = ?, updated_at = datetime('now') WHERE info_hash = ?`,
      [seeders, leechers, infoHashHex],
    );
  }
}

function buildCompactPeerList(peers) {
  // 6 bytes per peer: 4 bytes IP + 2 bytes port (IPv4 only)
  const buf = Buffer.alloc(peers.length * 6);
  let offset = 0;
  for (const peer of peers) {
    const parts = normalizeIp(peer.ip || '0.0.0.0').split('.').map(Number);
    if (parts.length !== 4 || parts.some(n => isNaN(n))) continue;
    buf[offset]     = parts[0];
    buf[offset + 1] = parts[1];
    buf[offset + 2] = parts[2];
    buf[offset + 3] = parts[3];
    buf.writeUInt16BE(peer.port, offset + 4);
    offset += 6;
  }
  return buf.slice(0, offset);
}

function buildVerbosePeerList(peers) {
  return peers.map(p => ({
    'peer id': p.peerId,
    ip:        p.ip,
    port:      p.port,
  }));
}

function bufferToHex(str) {
  // info_hash arrives as a latin1-decoded binary string — convert to hex
  return Buffer.from(str, 'binary').toString('hex');
}

/**
 * Parse a tracker announce URL's query string using latin1 (binary) decoding.
 * Express's default qs parser uses UTF-8 which merges multi-byte sequences
 * (e.g. %c3%a9 → 1 char), corrupting 20-byte info_hash and peer_id values.
 */
function parseTrackerQuery(url) {
  const qi = url.indexOf('?');
  if (qi === -1) return {};
  const params = {};
  for (const pair of url.slice(qi + 1).split('&')) {
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    const key = decodeURIComponent(pair.slice(0, eq));
    // Decode each %XX as a raw byte (latin1), never merge into UTF-8 codepoints
    const val = pair.slice(eq + 1)
      .replace(/\+/g, ' ')
      .replace(/%([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    params[key] = val;
  }
  return params;
}

/**
 * Map IPv6 loopback / IPv4-mapped addresses to plain IPv4.
 * Without this, local peers (::1) are silently dropped from compact responses.
 */
function normalizeIp(ip) {
  if (!ip) return '127.0.0.1';
  if (ip === '::1') return '127.0.0.1';
  // ::ffff:1.2.3.4  →  1.2.3.4
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return mapped[1];
  return ip;
}

/**
 * When an announce arrives with a passkey, automatically link that peer_id
 * to the matching user so reward tracking works without manual registration.
 */
function autoRegisterPeer(infoHashHex, peerIdBinary, passkey) {
  try {
    const db   = getDb();
    const user = db.queryOne(`SELECT id FROM users WHERE passkey = ?`, [passkey]);
    if (!user) return;

    const peerHex = Buffer.from(peerIdBinary, 'binary').toString('hex');
    db.run(
      `INSERT INTO peer_registrations (id, user_id, peer_id, info_hash)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(peer_id, info_hash) DO UPDATE SET user_id = excluded.user_id`,
      [randomUUID(), user.id, peerHex, infoHashHex],
    );
  } catch { /* non-critical */ }
}

function sendError(res, msg) {
  res.set('Content-Type', 'text/plain');
  res.send(bencode.encode({ 'failure reason': msg }));
}
