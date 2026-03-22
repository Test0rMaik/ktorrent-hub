/**
 * Extension loader — discovers and mounts ALL extension backend routes.
 *
 * Every extension with a backend/routes.js gets its routes mounted at
 * /api/ext/<extension-id>/ regardless of whether the extension is enabled.
 * The enabled/disabled state is a frontend-only concern (controls routes,
 * nav items, and admin panels). This avoids needing a backend restart when
 * toggling extensions in the admin panel.
 */
import { readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXTENSIONS_DIR = join(__dirname, '../../../modules/extensions');

/**
 * Dynamically import and mount all extension backend routes.
 * Call this after the database is initialised.
 *
 * @param {import('express').Express} app - Express app instance
 * @param {import('express').RequestHandler} limiter - Rate limiter middleware
 */
export async function loadExtensions(app, limiter) {
  if (!existsSync(EXTENSIONS_DIR)) return;

  const dirs = readdirSync(EXTENSIONS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const id of dirs) {
    const routePath = join(EXTENSIONS_DIR, id, 'backend', 'routes.js');
    if (!existsSync(routePath)) continue;

    try {
      const mod = await import(routePath);
      const router = mod.default;
      if (router) {
        app.use(`/api/ext/${id}`, limiter, router);
        console.log(`  [ext] Loaded extension: ${id}`);
      }
    } catch (err) {
      console.error(`  [ext] Failed to load extension ${id}:`, err.message);
    }
  }
}
