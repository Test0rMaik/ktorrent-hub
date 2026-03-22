/**
 * Theme registry — imports all themes from modules/themes/.
 * Each theme provides CSS custom-property overrides.
 */
import '../../../modules/themes/default/theme.css';
import '../../../modules/themes/cyberpunk/theme.css';

import defaultManifest from '../../../modules/themes/default/manifest.json';
import cyberpunkManifest from '../../../modules/themes/cyberpunk/manifest.json';

export const themes = [
  defaultManifest,
  cyberpunkManifest,
];

export function getThemeById(id) {
  return themes.find(t => t.id === id) || themes[0];
}
