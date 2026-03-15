import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;

export async function initPostgres() {
  const pool = new Pool({
    host: config.db.postgres.host,
    port: config.db.postgres.port,
    database: config.db.postgres.database,
    user: config.db.postgres.user,
    password: config.db.postgres.password,
    max: 20,
  });

  // Test connection
  await pool.query('SELECT 1');

  // Run schema (PostgreSQL-compatible subset; the schema.sql uses standard SQL)
  const schema = readFileSync(resolve(__dirname, 'schema.pg.sql'), 'utf8');
  await pool.query(schema);

  return {
    async query(sql, params = []) {
      const res = await pool.query(sql, params);
      return { rows: res.rows };
    },

    async run(sql, params = []) {
      const res = await pool.query(sql, params);
      return { rows: res.rows, rowCount: res.rowCount };
    },

    async queryOne(sql, params = []) {
      const res = await pool.query(sql, params);
      return res.rows[0];
    },

    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },

    type: 'postgres',
    pool,
  };
}
