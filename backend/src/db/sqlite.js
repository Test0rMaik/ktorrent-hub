import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';
import { config } from '../config/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function initSQLite() {
  const dbPath = resolve(config.db.sqlite.path);
  // Ensure the data directory exists
  mkdirSync(dirname(dbPath), { recursive: true });

  const raw = new Database(dbPath);
  raw.pragma('journal_mode = WAL');
  raw.pragma('foreign_keys = ON');

  // Run schema
  const schema = readFileSync(resolve(__dirname, 'schema.sql'), 'utf8');
  raw.exec(schema);

  /**
   * Unified adapter — mirrors the postgres adapter interface so the rest of
   * the app doesn't care which database it talks to.
   */
  return {
    /** Run a SELECT and return all rows. */
    query(sql, params = []) {
      const stmt = raw.prepare(sql);
      return { rows: stmt.all(...params) };
    },

    /** Run INSERT / UPDATE / DELETE, returns { rows, rowCount, lastID }. */
    run(sql, params = []) {
      const stmt = raw.prepare(sql);
      const info = stmt.run(...params);
      return { rows: [], rowCount: info.changes, lastID: info.lastInsertRowid };
    },

    /** Return a single row or undefined. */
    queryOne(sql, params = []) {
      const stmt = raw.prepare(sql);
      return stmt.get(...params);
    },

    /** Run multiple statements in a transaction. */
    transaction(fn) {
      return raw.transaction(fn)();
    },

    type: 'sqlite',
    raw,
  };
}
