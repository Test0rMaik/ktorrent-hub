import bencode from 'bencode';
import { getStats } from './peerStore.js';
import { getDb } from '../db/index.js';

/**
 * GET /scrape
 *
 * Standard BitTorrent scrape endpoint.
 * Returns stats for one or more torrents.
 */
export async function handleScrape(req, res) {
  try {
    const rawHashes = req.query.info_hash;
    const infoHashes = rawHashes
      ? (Array.isArray(rawHashes) ? rawHashes : [rawHashes]).map(bufferToHex)
      : [];

    const files = {};

    if (infoHashes.length === 0) {
      // Return stats for all known torrents (limited to 100)
      const db = getDb();
      const { rows } = db.query(
        `SELECT info_hash, completed FROM torrents WHERE status = 'active' LIMIT 100`,
      );
      for (const row of rows) {
        const { seeders, leechers } = getStats(row.info_hash);
        files[row.info_hash] = {
          complete:   seeders,
          incomplete: leechers,
          downloaded: row.completed,
        };
      }
    } else {
      for (const hash of infoHashes) {
        const { seeders, leechers } = getStats(hash);
        const db = getDb();
        const row = db.queryOne(`SELECT completed FROM torrents WHERE info_hash = ?`, [hash]);
        files[hash] = {
          complete:   seeders,
          incomplete: leechers,
          downloaded: row?.completed ?? 0,
        };
      }
    }

    res.set('Content-Type', 'text/plain');
    res.send(bencode.encode({ files }));
  } catch (err) {
    console.error('[scrape] Error:', err);
    res.set('Content-Type', 'text/plain');
    res.send(bencode.encode({ 'failure reason': 'Internal server error' }));
  }
}

function bufferToHex(str) {
  let hex = '';
  for (let i = 0; i < str.length; i++) {
    hex += str.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return hex;
}
