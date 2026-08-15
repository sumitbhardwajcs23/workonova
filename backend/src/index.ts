import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { compress } from 'hono/compress';
import { cors } from 'hono/cors';
import { db } from './db/index.js';
import { users } from './db/schema.js';
import { createClient } from 'redis';

const app = new Hono();

// Redis Client Setup (for Caching)
const redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
redis.on('error', (err) => console.log('Redis Client Error', err));
redis.connect().catch(console.error);

// Optimizations: Compression middleware (Gzip/Deflate)
app.use('*', compress());
app.use('*', cors());

// Basic Route
app.get('/', (c) => {
  return c.text('Workonova MVP Backend is running efficiently!');
});

// Example Pagination & Caching Route
app.get('/api/users', async (c) => {
  const page = Number(c.req.query('page')) || 1;
  const limit = Number(c.req.query('limit')) || 10;
  const offset = (page - 1) * limit;
  const cacheKey = `users:page:${page}:limit:${limit}`;

  try {
    // 1. Check Redis Cache
    const cachedUsers = await redis.get(cacheKey);
    if (cachedUsers) {
      return c.json({ source: 'cache', data: JSON.parse(cachedUsers) });
    }

    // 2. Query Database with pagination
    const allUsers = await db.select().from(users).limit(limit).offset(offset);
    
    // 3. Set Cache for future requests (expire in 60s)
    await redis.set(cacheKey, JSON.stringify(allUsers), { EX: 60 });

    return c.json({ source: 'database', data: allUsers });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port
});
