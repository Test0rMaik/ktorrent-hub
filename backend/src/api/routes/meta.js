import { Router } from 'express';
import { getDb } from '../../db/index.js';
import { getEnabledCategories, getSetting } from '../../db/settings.js';
import { config } from '../../config/index.js';

const router = Router();

// ── GET /api/meta/site ──────────────────────────────────────
// Public site settings needed by the frontend (no sensitive data).
router.get('/site', (req, res) => {
  const logoPath = getSetting('site_logo');
  res.json({
    adminOnlyUploads:     !!getSetting('admin_only_uploads'),
    showFeaturesSection:  getSetting('show_features_section') !== false,
    showHeroSection:      getSetting('show_hero_section') !== false,
    rewardsEnabled:       getSetting('rewards_enabled') !== false,
    heroTitle:            getSetting('hero_title') || '',
    heroSubtitle:         getSetting('hero_subtitle') || '',
    siteName:         getSetting('site_name'),
    siteDescription:  getSetting('site_description'),
    announcement:     getSetting('announcement') || null,
    logoUrl:          logoPath || null,
    tokenId:          config.rewards.tokenId,
    tokenPrecision:   config.rewards.tokenPrecision,
    homeLatestCount:  getSetting('home_latest_count') ?? 8,
    homeHotCount:     getSetting('home_hot_count')    ?? 8,
  });
});

// ── GET /api/meta/categories ────────────────────────────────
router.get('/categories', (req, res) => {
  const db = getDb();
  const counts = {};
  const { rows } = db.query(
    `SELECT category, COUNT(*) as count FROM torrents WHERE status = 'active' GROUP BY category`,
  );
  for (const row of rows) counts[row.category] = row.count;

  res.json({
    categories: getEnabledCategories().map(c => ({ ...c, count: counts[c.id] ?? 0 })),
  });
});

// ── GET /api/meta/stats ─────────────────────────────────────
router.get('/stats', (req, res) => {
  const db = getDb();

  const torrents  = db.queryOne(`SELECT COUNT(*) as c FROM torrents WHERE status = 'active'`);
  const users     = db.queryOne(`SELECT COUNT(*) as c FROM users`);
  const seeders   = db.queryOne(`SELECT COALESCE(SUM(seeders), 0) as c FROM torrents WHERE status = 'active'`);
  const leechers  = db.queryOne(`SELECT COALESCE(SUM(leechers), 0) as c FROM torrents WHERE status = 'active'`);
  const completed = db.queryOne(`SELECT COALESCE(SUM(completed), 0) as c FROM torrents WHERE status = 'active'`);

  res.json({
    torrents:  torrents?.c  ?? 0,
    users:     users?.c     ?? 0,
    seeders:   seeders?.c   ?? 0,
    leechers:  leechers?.c  ?? 0,
    completed: completed?.c ?? 0,
  });
});

// ── GET /api/meta/rss?category=movies ──────────────────────
router.get('/rss', (req, res) => {
  const { category } = req.query;
  const db = getDb();

  const conditions = [`t.status = 'active'`];
  const params     = [];
  if (category && category !== 'all') {
    // Only allow filtering by enabled categories — prevents disabled category enumeration
    const enabledIds = getEnabledCategories().map(c => c.id);
    if (!enabledIds.includes(category)) {
      return res.status(400).json({ error: 'Invalid or disabled category' });
    }
    conditions.push('t.category = ?');
    params.push(category);
  }

  const { rows } = db.query(
    `SELECT t.id, t.name, t.description, t.category, t.size, t.magnet, t.created_at,
            u.username, u.wallet
     FROM torrents t JOIN users u ON u.id = t.uploader_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY t.created_at DESC LIMIT 100`,
    params,
  );

  const items = rows.map(t => `
    <item>
      <title>${escapeXml(t.name)}</title>
      <description>${escapeXml(t.description || '')}</description>
      <category>${escapeXml(t.category)}</category>
      <pubDate>${new Date(t.created_at).toUTCString()}</pubDate>
      <guid>${t.id}</guid>
      ${t.magnet ? `<link>${escapeXml(t.magnet)}</link>` : ''}
      <torrent:contentLength>${t.size}</torrent:contentLength>
    </item>`).join('');

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:torrent="https://github.com/klever-torrent-hub">
  <channel>
    <title>${escapeXml(getSetting('site_name') || 'KleverTorrentHub')}${category ? ` - ${category}` : ''}</title>
    <description>${escapeXml(getSetting('site_description') || 'Anonymous decentralised torrent tracker')}</description>
    <language>en-us</language>
    ${items}
  </channel>
</rss>`;

  res.set('Content-Type', 'application/rss+xml; charset=utf-8');
  res.send(feed);
});

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default router;
