import { Hono } from 'hono';
import { db } from '../db/index.js';
import { orders, messages, freelancers } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { authGuard, roleGuard } from '../middleware/auth.js';

const freelancerApp = new Hono<{ Variables: { user: any } }>();
freelancerApp.use('*', authGuard);
freelancerApp.use('*', roleGuard(['freelancer']));

function sanitise(str: string): string {
  return str.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '').replace(/<[^>]*>/g, '').trim();
}

// ── GET Tasks (Anonymized — no client identity ever exposed) ──
freelancerApp.get('/tasks', async (c) => {
  try {
    const user = c.get('user');
    const assignedTasks = await db.select({
      id: orders.id, serviceCategory: orders.serviceCategory, tier: orders.tier,
      description: orders.description, submissionLink: orders.submissionLink,
      qaApprovedLink: orders.qaApprovedLink, status: orders.status,
      freelancerPayoutAmount: orders.freelancerPayoutAmount,
      adminRevisionComments: orders.adminRevisionComments,
      createdAt: orders.createdAt, updatedAt: orders.updatedAt,
    }).from(orders).where(eq(orders.freelancerId, user.id));

    return c.json({ data: assignedTasks });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── POST Submit Task Work ──
freelancerApp.post('/tasks/:id/submit', async (c) => {
  try {
    const user = c.get('user');
    const orderId = Number(c.req.param('id'));
    const { submissionLink } = await c.req.json();
    if (!submissionLink) return c.json({ error: 'Asset submission link is required.' }, 400);

    const taskRecord = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.freelancerId, user.id))).limit(1);
    if (taskRecord.length === 0) return c.json({ error: 'Task not found or not assigned to you.' }, 404);

    const updated = await db.update(orders).set({ submissionLink, status: 'submitted', updatedAt: new Date().toISOString() }).where(eq(orders.id, orderId)).returning();

    return c.json({ data: { id: updated[0].id, status: updated[0].status } });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── GET Task Messages ──
freelancerApp.get('/tasks/:id/messages', async (c) => {
  try {
    const user = c.get('user');
    const orderId = Number(c.req.param('id'));
    const taskRecord = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.freelancerId, user.id))).limit(1);
    if (taskRecord.length === 0) return c.json({ error: 'Task not found.' }, 404);
    return c.json({ data: await db.select().from(messages).where(eq(messages.orderId, orderId)) });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── POST Send Task Message ──
freelancerApp.post('/tasks/:id/messages', async (c) => {
  try {
    const user = c.get('user');
    const orderId = Number(c.req.param('id'));
    const body = await c.req.json();
    const messageText = sanitise(body.messageText || '');
    if (!messageText) return c.json({ error: 'Message text is required.' }, 400);
    const taskRecord = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.freelancerId, user.id))).limit(1);
    if (taskRecord.length === 0) return c.json({ error: 'Task not found.' }, 404);
    const newMessage = await db.insert(messages).values({ orderId, senderId: user.id, senderRole: 'freelancer', messageText }).returning();
    return c.json({ data: newMessage[0] }, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── GET Payout History ──
freelancerApp.get('/payouts', async (c) => {
  try {
    const user = c.get('user');
    const completedTasks = await db.select({
      id: orders.id, serviceCategory: orders.serviceCategory, tier: orders.tier,
      freelancerPayoutAmount: orders.freelancerPayoutAmount, status: orders.status, updatedAt: orders.updatedAt,
    }).from(orders).where(and(eq(orders.freelancerId, user.id), eq(orders.status, 'delivered')));
    return c.json({ data: completedTasks });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── GET Freelancer Profile ──
freelancerApp.get('/profile', async (c) => {
  try {
    const user = c.get('user');
    const profile = await db.select({
      id: freelancers.id, name: freelancers.name, email: freelancers.email,
      services: freelancers.services, portfolioLink: freelancers.portfolioLink, bankDetails: freelancers.bankDetails,
    }).from(freelancers).where(eq(freelancers.id, user.id)).limit(1);

    if (profile.length === 0) return c.json({ error: 'Profile not found.' }, 404);
    const p = profile[0];
    return c.json({
      data: { ...p, role: 'freelancer', services: p.services ? JSON.parse(p.services) : [], bankDetails: p.bankDetails ? JSON.parse(p.bankDetails) : null },
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── PUT Update Freelancer Profile ──
freelancerApp.put('/profile', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const portfolioLink = sanitise(body.portfolioLink || '');
    const services: string[] = Array.isArray(body.services) ? body.services : [];
    const bankDetails = body.bankDetails ? {
      accountName:   sanitise(body.bankDetails.accountName   || ''),
      accountNumber: sanitise(body.bankDetails.accountNumber || ''),
      ifscCode:      sanitise(body.bankDetails.ifscCode      || ''),
      upiId:         sanitise(body.bankDetails.upiId         || ''),
      bankName:      sanitise(body.bankDetails.bankName      || ''),
    } : null;

    await db.update(freelancers).set({
      portfolioLink: portfolioLink || null,
      services:     services.length > 0 ? JSON.stringify(services) : null,
      bankDetails:  bankDetails ? JSON.stringify(bankDetails) : null,
    }).where(eq(freelancers.id, user.id));

    return c.json({ message: 'Profile updated successfully.' });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export default freelancerApp;
