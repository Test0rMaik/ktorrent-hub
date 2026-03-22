/**
 * Shared re-exports for extension backend routes.
 *
 * Extensions live outside backend/node_modules, so they cannot resolve
 * bare package imports like 'express'. Import from this file instead:
 *
 *   import { Router } from '../../../../backend/src/extensions/shared.js';
 */
export { Router } from 'express';
