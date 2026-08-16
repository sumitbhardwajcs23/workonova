import { createClient } from 'redis';

// Structure for in-memory tracking
interface LimiterRecord {
  count: number;
  resetTime: number;
}

// In-Memory store fallback
const memoryStore = new Map<string, LimiterRecord>();

// Periodically prune expired entries to avoid memory leaks
const PRUNE_INTERVAL = 60 * 1000; // 1 minute
const pruneTimer = setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of memoryStore.entries()) {
    if (now > record.resetTime) {
      memoryStore.delete(ip);
    }
  }
}, PRUNE_INTERVAL);

// Avoid blocking process exits in testing or scripts
if (typeof pruneTimer.unref === 'function') {
  pruneTimer.unref();
}

// Redis Client initialization (lazy & optional)
let redisClient: any = null;
let redisReady = false;

const redisUrl = process.env.REDIS_URL;
if (redisUrl) {
  try {
    console.log(`🔌 Initializing Redis Rate Limiter connection to: ${redisUrl}`);
    redisClient = createClient({ url: redisUrl });
    
    redisClient.on('error', (err: any) => {
      console.error('❌ Redis Rate Limiter Client Error:', err);
    });
    
    redisClient.on('ready', () => {
      console.log('✅ Redis Rate Limiter is connected and ready.');
      redisReady = true;
    });

    redisClient.connect().catch((err: any) => {
      console.error('❌ Redis Connection Failure:', err.message || err);
    });
  } catch (err: any) {
    console.error('❌ Redis Setup Exception:', err.message || err);
  }
}

/**
 * Higher-order Hono middleware for Rate Limiting.
 * Fallbacks to in-memory sliding window if Redis is not configured or unavailable.
 */
export const rateLimiter = (options: { windowMs: number; limit: number; message: string }) => {
  const { windowMs, limit, message } = options;

  return async (c: any, next: any) => {
    // Resolve client IP address safely behind reverse proxies
    const ip = c.req.header('cf-connecting-ip') || 
               c.req.header('x-forwarded-for')?.split(',')[0].trim() || 
               c.req.header('x-real-ip') || 
               c.req.header('host') || 
               'unknown';

    const now = Date.now();

    if (redisReady && redisClient) {
      try {
        const key = `rl:${ip}`;
        const currentCount = await redisClient.incr(key);
        
        if (currentCount === 1) {
          await redisClient.expire(key, Math.ceil(windowMs / 1000));
        }

        if (currentCount > limit) {
          return c.json({ error: message }, 429);
        }
      } catch (err: any) {
        console.warn('⚠️ Redis Rate Limiter Error (falling back to memory):', err.message || err);
        const memResponse = handleMemoryLimiter(ip, now, limit, windowMs, message, c);
        if (memResponse) return memResponse;
      }
    } else {
      const memResponse = handleMemoryLimiter(ip, now, limit, windowMs, message, c);
      if (memResponse) return memResponse;
    }

    await next();
  };
};

function handleMemoryLimiter(ip: string, now: number, limit: number, windowMs: number, message: string, c: any) {
  const record = memoryStore.get(ip);

  if (!record || now > record.resetTime) {
    memoryStore.set(ip, { count: 1, resetTime: now + windowMs });
  } else {
    if (record.count >= limit) {
      return c.json({ error: message }, 429);
    }
    record.count += 1;
  }
  return null;
}
