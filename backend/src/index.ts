import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { compress } from 'hono/compress';
import { cors } from 'hono/cors';
import authApp from './routes/auth.js';
import clientApp from './routes/client.js';
import freelancerApp from './routes/freelancer.js';
import adminApp from './routes/admin.js';
import publicApp from './routes/public.js';
import { rateLimiter } from './utils/rateLimiter.js';

// ── Strict security check for production ──
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'worknova-secret-key-123456') {
    console.error('❌ FATAL: JWT_SECRET environment variable is unset or insecure in production mode!');
    process.exit(1);
  }
}

const app = new Hono();

// ── Allowed origin (set CORS_ORIGIN env var in production) ──
const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';

// ── Middleware ──
app.use('*', compress());
app.use('*', cors({
  origin: (origin) => {
    if (process.env.NODE_ENV !== 'production') {
      return origin; // Development mode allows any origin
    }
    // Strict comparison in production
    return origin === allowedOrigin ? origin : allowedOrigin;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// ── Rate Limiting (10 requests / 60s per IP) ──
const authRateLimiter = rateLimiter({
  windowMs: 60 * 1000,
  limit: 10,
  message: 'Too many login/registration attempts. Please try again in 1 minute.',
});

// Basic check route
app.get('/', (c) => {
  return c.text('Workonova MVP Backend is running efficiently!');
});

// Mount modular routes (rate-limited auth)
app.use('/api/auth/*', authRateLimiter);
app.route('/api/auth', authApp);
app.route('/api/client', clientApp);
app.route('/api/freelancer', freelancerApp);
app.route('/api/admin', adminApp);
app.route('/api/public', publicApp);

import { handle } from 'hono/aws-lambda';
import { initDatabase } from './db/init.js';

// Export handler for AWS Lambda
export const handler = handle(app);

// Run local Node server in development only (when not inside AWS Lambda)
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
  const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  initDatabase().then(() => {
    console.log(`🚀 WORKONOVA Server running on port ${port} | CORS: ${allowedOrigin}`);
    serve({ fetch: app.fetch, port });
  });
}
