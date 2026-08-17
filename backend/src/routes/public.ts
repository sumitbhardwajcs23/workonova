import { Hono } from 'hono';
import { db } from '../db/index.js';
import { testimonials, blogs, bundles, teamMembers } from '../db/schema.js';
import { eq, asc } from 'drizzle-orm';

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

// ── GET Blogs (no auth required — for landing page) ──
publicApp.get('/blogs', async (c) => {
  try {
    const list = await db.select().from(blogs);
    return c.json({ data: list });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── GET Bundles (no auth required — for landing page) ──
publicApp.get('/bundles', async (c) => {
  try {
    const list = await db.select().from(bundles);
    // Parse features JSON string to actual array if stored as string
    const parsed = list.map(b => ({
      ...b,
      features: typeof b.features === 'string' ? JSON.parse(b.features) : b.features,
      popular: b.popular === 1
    }));
    return c.json({ data: parsed });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── GET Team Members (no auth required — for landing page) ──
publicApp.get('/team', async (c) => {
  try {
    const list = await db.select().from(teamMembers).orderBy(asc(teamMembers.orderIndex));
    return c.json({ data: list });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export default publicApp;


