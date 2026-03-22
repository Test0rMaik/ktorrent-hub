# Modules — Themes & Extensions

KleverTorrentHub has a modular architecture that lets you customise the tracker
with **themes** (visual styles) and **extensions** (new features). Both live
under the top-level `modules/` directory and are managed from the admin panel's
**Modules** tab.

```
modules/
  themes/           # Color themes
    default/
    cyberpunk/
  extensions/       # Feature extensions
    invite-system/
    landing-page/
    forum/
```

---

## Table of Contents

- [Themes](#themes)
  - [How themes work](#how-themes-work)
  - [Creating a new theme](#creating-a-new-theme)
  - [CSS custom properties reference](#css-custom-properties-reference)
  - [Activating a theme](#activating-a-theme)
- [Extensions](#extensions)
  - [How extensions work](#how-extensions-work)
  - [Creating a new extension](#creating-a-new-extension)
  - [Extension manifest](#extension-manifest)
  - [Frontend module interface](#frontend-module-interface)
  - [Backend routes](#backend-routes)
  - [Registering an extension](#registering-an-extension)
  - [Enabling / disabling](#enabling--disabling)
- [Built-in extensions](#built-in-extensions)
  - [Invite System](#invite-system)
  - [Landing Page](#landing-page)
  - [Forum](#forum)

---

## Themes

### How themes work

Themes override CSS custom properties that control brand and accent colours.
Tailwind classes like `bg-brand-600` and `text-accent-400` resolve to these
properties at runtime, so switching a theme recolours the entire site instantly.

The active theme is set by the admin and applied globally via a `data-theme`
attribute on the `<html>` element. The dark/light mode toggle is independent and
works alongside any colour theme.

### Creating a new theme

1. Create a directory under `modules/themes/`:

```
modules/themes/my-theme/
  manifest.json
  theme.css
```

2. Add a **manifest.json**:

```json
{
  "id": "my-theme",
  "name": "My Theme",
  "description": "A short description shown in the admin panel",
  "version": "1.0.0",
  "author": "Your Name"
}
```

3. Add a **theme.css** with your colour overrides. Values are space-separated
   RGB triplets (Tailwind needs this format for opacity support):

```css
[data-theme="my-theme"] {
  --brand-400: 251 191 36;   /* amber-400 */
  --brand-500: 245 158 11;   /* amber-500 */
  --brand-600: 217 119 6;    /* amber-600 */
  --brand-700: 180 83 9;     /* amber-700 */
  --accent-400: 244 114 182; /* pink-400 */
  --accent-500: 236 72 153;  /* pink-500 */
  --accent-600: 219 39 119;  /* pink-600 */
}
```

   You can also override surface colours to change the background palette:

```css
[data-theme="my-theme"] {
  --surface:     20 20 30;
  --surface-50:  30 30 42;
  --surface-100: 35 35 50;
  --surface-200: 42 42 60;
  --surface-300: 52 52 72;
}
```

4. Register the theme in `frontend/src/lib/themes.js`:

```js
import '../../../modules/themes/my-theme/theme.css';
import myThemeManifest from '../../../modules/themes/my-theme/manifest.json';

export const themes = [
  defaultManifest,
  cyberpunkManifest,
  myThemeManifest,         // ← add here
];
```

5. Rebuild the frontend (`npm run build` in `frontend/`).

### CSS custom properties reference

| Property | Used by | Default (default theme) |
|---|---|---|
| `--brand-400` | Primary highlights, links | `56 189 248` (sky-400) |
| `--brand-500` | Buttons, focus rings | `14 165 233` (sky-500) |
| `--brand-600` | Active buttons, toggles | `2 132 199` (sky-600) |
| `--brand-700` | Hover states | `3 105 161` (sky-700) |
| `--accent-400` | Secondary highlights, badges | `167 139 250` (violet-400) |
| `--accent-500` | Accent buttons | `139 92 246` (violet-500) |
| `--accent-600` | Accent active | `124 58 237` (violet-600) |
| `--surface` | Page background | `15 15 19` |
| `--surface-50` | Cards, panels | `26 26 34` |
| `--surface-100` | Inputs, deeper panels | `30 30 40` |
| `--surface-200` | Hover states | `37 37 48` |
| `--surface-300` | Borders | `46 46 58` |

### Activating a theme

Go to **Admin > Modules > Color Theme**, select your theme, and click
**Save Modules**. The change takes effect immediately for all visitors.

---

## Extensions

### How extensions work

An extension is a self-contained feature with optional frontend and backend
parts. The frontend part provides React routes, navigation items, and an admin
settings panel. The backend part provides Express API routes mounted at
`/api/ext/<extension-id>/`.

Extensions are **toggled on/off from the admin panel** — no code changes or
deploys needed to enable or disable a feature. Backend routes for newly enabled
extensions load on the next server restart.

### Creating a new extension

1. Create a directory under `modules/extensions/`:

```
modules/extensions/my-feature/
  manifest.json
  frontend/
    index.jsx            # Required — extension entry point
    pages/               # Your page components
      MyPage.jsx
  backend/
    routes.js            # Optional — Express router
```

### Extension manifest

`manifest.json` describes the extension for the admin UI:

```json
{
  "id": "my-feature",
  "name": "My Feature",
  "description": "What this extension does",
  "version": "1.0.0",
  "icon": "Sparkles",
  "hasBackend": true,
  "hasFrontend": true
}
```

The `id` must be unique and match the directory name. It is used as the key in
the `enabled_extensions` setting and the API mount path.

### Frontend module interface

The `frontend/index.jsx` file must default-export an object with this shape:

```js
import MyPage from './pages/MyPage';
import MyAdmin from './pages/MyAdmin';

export default {
  id: 'my-feature',

  // Routes injected into React Router
  routes: [
    { path: '/my-feature', element: <MyPage /> },
  ],

  // Items added to the header navigation (when extension is enabled)
  navItems: [
    { to: '/my-feature', label: 'My Feature' },
  ],

  // Component rendered inside the admin Modules tab (optional)
  adminPanel: MyAdmin,   // or null if no admin UI is needed
};
```

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Must match `manifest.json` id |
| `routes` | `{ path: string, element: JSX }[]` | React Router routes to inject |
| `navItems` | `{ to: string, label: string }[]` | Header nav links (shown when enabled) |
| `adminPanel` | `Component \| null` | Rendered inline in admin Modules tab |

#### Importing shared code

Extension pages can import from the core frontend using relative paths:

```js
import { api } from '../../../../../frontend/src/lib/api';
import { Button } from '../../../../../frontend/src/components/ui/Button';
import { useAuthStore } from '../../../../../frontend/src/store/authStore';
```

Use the `api` axios instance for API calls — it automatically attaches the auth
token and handles 401 auto-logout.

### Backend routes

The `backend/routes.js` file exports a default Express Router. It gets mounted
at `/api/ext/<extension-id>/` automatically:

```js
// Extensions live outside backend/node_modules, so import Router from the
// shared re-export instead of bare 'express':
import { Router } from '../../../../backend/src/extensions/shared.js';
import { getDb } from '../../../../backend/src/db/index.js';
import { requireAuth } from '../../../../backend/src/api/middleware/auth.js';
import { requireAdmin } from '../../../../backend/src/api/middleware/admin.js';

const router = Router();

router.get('/items', (req, res) => {
  // Available at GET /api/ext/my-feature/items
  res.json({ items: [] });
});

router.post('/items', requireAuth, (req, res) => {
  // Protected route — requires wallet auth
});

router.delete('/items/:id', requireAdmin, (req, res) => {
  // Admin-only route
});

export default router;
```

Available middleware:
- `requireAuth` — user must be signed in; attaches `req.user`
- `optionalAuth` — attaches `req.user` if signed in, continues otherwise
- `requireAdmin` — user must be the `OWNER_WALLET`

For database tables, create them in the routes file on import (the forum
extension does this as a reference). Use `CREATE TABLE IF NOT EXISTS` so it is
safe on repeated runs.

### Registering an extension

After creating the files, register the extension in two places:

**Frontend** — `frontend/src/lib/extensions.js`:

```js
import myFeature from '../../../modules/extensions/my-feature/frontend/index.jsx';

export const allExtensions = [
  inviteSystem,
  landingPage,
  forum,
  myFeature,          // ← add here
];
```

**No backend registration needed** — the backend loader automatically discovers
extensions from the `modules/extensions/` directory and loads routes for any
extension whose `id` appears in the `enabled_extensions` setting.

### Enabling / disabling

1. Go to **Admin > Modules**
2. Toggle the extension on or off
3. Click **Save Modules**

Changes take effect immediately — no restart needed. Backend API routes for all
extensions are always available; the enabled/disabled toggle only controls
whether the frontend shows the extension's routes, navigation items, and admin
panels.

---

## Built-in extensions

### Invite System

**ID:** `invite-system`

Lets the admin generate invite codes that new users must enter during
registration (when `require_invite` is also enabled in Settings).

Admin panel features:
- Generate 1–20 invite codes at once
- View all codes with status (available / used)
- Copy codes to clipboard
- Revoke unused codes

**API routes** (mounted at `/api/ext/invite-system/`):

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/invites` | Admin | List all invite codes |
| POST | `/invites` | Admin | Generate new codes (`{ count }`) |
| DELETE | `/invites/:code` | Admin | Revoke an unused code |
| GET | `/stats` | Admin | Invite stats (total / used / available) |

### Landing Page

**ID:** `landing-page`

Shows a customisable page at `/welcome` before users can access the main
tracker. Supports simple markdown-like formatting.

Admin panel features:
- Toggle landing page on/off
- Toggle "require login to proceed"
- Edit page title
- Edit page content with live preview
- Formatting: `# headings`, `**bold**`, `*italic*`, `![alt](image-url)`, `---` rules

**API routes** (mounted at `/api/ext/landing-page/`):

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/content` | Public | Get landing page content for display |
| GET | `/settings` | Admin | Get all landing page settings |
| PATCH | `/settings` | Admin | Update settings (`{ title, content, enabled, requireLogin }`) |

### Forum

**ID:** `forum`

Full discussion forum with categories, threads, and posts.

Public features:
- Browse categories and threads
- Read threads with paginated posts
- Create new threads (requires wallet auth)
- Reply to threads (requires wallet auth)

Admin panel features:
- Create / delete forum categories
- Pin / lock / delete threads
- Delete individual posts
- View forum stats

**API routes** (mounted at `/api/ext/forum/`):

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/categories` | Public | List categories with thread counts |
| POST | `/categories` | Admin | Create a category |
| DELETE | `/categories/:id` | Admin | Delete a category (cascades) |
| GET | `/threads` | Public | List threads (`?category=&page=`) |
| GET | `/threads/:id` | Public | Get thread with posts |
| POST | `/threads` | Auth | Create a thread (`{ categoryId, title, body }`) |
| POST | `/threads/:id/posts` | Auth | Reply to a thread (`{ body }`) |
| PATCH | `/threads/:id` | Admin | Pin / lock a thread |
| DELETE | `/threads/:id` | Admin | Delete a thread |
| DELETE | `/posts/:id` | Admin | Delete a post |
| GET | `/stats` | Admin | Forum stats |
