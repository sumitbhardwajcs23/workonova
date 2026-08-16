import { Hono } from 'hono';
import { db } from '../db/index.js';
import { testimonials } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const publicApp = new Hono();

// ── GET Approved Testimonials (no auth required — for landing page) ──
publicApp.get('/testimonials', async (c) => {
  try {
    const approved = await db.select({
      id: testimonials.id,
      name: testimonials.name,
      role: testimonials.role,
      quote: testimonials.quote,
      stars: testimonials.stars,
    }).from(testimonials).where(eq(testimonials.status, 'approved'));

    return c.json({ data: approved });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export default publicApp;
