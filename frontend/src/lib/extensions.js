/**
 * Extension registry — imports all extension frontend modules.
 *
 * Each extension exports:
 *   id:         string              — must match manifest.json id
 *   routes:     { path, element }[] — React Router routes to inject
 *   navItems:   { to, label }[]     — items to add to the header nav
 *   adminPanel: Component | null    — rendered inside the admin Modules tab
 */
import inviteSystem from '../../../modules/extensions/invite-system/frontend/index.jsx';
import landingPage  from '../../../modules/extensions/landing-page/frontend/index.jsx';
import forum        from '../../../modules/extensions/forum/frontend/index.jsx';

export const allExtensions = [
  inviteSystem,
  landingPage,
  forum,
];

/**
 * Filter extensions by enabled IDs (from site settings).
 */
export function getEnabledExtensions(enabledIds = []) {
  return allExtensions.filter(ext => enabledIds.includes(ext.id));
}
