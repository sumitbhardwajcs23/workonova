import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("⚠️ DATABASE_URL environment variable is not defined. PostgreSQL queries will fail until set.");
}

const sql = neon(connectionString || '');
export const db = drizzle(sql, { schema });
