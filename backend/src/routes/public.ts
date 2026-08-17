import { Hono } from 'hono';
import { db } from '../db/index.js';
import { testimonials, blogs, bundles, teamMembers, gallery } from '../db/schema.js';
import { eq, asc } from 'drizzle-orm';
import { resolveDirectImageUrl } from '../utils/imageResolver.js';

const publicApp = new Hono();

// ── GET Resolve Image URL (ImgBB, Google Drive, Dropbox, Imgur, etc.) ──
publicApp.get('/resolve-image', async (c) => {
  try {
    const rawUrl = c.req.query('url');
    if (!rawUrl) {
      return c.json({ error: 'URL query parameter is required' }, 400);
    }
    const directUrl = await resolveDirectImageUrl(rawUrl);
    return c.json({
      originalUrl: rawUrl,
      directUrl: directUrl || rawUrl,
      resolved: directUrl !== rawUrl
    });
  } catch (err: any) {
    return c.json({ error: err.message, directUrl: c.req.query('url') }, 500);
  }
});

// ── GET Gallery / Portfolio Media (no auth required — for landing page) ──
publicApp.get('/gallery', async (c) => {
  try {
    const list = await db.select().from(gallery).where(eq(gallery.featured, 1)).orderBy(asc(gallery.orderIndex));
    return c.json({ data: list });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

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

// ── GET Bundles (no auth required — for landing page & client portal) ──
publicApp.get('/bundles', async (c) => {
  try {
    const category = c.req.query('category');
    let query = db.select().from(bundles);
    const list = await query;
    let filtered = list;
    if (category) {
      filtered = list.filter(b => (b.category || 'All Services') === category || b.category === 'All Services');
    }
    const parsed = filtered.map(b => ({
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
