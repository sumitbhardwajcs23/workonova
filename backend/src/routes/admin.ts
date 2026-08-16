import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { db } from '../db/index.js';
import { orders, clients, freelancers, admins, messages, testimonials } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { authGuard, roleGuard } from '../middleware/auth.js';
import { sendWelcomeEmail, sendOrderUpdateEmail } from '../utils/mailer.js';

const adminApp = new Hono<{ Variables: { user: any } }>();
adminApp.use('*', authGuard);

function sanitise(str: string): string {
  return str.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '').replace(/<[^>]*>/g, '').trim();
}

// ── GET All Orders (enriched with client + freelancer names) ──
adminApp.get('/orders', roleGuard(['admin', 'qa_admin']), async (c) => {
  try {
    const allOrders = await db.select().from(orders);

    const enriched = await Promise.all(allOrders.map(async (order) => {
      const clientRow = await db.select({ id: clients.id, name: clients.name, email: clients.email })
        .from(clients).where(eq(clients.id, order.clientId)).limit(1);

      let freelancer = null;
      if (order.freelancerId) {
        const fRow = await db.select({ id: freelancers.id, name: freelancers.name, email: freelancers.email })
          .from(freelancers).where(eq(freelancers.id, order.freelancerId)).limit(1);
        if (fRow.length > 0) freelancer = fRow[0];
      }

      return { ...order, client: clientRow[0] || null, freelancer };
    }));

    return c.json({ data: enriched });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── GET Freelancers (for assignment dropdown) ──
adminApp.get('/freelancers', roleGuard(['admin', 'qa_admin']), async (c) => {
  try {
    const list = await db.select({
      id: freelancers.id, name: freelancers.name, email: freelancers.email,
      services: freelancers.services, portfolioLink: freelancers.portfolioLink, status: freelancers.status,
    }).from(freelancers);

    return c.json({
      data: list.map(f => ({ ...f, role: 'freelancer', services: f.services ? JSON.parse(f.services) : [] }))
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── GET All Users (admin view: all 3 tables merged) ──
adminApp.get('/users', roleGuard(['admin']), async (c) => {
  try {
    const clientList     = await db.select().from(clients);
    const freelancerList = await db.select().from(freelancers);
    const adminList      = await db.select().from(admins);

    const allUsers = [
      ...clientList.map(u     => ({ ...u, role: 'client',     services: u.services ? JSON.parse(u.services) : [] })),
      ...freelancerList.map(u => ({ ...u, role: 'freelancer', services: u.services ? JSON.parse(u.services) : [] })),
      ...adminList.map(u      => ({ ...u, services: [] })),
    ];

    return c.json({ data: allUsers });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── POST Onboard New Freelancer or QA Admin ──
adminApp.post('/users', roleGuard(['admin']), async (c) => {
  try {
    const body = await c.req.json();
    const name          = sanitise(body.name || '');
    const email         = sanitise(body.email || '').toLowerCase();
    const password      = body.password || '';
    const services: string[] = Array.isArray(body.services) ? body.services : [];
    const portfolioLink = sanitise(body.portfolioLink || '');
    const role          = body.role || 'freelancer';

    if (!name || !email || !password) return c.json({ error: 'name, email, and password are required.' }, 400);
    if (!['freelancer', 'qa_admin'].includes(role)) return c.json({ error: 'Admin can only create freelancer or qa_admin accounts.' }, 400);

    const passwordHash = await bcrypt.hash(password, 10);

    let createdUser: any;
    if (role === 'qa_admin') {
      const rows = await db.insert(admins).values({ name, email, passwordHash, role: 'qa_admin', status: 'active' }).returning();
      createdUser = rows[0];
    } else {
      const rows = await db.insert(freelancers).values({
        name, email, passwordHash,
        services: services.length > 0 ? JSON.stringify(services) : null,
        portfolioLink: portfolioLink || null,
        status: 'active', emailVerified: 1, firstLogin: 1,
      }).returning();
      createdUser = rows[0];
    }

    sendWelcomeEmail(createdUser.email, createdUser.name, role).catch(err => {
      console.error(`❌ Failed to send welcome email to onboarded user ${createdUser.email}:`, err);
    });

    return c.json({ data: { id: createdUser.id, name: createdUser.name, email: createdUser.email, role, services, portfolioLink } }, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── PATCH Suspend/Activate User ──
adminApp.patch('/users/:id/status', roleGuard(['admin']), async (c) => {
  try {
    const userId = Number(c.req.param('id'));
    const { status, role } = await c.req.json();

    if (!['active', 'suspended'].includes(status)) return c.json({ error: 'Status must be active or suspended.' }, 400);

    if (role === 'client') {
      await db.update(clients).set({ status }).where(eq(clients.id, userId));
    } else if (role === 'freelancer') {
      await db.update(freelancers).set({ status }).where(eq(freelancers.id, userId));
    } else {
      await db.update(admins).set({ status }).where(eq(admins.id, userId));
    }

    return c.json({ data: { id: userId, status } });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── POST Assign Order to Freelancer ──
adminApp.post('/orders/:id/assign', roleGuard(['admin']), async (c) => {
  try {
    const orderId = Number(c.req.param('id'));
    const { freelancerId, payoutAmount } = await c.req.json();

    if (!freelancerId || payoutAmount === undefined) return c.json({ error: 'freelancerId and payoutAmount are required.' }, 400);

    const flRecord = await db.select().from(freelancers).where(eq(freelancers.id, freelancerId)).limit(1);
    if (flRecord.length === 0) return c.json({ error: 'Freelancer not found.' }, 404);

    const updated = await db.update(orders).set({
      freelancerId, freelancerPayoutAmount: payoutAmount, status: 'assigned', updatedAt: new Date().toISOString(),
    }).where(eq(orders.id, orderId)).returning();

    sendOrderUpdateEmail(flRecord[0].email, flRecord[0].name, orderId, 'New Task Assignment Available',
      `You have been assigned to Task #${orderId} (${updated[0].serviceCategory}). Log in to your freelancer portal to view task briefs and submit deliverables.`
    ).catch(err => {
      console.error(`❌ Failed to send order assignment email to freelancer ${flRecord[0].email}:`, err);
    });

    return c.json({ data: updated[0] });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── POST QA Gateway ──
adminApp.post('/orders/:id/qa', roleGuard(['admin', 'qa_admin']), async (c) => {
  try {
    const orderId = Number(c.req.param('id'));
    const body = await c.req.json();
    const action: string = body.action || '';
    const comments = sanitise(body.comments || '');
    const qaApprovedLink: string = (body.qaApprovedLink || '').trim();

    if (!action) return c.json({ error: 'action (approve, revision, reject) is required.' }, 400);

    const orderRecord = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (orderRecord.length === 0) return c.json({ error: 'Order not found.' }, 404);

    let statusUpdate = orderRecord[0].status;
    let qaLink = orderRecord[0].qaApprovedLink;
    let revComments: string | null = orderRecord[0].adminRevisionComments;

    if (action === 'approve') {
      statusUpdate = 'qa_approved';
      qaLink = qaApprovedLink || orderRecord[0].submissionLink;
      revComments = null;
    } else if (action === 'revision') {
      if (!comments) return c.json({ error: 'Comments are required when requesting a revision.' }, 400);
      statusUpdate = 'revision_requested';
      revComments = comments;
    } else if (action === 'reject') {
      statusUpdate = 'cancelled';
      revComments = comments || null;
    } else {
      return c.json({ error: 'Invalid action.' }, 400);
    }

    const updated = await db.update(orders).set({
      status: statusUpdate, qaApprovedLink: qaLink, adminRevisionComments: revComments, updatedAt: new Date().toISOString(),
    }).where(eq(orders.id, orderId)).returning();

    await db.insert(messages).values({ orderId, senderId: 0, senderRole: 'admin', messageText: `[QA SYSTEM] Action: ${action.toUpperCase()}${comments ? ` — ${comments}` : ''}` });

    // Email client on QA approve/revision
    const clientRow = await db.select().from(clients).where(eq(clients.id, updated[0].clientId)).limit(1);
    if (clientRow.length > 0) {
      if (action === 'approve') {
        sendOrderUpdateEmail(clientRow[0].email, clientRow[0].name, orderId, 'QA Approved Deliverables Available',
          'Your project deliverables have passed QA review and are now available in your client workspace portal.').catch(err => {
            console.error(`❌ Failed to send QA approval email to client ${clientRow[0].email}:`, err);
          });
      } else if (action === 'revision') {
        sendOrderUpdateEmail(clientRow[0].email, clientRow[0].name, orderId, 'Revision Requested by QA Team',
          `Our QA team requested a revision: "${comments}"`).catch(err => {
            console.error(`❌ Failed to send QA revision email to client ${clientRow[0].email}:`, err);
          });
      }
    }

    return c.json({ data: updated[0] });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── POST Release Payout ──
adminApp.post('/orders/:id/payout', roleGuard(['admin']), async (c) => {
  try {
    const orderId = Number(c.req.param('id'));
    const { markAsPaid } = await c.req.json();
    if (!markAsPaid) return c.json({ error: 'markAsPaid boolean is required.' }, 400);

    const updated = await db.update(orders).set({ status: 'delivered', updatedAt: new Date().toISOString() }).where(eq(orders.id, orderId)).returning();

    await db.insert(messages).values({ orderId, senderId: 0, senderRole: 'admin', messageText: `[SYSTEM] Payout released. Freelancer payout: ₹${updated[0].freelancerPayoutAmount?.toLocaleString() || 0}` });

    if (updated[0].freelancerId) {
      const fl = await db.select().from(freelancers).where(eq(freelancers.id, updated[0].freelancerId)).limit(1);
      if (fl.length > 0) {
        sendOrderUpdateEmail(fl[0].email, fl[0].name, orderId, 'Payout Released',
          `Payout of ₹${updated[0].freelancerPayoutAmount?.toLocaleString() || 0} has been released for Task #${orderId}.`).catch(err => {
            console.error(`❌ Failed to send payout released email to freelancer ${fl[0].email}:`, err);
          });
      }
    }

    return c.json({ data: updated[0] });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── POST Cancel Order ──
adminApp.post('/orders/:id/cancel', roleGuard(['admin']), async (c) => {
  try {
    const orderId = Number(c.req.param('id'));
    const updated = await db.update(orders).set({ status: 'cancelled', updatedAt: new Date().toISOString() }).where(eq(orders.id, orderId)).returning();
    await db.insert(messages).values({ orderId, senderId: 0, senderRole: 'admin', messageText: '[SYSTEM] Order cancelled by Master Admin.' });
    return c.json({ data: updated[0] });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── POST Revoke Task ──
adminApp.post('/orders/:id/revoke', roleGuard(['admin']), async (c) => {
  try {
    const orderId = Number(c.req.param('id'));
    const updated = await db.update(orders).set({ freelancerId: null, freelancerPayoutAmount: 0, status: 'paid', updatedAt: new Date().toISOString() }).where(eq(orders.id, orderId)).returning();
    await db.insert(messages).values({ orderId, senderId: 0, senderRole: 'admin', messageText: '[SYSTEM] Task revoked. Order returned to assignment queue.' });
    return c.json({ data: updated[0] });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── GET Order Messages ──
adminApp.get('/orders/:id/messages', roleGuard(['admin', 'qa_admin']), async (c) => {
  try {
    const orderId = Number(c.req.param('id'));
    const chats = await db.select().from(messages).where(eq(messages.orderId, orderId));
    return c.json({ data: chats });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── POST Send Relay Message ──
adminApp.post('/orders/:id/messages', roleGuard(['admin', 'qa_admin']), async (c) => {
  try {
    const user = c.get('user');
    const orderId = Number(c.req.param('id'));
    const body = await c.req.json();
    const messageText = sanitise(body.messageText || '');
    if (!messageText) return c.json({ error: 'Message text is required.' }, 400);
    const newMessage = await db.insert(messages).values({ orderId, senderId: user.id, senderRole: 'admin', messageText }).returning();
    return c.json({ data: newMessage[0] }, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── GET Testimonials ──
adminApp.get('/testimonials', roleGuard(['admin', 'qa_admin']), async (c) => {
  try {
    return c.json({ data: await db.select().from(testimonials) });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── POST Approve/Reject Testimonial ──
adminApp.post('/testimonials/:id/approve', roleGuard(['admin', 'qa_admin']), async (c) => {
  try {
    const testimonialId = Number(c.req.param('id'));
    const { approved } = await c.req.json();
    const updated = await db.update(testimonials).set({ status: approved ? 'approved' : 'rejected' }).where(eq(testimonials.id, testimonialId)).returning();
    return c.json({ data: updated[0] });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export default adminApp;
