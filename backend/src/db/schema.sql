-- ============================================================
-- KleverTorrentHub - Database Schema
-- Compatible with SQLite and PostgreSQL.
-- ============================================================

-- ── Users ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,                  -- UUID
  wallet        TEXT UNIQUE NOT NULL,              -- Klever address (klv1..., lowercase)
  username      TEXT UNIQUE,                       -- Optional display name
  bio           TEXT,
  avatar_seed   TEXT,                              -- Used to generate deterministic avatar
  uploaded      INTEGER NOT NULL DEFAULT 0,        -- Total bytes uploaded
  downloaded    INTEGER NOT NULL DEFAULT 0,
  ratio         REAL GENERATED ALWAYS AS (
                  CASE WHEN downloaded = 0 THEN uploaded
                       ELSE CAST(uploaded AS REAL) / downloaded
                  END
                ) STORED,
  total_rewards TEXT NOT NULL DEFAULT '0',         -- Lifetime KTH earned (string, 18 decimals)
  claimed_rewards TEXT NOT NULL DEFAULT '0',
  invite_code   TEXT UNIQUE,
  invited_by    TEXT REFERENCES users(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Nonces (sign-in anti-replay) ───────────────────────────────
CREATE TABLE IF NOT EXISTS nonces (
  nonce         TEXT PRIMARY KEY,
  wallet        TEXT NOT NULL,
  expires_at    TEXT NOT NULL,
  used          INTEGER NOT NULL DEFAULT 0
);

-- ── Sessions ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet        TEXT NOT NULL,
  expires_at    TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Torrents ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS torrents (
  id            TEXT PRIMARY KEY,                  -- UUID
  info_hash     TEXT UNIQUE NOT NULL,              -- 40-char hex info hash
  name          TEXT NOT NULL,
  description   TEXT,
  category      TEXT NOT NULL,
  tags          TEXT,                              -- JSON array of strings
  size          INTEGER NOT NULL DEFAULT 0,        -- Total size in bytes
  file_count    INTEGER NOT NULL DEFAULT 1,
  uploader_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  torrent_file  TEXT,                              -- Path to stored .torrent file
  magnet        TEXT,                              -- Magnet link
  poster_url    TEXT,                              -- Optional cover image URL
  is_freeleech  INTEGER NOT NULL DEFAULT 0,
  is_featured   INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'active',   -- active | deleted | pending
  seeders       INTEGER NOT NULL DEFAULT 0,
  leechers      INTEGER NOT NULL DEFAULT 0,
  completed     INTEGER NOT NULL DEFAULT 0,        -- Times completed (snatched)
  views         INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_torrents_category ON torrents(category);
CREATE INDEX IF NOT EXISTS idx_torrents_uploader ON torrents(uploader_id);
CREATE INDEX IF NOT EXISTS idx_torrents_status   ON torrents(status);
CREATE INDEX IF NOT EXISTS idx_torrents_created  ON torrents(created_at DESC);

-- ── Torrent files list ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS torrent_files (
  id          TEXT PRIMARY KEY,
  torrent_id  TEXT NOT NULL REFERENCES torrents(id) ON DELETE CASCADE,
  path        TEXT NOT NULL,
  size        INTEGER NOT NULL DEFAULT 0
);

-- ── Comments ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
  id          TEXT PRIMARY KEY,
  torrent_id  TEXT NOT NULL REFERENCES torrents(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_comments_torrent ON comments(torrent_id);

-- ── Bookmarks ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookmarks (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  torrent_id  TEXT NOT NULL REFERENCES torrents(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, torrent_id)
);

-- ── Seeding Sessions (for reward calculation) ────────────────
CREATE TABLE IF NOT EXISTS seeding_sessions (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  torrent_id      TEXT NOT NULL REFERENCES torrents(id) ON DELETE CASCADE,
  info_hash       TEXT NOT NULL,
  peer_id         TEXT NOT NULL,
  started_at      TEXT NOT NULL DEFAULT (datetime('now')),
  last_announce   TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at        TEXT,
  seed_seconds    INTEGER NOT NULL DEFAULT 0,
  rewarded_seconds INTEGER NOT NULL DEFAULT 0   -- seconds already counted for rewards
);

CREATE INDEX IF NOT EXISTS idx_seeding_user    ON seeding_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_seeding_torrent ON seeding_sessions(torrent_id);

-- ── Reward Claims (Klever KDA mints) ─────────────────────────
CREATE TABLE IF NOT EXISTS reward_claims (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet        TEXT NOT NULL,                   -- klv1... recipient address
  amount        INTEGER NOT NULL,                -- KTH minimal units (6 decimals)
  tx_hash       TEXT,                            -- Klever transaction hash
  status        TEXT NOT NULL DEFAULT 'completed', -- completed | failed
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Site Settings (admin-editable, stored in DB) ────────────
-- Each row is a key/value pair. Values are JSON-encoded strings.
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Banned Users ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bans (
  wallet     TEXT PRIMARY KEY,               -- klv1... address
  reason     TEXT,
  banned_by  TEXT NOT NULL,                  -- admin wallet
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Invites ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invites (
  code          TEXT PRIMARY KEY,
  created_by    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  used_by       TEXT REFERENCES users(id),
  used_at       TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
