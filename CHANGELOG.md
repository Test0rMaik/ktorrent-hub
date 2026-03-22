# Changelog

All notable changes to KleverTorrentHub will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/) and
[Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.

---

## [1.1.0] — 2026-03-22

### Added

- **Modular extension system** — self-contained extensions in `modules/extensions/` with frontend routes, nav items, admin panels, and backend API routes
- **Theme system** — swappable colour themes via CSS custom properties in `modules/themes/`; ships with Default (blue/purple) and Cyberpunk (green/pink)
- **Admin Modules tab** — enable/disable extensions and switch themes from the admin panel; changes take effect immediately
- **Invite System extension** — admin-generated invite codes, per-user invite allocation with configurable quota, invite request/approval workflow, user dashboard integration
- **Landing Page extension** — customisable gated landing page with rich text editor toolbar (bold, italic, underline, headings, links, images, lists, quotes), live preview, and login-gate option
- **Forum extension** — full discussion forum with admin-managed categories (create, edit, reorder, delete), threads (pin, lock, delete), posts, and user-facing thread creation and replies
- Invite code enforcement during wallet registration (automatic when invite-system extension is enabled)
- Extension backend routes load automatically on server start (no restart needed when toggling)
- `docs/MODULES.md` — comprehensive guide for creating themes and extensions

### Changed

- Tailwind config now uses CSS custom properties for brand/accent colours (themeable)
- `index.css` defines brand/accent CSS variable defaults alongside existing surface tokens
- Theme store supports colour themes (`setColorTheme`) in addition to dark/light mode
- Admin Settings tab: removed `require_invite` toggle (now handled by invite-system extension)
- Admin panel `invalidateQueries` calls fixed to use correct React Query v5 syntax
- Root `package.json` now includes `"type": "module"` for ESM compatibility with extension backend routes
- Extension backend files import Express Router via shared re-export (`backend/src/extensions/shared.js`)

### Fixed

- Theme CSS specificity: theme selectors use `:root[data-theme="..."]` to reliably override base `:root` variables
- Clipboard copy fallback for HTTP (non-HTTPS) contexts using legacy `execCommand('copy')`

## [1.0.1] — 2026-03-15

### Added

- User seeding rewards with configurable rate for non-uploaders
- Passkey-based torrent download with automatic peer registration

## [1.0.0] — 2026-03-14

### Added

- Initial release
- Wallet-based Ed25519 authentication via Klever Browser Extension
- Built-in HTTP BitTorrent tracker (announce + scrape)
- Token reward system with on-chain minting/transfer
- Admin dashboard with settings, torrent/user management, bans
- SQLite (default) and PostgreSQL support
- Docker deployment with nginx
- RSS feed, categories, comments, bookmarks
- Dark/light theme toggle
