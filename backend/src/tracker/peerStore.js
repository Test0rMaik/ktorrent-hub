import { config } from '../config/index.js';

/**
 * In-memory peer store for the BitTorrent tracker.
 *
 * Structure:
 *   peers: Map<infoHash, Map<peerId, PeerEntry>>
 *
 * Peers are ephemeral — they re-announce every ~30 min.
 * Seeder stats are periodically flushed to SQLite via rewardTracker.
 */

const peers = new Map();

export function upsertPeer(infoHash, peerId, entry) {
  if (!peers.has(infoHash)) peers.set(infoHash, new Map());
  peers.get(infoHash).set(peerId, { ...entry, lastSeen: Date.now() });
}

export function removePeer(infoHash, peerId) {
  peers.get(infoHash)?.delete(peerId);
  if (peers.get(infoHash)?.size === 0) peers.delete(infoHash);
}

export function getPeers(infoHash) {
  return peers.get(infoHash) ? [...peers.get(infoHash).values()] : [];
}

export function getStats(infoHash) {
  const list = getPeers(infoHash);
  const seeders  = list.filter(p => p.left === 0).length;
  const leechers = list.filter(p => p.left > 0).length;
  return { seeders, leechers };
}

export function getAllInfoHashes() {
  return [...peers.keys()];
}

/** Remove peers that haven't announced within TTL seconds. */
export function cleanupExpiredPeers() {
  const cutoff = Date.now() - config.tracker.peerTtl * 1000;
  let removed = 0;
  for (const [infoHash, peerMap] of peers.entries()) {
    for (const [peerId, peer] of peerMap.entries()) {
      if (peer.lastSeen < cutoff) {
        peerMap.delete(peerId);
        removed++;
      }
    }
    if (peerMap.size === 0) peers.delete(infoHash);
  }
  if (removed > 0) console.log(`[tracker] Cleaned up ${removed} expired peers`);
}

/** Start periodic cleanup. */
export function startCleanup() {
  setInterval(cleanupExpiredPeers, config.tracker.peerCleanupInterval);
}
