import { Hono } from 'hono';
import { db } from '../db/index.js';
import { orders, messages, testimonials } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { authGuard, roleGuard } from '../middleware/auth.js';

import { sendOrderUpdateEmail } from '../utils/mailer.js';

const clientApp = new Hono<{ Variables: { user: any } }>();

clientApp.use('*', authGuard);
clientApp.use('*', roleGuard(['client']));

// ── Input sanitisation ──
function sanitise(str: string): string {
  return str
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim();
}

// ── Validate submission link (Drive / Dropbox only) ──
function isValidSubmissionLink(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === 'drive.google.com' ||
      parsed.hostname === 'dropbox.com' ||
      parsed.hostname.endsWith('.dropbox.com')
    );
  } catch (e) {
    return false;
  }
}

// ── GET Orders ──
clientApp.get('/orders', async (c) => {
  try {
    const user = c.get('user');
    const clientOrders = await db.select().from(orders).where(eq(orders.clientId, user.id));
    return c.json({ data: clientOrders });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── POST Create Order ──
clientApp.post('/orders', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const serviceCategory = sanitise(body.serviceCategory || '');
    const tier = sanitise(body.tier || '');
    const price = Number(body.price) || 0;
    const description = sanitise(body.description || '');

    if (!serviceCategory || !tier || !price) {
      return c.json({ error: 'serviceCategory, tier, and price are required.' }, 400);
    }

    const newOrder = await db.insert(orders).values({
      clientId: user.id,
      serviceCategory,
      tier,
      price,
      description,
      status: 'pending_payment',
    }).returning();

    return c.json({ data: newOrder[0] }, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── POST Submit Intake Brief + Files ──
clientApp.post('/orders/:id/submit', async (c) => {
  try {
    const user = c.get('user');
    const orderId = Number(c.req.param('id'));
    const body = await c.req.json();
    const description = sanitise(body.description || '');
    const submissionLink = (body.submissionLink || '').trim();

    if (!submissionLink) {
      return c.json({ error: 'Project files link is required.' }, 400);
    }

    if (!isValidSubmissionLink(submissionLink)) {
      return c.json({
        error: 'URL must be a valid Google Drive (drive.google.com) or Dropbox (dropbox.com) link.',
      }, 400);
    }

    const orderRecord = await db.select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.clientId, user.id)))
      .limit(1);

    if (orderRecord.length === 0) {
      return c.json({ error: 'Order not found.' }, 404);
    }

    const updated = await db.update(orders).set({
      description: description || orderRecord[0].description,
      submissionLink,
      status: 'paid',
      updatedAt: new Date().toISOString(),
    }).where(eq(orders.id, orderId)).returning();

    // Send email notification to client
    sendOrderUpdateEmail(
      user.email,
      user.name,
      updated[0].id,
      'Intake Files Received & Order Confirmed',
      `Your project brief and asset link have been successfully received. Order status is now PAID & READY FOR FREELANCER ASSIGNMENT.`
    ).catch(err => {
      console.error(`❌ Failed to send order submission email to client ${user.email}:`, err);
    });

    return c.json({ data: updated[0] });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── GET Order Messages ──
clientApp.get('/orders/:id/messages', async (c) => {
  try {
    const user = c.get('user');
    const orderId = Number(c.req.param('id'));

    const orderRecord = await db.select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.clientId, user.id)))
      .limit(1);
    if (orderRecord.length === 0) return c.json({ error: 'Order not found.' }, 404);

    const orderMessages = await db.select().from(messages).where(eq(messages.orderId, orderId));
    return c.json({ data: orderMessages });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── POST Send Order Message ──
clientApp.post('/orders/:id/messages', async (c) => {
  try {
    const user = c.get('user');
    const orderId = Number(c.req.param('id'));
    const body = await c.req.json();
    const messageText = sanitise(body.messageText || '');

    if (!messageText) return c.json({ error: 'Message text is required.' }, 400);

    const orderRecord = await db.select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.clientId, user.id)))
      .limit(1);
    if (orderRecord.length === 0) return c.json({ error: 'Order not found.' }, 404);

    const newMessage = await db.insert(messages).values({
      orderId,
      senderId: user.id,
      senderRole: 'client',
      messageText,
    }).returning();

    return c.json({ data: newMessage[0] }, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── POST Testimonial ──
clientApp.post('/testimonials', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const quote = sanitise(body.quote || '');
    const stars = Number(body.stars) || 5;

    if (!quote) return c.json({ error: 'Quote is required.' }, 400);
    if (stars < 1 || stars > 5) return c.json({ error: 'Stars must be between 1 and 5.' }, 400);

    const newTestimonial = await db.insert(testimonials).values({
      name: user.name,
      role: 'Client',
      quote,
      stars,
      status: 'pending',
    }).returning();

    return c.json({ data: newTestimonial[0] }, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export default clientApp;
