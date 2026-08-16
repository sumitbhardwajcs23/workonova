import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

// Setup connection details for PostgreSQL
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("⚠️ DATABASE_URL environment variable is not defined. PostgreSQL queries will fail until set.");
}

// Instantiate connection pool
const pool = new pg.Pool({
  connectionString,
  max: 20,                          // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,         // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 5000,    // How long to wait before timing out when connecting a new client
});

export const db = drizzle(pool, { schema });
