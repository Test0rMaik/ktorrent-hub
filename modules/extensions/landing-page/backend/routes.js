import { Router } from '../../../../backend/src/extensions/shared.js';
import { getDb } from '../../../../backend/src/db/index.js';
import { requireAdmin } from '../../../../backend/src/api/middleware/admin.js';
import { getSetting, setSetting } from '../../../../backend/src/db/settings.js';

const router = Router();

// Ensure landing_page settings exist
const LP_DEFAULTS = {
  landing_page_content: '',           // Markdown / rich-text HTML
  landing_page_enabled: false,        // Gate the site behind the landing page
  landing_page_title: 'Welcome',
  landing_page_require_login: true,   // Require wallet login to proceed past landing
};

function getLandingSetting(key) {
  const val = getSetting(key);
  return val ?? LP_DEFAULTS[key] ?? null;
}

// ── GET /api/ext/landing-page/content ─────────────────────
// Public: returns the landing page content for display.
router.get('/content', (req, res) => {
  res.json({
    title:        getLandingSetting('landing_page_title'),
    content:      getLandingSetting('landing_page_content'),
    enabled:      getLandingSetting('landing_page_enabled'),
    requireLogin: getLandingSetting('landing_page_require_login'),
  });
});

// ── GET /api/ext/landing-page/settings ────────────────────
// Admin: get all landing page settings.
router.get('/settings', requireAdmin, (req, res) => {
  res.json({
    title:        getLandingSetting('landing_page_title'),
    content:      getLandingSetting('landing_page_content'),
    enabled:      getLandingSetting('landing_page_enabled'),
    requireLogin: getLandingSetting('landing_page_require_login'),
  });
});

// ── PATCH /api/ext/landing-page/settings ──────────────────
// Admin: update landing page settings.
router.patch('/settings', requireAdmin, (req, res) => {
  const { title, content, enabled, requireLogin } = req.body;

  if (title !== undefined) {
    if (typeof title !== 'string' || title.length > 200) {
      return res.status(400).json({ error: 'Title must be a string (max 200 chars)' });
    }
    setSetting('landing_page_title', title);
  }

  if (content !== undefined) {
    if (typeof content !== 'string' || content.length > 50_000) {
      return res.status(400).json({ error: 'Content too large (max 50KB)' });
    }
    setSetting('landing_page_content', content);
  }

  if (enabled !== undefined) {
    setSetting('landing_page_enabled', Boolean(enabled));
  }

  if (requireLogin !== undefined) {
    setSetting('landing_page_require_login', Boolean(requireLogin));
  }

  res.json({
    title:        getLandingSetting('landing_page_title'),
    content:      getLandingSetting('landing_page_content'),
    enabled:      getLandingSetting('landing_page_enabled'),
    requireLogin: getLandingSetting('landing_page_require_login'),
  });
});

export default router;
