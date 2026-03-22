import { Router } from '../../../../backend/src/extensions/shared.js';
import { randomUUID } from 'crypto';
import { getDb } from '../../../../backend/src/db/index.js';
import { requireAuth, optionalAuth } from '../../../../backend/src/api/middleware/auth.js';
import { requireAdmin } from '../../../../backend/src/api/middleware/admin.js';

const router = Router();

// ── Ensure forum tables exist ─────────────────────────────
function ensureTables() {
  const db = getDb();
  db.run(`
    CREATE TABLE IF NOT EXISTS forum_categories (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS forum_threads (
      id            TEXT PRIMARY KEY,
      category_id   TEXT NOT NULL REFERENCES forum_categories(id) ON DELETE CASCADE,
      author_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title         TEXT NOT NULL,
      is_pinned     INTEGER NOT NULL DEFAULT 0,
      is_locked     INTEGER NOT NULL DEFAULT 0,
      reply_count   INTEGER NOT NULL DEFAULT 0,
      last_post_at  TEXT NOT NULL DEFAULT (datetime('now')),
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_forum_threads_cat ON forum_threads(category_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_forum_threads_last ON forum_threads(last_post_at DESC)`);
  db.run(`
    CREATE TABLE IF NOT EXISTS forum_posts (
      id          TEXT PRIMARY KEY,
      thread_id   TEXT NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
      author_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body        TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_forum_posts_thread ON forum_posts(thread_id)`);
}

// Run table creation on import
ensureTables();

// ── GET /api/ext/forum/categories ─────────────────────────
// Public: list forum categories with thread counts.
router.get('/categories', (req, res) => {
  const db = getDb();
  const { rows } = db.query(`
    SELECT fc.*, COUNT(ft.id) as thread_count
    FROM forum_categories fc
    LEFT JOIN forum_threads ft ON ft.category_id = fc.id
    GROUP BY fc.id
    ORDER BY fc.sort_order ASC, fc.name ASC
  `);
  res.json({ categories: rows });
});

// ── POST /api/ext/forum/categories ────────────────────────
// Admin: create a forum category.
router.post('/categories', requireAdmin, (req, res) => {
  const { name, description, sort_order } = req.body;
  if (!name || typeof name !== 'string' || name.length > 100) {
    return res.status(400).json({ error: 'Name is required (max 100 chars)' });
  }

  const id = randomUUID();
  const db = getDb();
  db.run(
    `INSERT INTO forum_categories (id, name, description, sort_order) VALUES (?, ?, ?, ?)`,
    [id, name.trim(), (description || '').trim().slice(0, 500), parseInt(sort_order, 10) || 0],
  );

  res.json({ id, name: name.trim() });
});

// ── PATCH /api/ext/forum/categories/:id ────────────────────
// Admin: update a forum category (name, description, sort_order).
router.patch('/categories/:id', requireAdmin, (req, res) => {
  const db = getDb();
  const cat = db.queryOne(`SELECT id FROM forum_categories WHERE id = ?`, [req.params.id]);
  if (!cat) return res.status(404).json({ error: 'Category not found' });

  const { name, description, sort_order } = req.body;
  const updates = [];
  const vals = [];

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim() || name.length > 100) {
      return res.status(400).json({ error: 'Name is required (max 100 chars)' });
    }
    updates.push('name = ?');
    vals.push(name.trim());
  }
  if (description !== undefined) {
    if (typeof description !== 'string' || description.length > 500) {
      return res.status(400).json({ error: 'Description max 500 chars' });
    }
    updates.push('description = ?');
    vals.push(description.trim());
  }
  if (sort_order !== undefined) {
    const n = parseInt(sort_order, 10);
    if (isNaN(n)) return res.status(400).json({ error: 'sort_order must be a number' });
    updates.push('sort_order = ?');
    vals.push(n);
  }

  if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });

  db.run(`UPDATE forum_categories SET ${updates.join(', ')} WHERE id = ?`, [...vals, req.params.id]);
  res.json({ success: true });
});

// ── DELETE /api/ext/forum/categories/:id ──────────────────
// Admin: delete a forum category and all its threads.
router.delete('/categories/:id', requireAdmin, (req, res) => {
  const db = getDb();
  db.run(`DELETE FROM forum_categories WHERE id = ?`, [req.params.id]);
  res.json({ success: true });
});

// ── GET /api/ext/forum/threads?category=&page= ───────────
// Public: list threads in a category.
router.get('/threads', (req, res) => {
  const { category, page = 1, limit = 25 } = req.query;
  const db = getDb();

  const conditions = [];
  const params = [];

  if (category) {
    conditions.push('ft.category_id = ?');
    params.push(category);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
  const offset = (Math.max(1, parseInt(page, 10)) - 1) * limitNum;

  const { rows } = db.query(`
    SELECT ft.*, u.wallet as author_wallet, u.username as author_username,
           fc.name as category_name
    FROM forum_threads ft
    JOIN users u ON u.id = ft.author_id
    JOIN forum_categories fc ON fc.id = ft.category_id
    ${where}
    ORDER BY ft.is_pinned DESC, ft.last_post_at DESC
    LIMIT ? OFFSET ?
  `, [...params, limitNum, offset]);

  const total = db.queryOne(`SELECT COUNT(*) as c FROM forum_threads ft ${where}`, params);
  res.json({ threads: rows, total: total?.c ?? 0 });
});

// ── GET /api/ext/forum/threads/:id ────────────────────────
// Public: get a thread with its posts.
router.get('/threads/:id', (req, res) => {
  const db = getDb();
  const { page = 1, limit = 30 } = req.query;

  const thread = db.queryOne(`
    SELECT ft.*, u.wallet as author_wallet, u.username as author_username,
           fc.name as category_name
    FROM forum_threads ft
    JOIN users u ON u.id = ft.author_id
    JOIN forum_categories fc ON fc.id = ft.category_id
    WHERE ft.id = ?
  `, [req.params.id]);

  if (!thread) return res.status(404).json({ error: 'Thread not found' });

  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
  const offset = (Math.max(1, parseInt(page, 10)) - 1) * limitNum;

  const { rows: posts } = db.query(`
    SELECT fp.*, u.wallet as author_wallet, u.username as author_username
    FROM forum_posts fp
    JOIN users u ON u.id = fp.author_id
    WHERE fp.thread_id = ?
    ORDER BY fp.created_at ASC
    LIMIT ? OFFSET ?
  `, [req.params.id, limitNum, offset]);

  const totalPosts = db.queryOne(
    `SELECT COUNT(*) as c FROM forum_posts WHERE thread_id = ?`,
    [req.params.id],
  );

  res.json({ thread, posts, totalPosts: totalPosts?.c ?? 0 });
});

// ── POST /api/ext/forum/threads ───────────────────────────
// Auth: create a new thread (first post is the thread body).
router.post('/threads', requireAuth, (req, res) => {
  const { categoryId, title, body } = req.body;
  if (!categoryId || !title || !body) {
    return res.status(400).json({ error: 'categoryId, title, and body are required' });
  }
  if (title.length > 200) return res.status(400).json({ error: 'Title max 200 chars' });
  if (body.length > 10_000) return res.status(400).json({ error: 'Body max 10,000 chars' });

  const db = getDb();
  const cat = db.queryOne(`SELECT id FROM forum_categories WHERE id = ?`, [categoryId]);
  if (!cat) return res.status(400).json({ error: 'Invalid category' });

  const threadId = randomUUID();
  const postId = randomUUID();

  db.run(
    `INSERT INTO forum_threads (id, category_id, author_id, title) VALUES (?, ?, ?, ?)`,
    [threadId, categoryId, req.user.id, title.trim()],
  );
  db.run(
    `INSERT INTO forum_posts (id, thread_id, author_id, body) VALUES (?, ?, ?, ?)`,
    [postId, threadId, req.user.id, body.trim()],
  );

  res.json({ threadId });
});

// ── POST /api/ext/forum/threads/:id/posts ─────────────────
// Auth: reply to a thread.
router.post('/threads/:id/posts', requireAuth, (req, res) => {
  const { body } = req.body;
  if (!body || body.length > 10_000) {
    return res.status(400).json({ error: 'Body is required (max 10,000 chars)' });
  }

  const db = getDb();
  const thread = db.queryOne(`SELECT id, is_locked FROM forum_threads WHERE id = ?`, [req.params.id]);
  if (!thread) return res.status(404).json({ error: 'Thread not found' });
  if (thread.is_locked) return res.status(403).json({ error: 'Thread is locked' });

  const postId = randomUUID();
  db.run(
    `INSERT INTO forum_posts (id, thread_id, author_id, body) VALUES (?, ?, ?, ?)`,
    [postId, req.params.id, req.user.id, body.trim()],
  );
  db.run(
    `UPDATE forum_threads SET reply_count = reply_count + 1, last_post_at = datetime('now') WHERE id = ?`,
    [req.params.id],
  );

  res.json({ postId });
});

// ── PATCH /api/ext/forum/threads/:id ──────────────────────
// Admin: pin/lock/unlock a thread.
router.patch('/threads/:id', requireAdmin, (req, res) => {
  const { is_pinned, is_locked } = req.body;
  const db = getDb();

  const updates = [];
  const vals = [];
  if (is_pinned !== undefined) { updates.push('is_pinned = ?'); vals.push(is_pinned ? 1 : 0); }
  if (is_locked !== undefined) { updates.push('is_locked = ?'); vals.push(is_locked ? 1 : 0); }
  if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });

  db.run(`UPDATE forum_threads SET ${updates.join(', ')} WHERE id = ?`, [...vals, req.params.id]);
  res.json({ success: true });
});

// ── DELETE /api/ext/forum/threads/:id ─────────────────────
// Admin: delete a thread.
router.delete('/threads/:id', requireAdmin, (req, res) => {
  const db = getDb();
  db.run(`DELETE FROM forum_threads WHERE id = ?`, [req.params.id]);
  res.json({ success: true });
});

// ── DELETE /api/ext/forum/posts/:id ───────────────────────
// Admin: delete a post.
router.delete('/posts/:id', requireAdmin, (req, res) => {
  const db = getDb();
  const post = db.queryOne(`SELECT thread_id FROM forum_posts WHERE id = ?`, [req.params.id]);
  if (post) {
    db.run(`DELETE FROM forum_posts WHERE id = ?`, [req.params.id]);
    db.run(`UPDATE forum_threads SET reply_count = MAX(0, reply_count - 1) WHERE id = ?`, [post.thread_id]);
  }
  res.json({ success: true });
});

// ── GET /api/ext/forum/stats ──────────────────────────────
// Admin: forum stats.
router.get('/stats', requireAdmin, (req, res) => {
  const db = getDb();
  const categories = db.queryOne(`SELECT COUNT(*) as c FROM forum_categories`);
  const threads = db.queryOne(`SELECT COUNT(*) as c FROM forum_threads`);
  const posts = db.queryOne(`SELECT COUNT(*) as c FROM forum_posts`);

  res.json({
    categories: categories?.c ?? 0,
    threads: threads?.c ?? 0,
    posts: posts?.c ?? 0,
  });
});

export default router;
