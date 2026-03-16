import { getDb } from './index.js';
import { ALL_CATEGORIES, DEFAULT_ENABLED_CATEGORIES } from '../config/index.js';

/**
 * DB-backed settings store.
 *
 * All values are JSON-serialised so a single settings table holds
 * strings, numbers, booleans, and arrays without extra columns.
 *
 * Keys and their types:
 *   enabled_categories   string[]   IDs from ALL_CATEGORIES
 *   reward_rate_per_hour number     KTH minimal units per seeding hour
 *   require_invite       boolean
 *   site_name            string
 *   site_description     string
 *   announcement         string     shown as a banner on the homepage (empty = hidden)
 */

const DEFAULTS = {
  enabled_categories:          DEFAULT_ENABLED_CATEGORIES,
  reward_rate_per_hour:        10_000_000,   // 10 KTH — uploader / primary seeder rate
  user_seeding_rewards_enabled: false,        // off by default; admin-only toggle
  user_seeding_rate_per_hour:  1_000_000,    // 1 KTH — non-uploader seeder rate (when enabled)
  require_invite:       false,
  admin_only_uploads:   false,
  site_name:            'KleverTorrentHub',
  site_description:     'Anonymous decentralised BitTorrent tracker',
  announcement:         '',
  site_logo:            '',
  show_features_section: true,
  show_hero_section:     true,
  hero_title:            '',
  hero_subtitle:         '',
  rewards_enabled:       true,
  home_latest_count:     8,
  home_hot_count:        8,
};

export function getSetting(key) {
  const db  = getDb();
  const row = db.queryOne(`SELECT value FROM settings WHERE key = ?`, [key]);
  if (!row) return DEFAULTS[key] ?? null;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

export function setSetting(key, value) {
  const db = getDb();
  db.run(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, JSON.stringify(value)],
  );
}

export function getAllSettings() {
  const db = getDb();
  const { rows } = db.query(`SELECT key, value FROM settings`);
  const result   = { ...DEFAULTS };
  for (const row of rows) {
    try { result[row.key] = JSON.parse(row.value); } catch { result[row.key] = row.value; }
  }
  return result;
}

/**
 * Returns enabled categories as full objects (with id, label, icon).
 */
export function getEnabledCategories() {
  const enabled = getSetting('enabled_categories') ?? DEFAULT_ENABLED_CATEGORIES;
  return ALL_CATEGORIES.filter(c => enabled.includes(c.id));
}
