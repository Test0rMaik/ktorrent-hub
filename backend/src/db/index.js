import { config } from '../config/index.js';
import { initSQLite } from './sqlite.js';
import { initPostgres } from './postgres.js';

let db = null;

/**
 * Initialise the database adapter based on DB_TYPE config.
 * Returns a unified adapter object with query helpers.
 */
export async function initDatabase() {
  if (config.db.type === 'postgres') {
    db = await initPostgres();
  } else {
    db = await initSQLite();
  }
  console.log(`[db] Using ${config.db.type} database`);
  return db;
}

export function getDb() {
  if (!db) throw new Error('Database not initialised — call initDatabase() first');
  return db;
}
