import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { db } from '../db/index.js';
import { orders, clients, freelancers, admins, messages, testimonials, blogs, bundles, teamMembers, gallery } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { authGuard, roleGuard } from '../middleware/auth.js';
import { sendWelcomeEmail, sendOrderUpdateEmail, sendPayoutReleasedEmail } from '../utils/mailer.js';
import { resolveDirectImageUrl } from '../utils/imageResolver.js';

const adminApp = new Hono<{ Variables: { user: any } }>();
adminApp.use('*', authGuard);

function sanitise(str: string): string {
  return str.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '').replace(/<[^>]*>/g, '').trim();
}

// ── GET All Orders (enriched with client + freelancer names) ──
adminApp.get('/orders', roleGuard(['admin', 'qa_admin']), async (c) => {
  try {
    const [allOrders, allClients, allFreelancers] = await Promise.all([
      db.select().from(orders),
      db.select({ id: clients.id, name: clients.name, email: clients.email }).from(clients),
      db.select({ id: freelancers.id, name: freelancers.name, email: freelancers.email }).from(freelancers),
    ]);

    const clientMap = new Map(allClients.map(c => [c.id, c]));
    const freelancerMap = new Map(allFreelancers.map(f => [f.id, f]));

    const enriched = allOrders.map(order => ({
      ...order,
      client: clientMap.get(order.clientId) || null,
      freelancer: order.freelancerId ? (freelancerMap.get(order.freelancerId) || null) : null,
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

    const sent = await sendWelcomeEmail(createdUser.email, createdUser.name, role);
    if (!sent) console.error(`❌ Failed to send welcome email to onboarded user ${createdUser.email}`);

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

    const sentAssign = await sendOrderUpdateEmail(flRecord[0].email, flRecord[0].name, orderId, 'New Task Assignment Available',
      `You have been assigned to Task #${orderId} (${updated[0].serviceCategory}). Log in to your freelancer portal to view task briefs and submit deliverables.`
    );
    if (!sentAssign) console.error(`❌ Failed to send order assignment email to freelancer ${flRecord[0].email}`);

    return c.json({ data: updated[0] });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── PATCH Update Order Price & Category/Tier ──
adminApp.patch('/orders/:id/price', roleGuard(['admin', 'qa_admin']), async (c) => {
  try {
    const orderId = Number(c.req.param('id'));
    const body = await c.req.json();
    const price = Number(body.price);
    const tier = body.tier ? sanitise(body.tier) : undefined;
    const serviceCategory = body.serviceCategory ? sanitise(body.serviceCategory) : undefined;

    if (isNaN(price) || price < 0) return c.json({ error: 'Valid price is required.' }, 400);

    const updated = await db.update(orders).set({
      price,
      tier: tier || undefined,
      serviceCategory: serviceCategory || undefined,
      updatedAt: new Date().toISOString(),
    }).where(eq(orders.id, orderId)).returning();

    if (updated.length === 0) return c.json({ error: 'Order not found.' }, 404);

    await db.insert(messages).values({
      orderId,
      senderId: 0,
      senderRole: 'admin',
      messageText: `[SYSTEM] Admin customized order price to ₹${price.toLocaleString('en-IN')}${tier ? ` (${tier.toUpperCase()} tier)` : ''}.`
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
      qaLink = qaApprovedLink || orderRecord[0].freelancerSubmissionLink || orderRecord[0].submissionLink;
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
        const sentApprove = await sendOrderUpdateEmail(clientRow[0].email, clientRow[0].name, orderId, 'QA Approved Deliverables Available',
          'Your project deliverables have passed QA review and are now available in your client workspace portal for your final review & approval.');
        if (!sentApprove) console.error(`❌ Failed to send QA approval email to client ${clientRow[0].email}`);
      } else if (action === 'revision') {
        const sentRev = await sendOrderUpdateEmail(clientRow[0].email, clientRow[0].name, orderId, 'Revision Requested by QA Team',
          `Our QA team requested a revision: "${comments}"`);
        if (!sentRev) console.error(`❌ Failed to send QA revision email to client ${clientRow[0].email}`);
      }
    }

    return c.json({ data: updated[0] });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── GET Financials & Razorpay Control Panel ──
adminApp.get('/financials', roleGuard(['admin']), async (c) => {
  try {
    const [allOrders, allClients, allFreelancers] = await Promise.all([
      db.select().from(orders),
      db.select({ id: clients.id, name: clients.name, email: clients.email }).from(clients),
      db.select({ id: freelancers.id, name: freelancers.name, email: freelancers.email }).from(freelancers),
    ]);

    const clientMap = new Map(allClients.map(cl => [cl.id, cl]));
    const freelancerMap = new Map(allFreelancers.map(fl => [fl.id, fl]));

    let totalCollected = 0;
    let totalPayoutsReleased = 0;
    let pendingEscrowPayouts = 0;

    const transactions = allOrders.map(order => {
      const isPaid = order.status !== 'pending_payment' && order.status !== 'cancelled';
      if (isPaid) {
        totalCollected += (order.price || 0);
      }
      if (order.status === 'delivered') {
        totalPayoutsReleased += (order.freelancerPayoutAmount || 0);
      } else if (['client_approved', 'qa_approved', 'submitted', 'assigned'].includes(order.status)) {
        pendingEscrowPayouts += (order.freelancerPayoutAmount || 0);
      }

      return {
        id: order.id,
        clientId: order.clientId,
        client: clientMap.get(order.clientId) || null,
        freelancer: order.freelancerId ? (freelancerMap.get(order.freelancerId) || null) : null,
        serviceCategory: order.serviceCategory,
        tier: order.tier,
        price: order.price,
        freelancerPayoutAmount: order.freelancerPayoutAmount || 0,
        status: order.status,
        paymentId: order.paymentId || 'N/A',
        razorpayOrderId: order.razorpayOrderId || 'N/A',
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      };
    });

    const netPlatformRevenue = totalCollected - totalPayoutsReleased;

    return c.json({
      summary: {
        totalCollected,
        totalPayoutsReleased,
        pendingEscrowPayouts,
        netPlatformRevenue,
        totalTransactions: transactions.filter(t => t.paymentId && t.paymentId !== 'N/A').length,
      },
      transactions: transactions.sort((a, b) => b.id - a.id),
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── PUT Update Freelancer Payout Amount (Admin Regulated & Editable) ──
adminApp.put('/orders/:id/payout-amount', roleGuard(['admin']), async (c) => {
  try {
    const orderId = Number(c.req.param('id'));
    const { amount } = await c.req.json();
    const payoutAmount = Number(amount);
    if (isNaN(payoutAmount) || payoutAmount < 0) {
      return c.json({ error: 'Valid payout amount is required.' }, 400);
    }

    const existing = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (existing.length === 0) return c.json({ error: 'Order not found.' }, 404);

    const updated = await db.update(orders).set({
      freelancerPayoutAmount: payoutAmount,
      updatedAt: new Date().toISOString(),
    }).where(eq(orders.id, orderId)).returning();

    await db.insert(messages).values({
      orderId,
      senderId: 0,
      senderRole: 'admin',
      messageText: `[SYSTEM] ⚙️ Admin adjusted specialist payout to ₹${payoutAmount.toLocaleString('en-IN')}.`,
    });

    return c.json({
      success: true,
      message: `Specialist payout amount set to ₹${payoutAmount.toLocaleString('en-IN')}.`,
      data: updated[0],
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── POST Admin Approve Payout (Stage 1 of Regulation) ──
adminApp.post('/orders/:id/approve-payout', roleGuard(['admin']), async (c) => {
  try {
    const orderId = Number(c.req.param('id'));
    const existing = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (existing.length === 0) return c.json({ error: 'Order not found.' }, 404);

    const updated = await db.update(orders).set({
      payoutStatus: 'payout_approved',
      updatedAt: new Date().toISOString(),
    }).where(eq(orders.id, orderId)).returning();

    await db.insert(messages).values({
      orderId,
      senderId: 0,
      senderRole: 'admin',
      messageText: `[SYSTEM] 🛡️ Admin verified and APPROVED specialist payout of ₹${(updated[0].freelancerPayoutAmount || 0).toLocaleString('en-IN')}. Scheduled for disbursement.`,
    });

    return c.json({
      success: true,
      message: 'Payout approved by Admin.',
      data: updated[0],
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── POST Release Payout to Freelancer (Disbursement Execution) ──
adminApp.post('/orders/:id/release-payout', roleGuard(['admin']), async (c) => {
  try {
    const orderId = Number(c.req.param('id'));

    const existing = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (existing.length === 0) return c.json({ error: 'Order not found.' }, 404);

    const orderRecord = existing[0];
    if (!orderRecord.freelancerId) {
      return c.json({ error: 'No freelancer assigned to this order.' }, 400);
    }

    const updated = await db.update(orders).set({
      status: 'completed',
      payoutStatus: 'payout_released',
      payoutReleasedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).where(eq(orders.id, orderId)).returning();

    // Log in discussion
    await db.insert(messages).values({
      orderId,
      senderId: 0,
      senderRole: 'admin',
      messageText: `[SYSTEM] 💰 Admin approved and disbursed ₹${(orderRecord.freelancerPayoutAmount || 0).toLocaleString('en-IN')} milestone payout to specialist. Project complete!`,
    });

    // Notify Freelancer via Email
    const flRecord = await db.select().from(freelancers).where(eq(freelancers.id, orderRecord.freelancerId)).limit(1);
    if (flRecord.length > 0) {
      const sent = await sendPayoutReleasedEmail(
        flRecord[0].email,
        flRecord[0].name,
        orderId,
        orderRecord.freelancerPayoutAmount || 0,
        orderRecord.serviceCategory
      );
      if (!sent) console.error(`❌ Failed to send payout released email to ${flRecord[0].email}`);
    }

    return c.json({
      success: true,
      message: `Payout of ₹${(orderRecord.freelancerPayoutAmount || 0).toLocaleString('en-IN')} released to specialist successfully.`,
      data: updated[0],
    });
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
        const sentPayout = await sendOrderUpdateEmail(fl[0].email, fl[0].name, orderId, 'Payout Released',
          `Payout of ₹${updated[0].freelancerPayoutAmount?.toLocaleString() || 0} has been released for Task #${orderId}.`);
        if (!sentPayout) console.error(`❌ Failed to send payout released email to freelancer ${fl[0].email}`);
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

// ── GET Blogs (Admin management) ──
adminApp.get('/blogs', roleGuard(['admin', 'qa_admin']), async (c) => {
  try {
    const list = await db.select().from(blogs);
    return c.json({ data: list });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── POST Create Blog Post ──
adminApp.post('/blogs', roleGuard(['admin']), async (c) => {
  try {
    const body = await c.req.json();
    const title = sanitise(body.title || '');
    const author = sanitise(body.author || '');
    const content = body.content || '';
    const publishedAt = sanitise(body.publishedAt || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }));

    if (!title || !content) return c.json({ error: 'Title and content are required.' }, 400);

    const inserted = await db.insert(blogs).values({
      title,
      author: author || 'Admin',
      publishedAt,
      content,
      createdAt: new Date().toISOString()
    }).returning();

    return c.json({ data: inserted[0] }, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── PUT Update Blog Post ──
adminApp.put('/blogs/:id', roleGuard(['admin']), async (c) => {
  try {
    const blogId = Number(c.req.param('id'));
    const body = await c.req.json();
    const title = sanitise(body.title || '');
    const author = sanitise(body.author || '');
    const content = body.content || '';
    const publishedAt = sanitise(body.publishedAt || '');

    const updated = await db.update(blogs).set({
      title,
      author: author || undefined,
      publishedAt: publishedAt || undefined,
      content
    }).where(eq(blogs.id, blogId)).returning();

    return c.json({ data: updated[0] });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── DELETE Blog Post ──
adminApp.delete('/blogs/:id', roleGuard(['admin']), async (c) => {
  try {
    const blogId = Number(c.req.param('id'));
    const deleted = await db.delete(blogs).where(eq(blogs.id, blogId)).returning();
    return c.json({ data: deleted[0] });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── GET Bundles (Admin management) ──
adminApp.get('/bundles', roleGuard(['admin', 'qa_admin']), async (c) => {
  try {
    const list = await db.select().from(bundles);
    return c.json({ data: list });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── POST Create Bundle ──
adminApp.post('/bundles', roleGuard(['admin']), async (c) => {
  try {
    const body = await c.req.json();
    const category = sanitise(body.category || 'All Services');
    const tag = sanitise(body.tag || '');
    const name = sanitise(body.name || '');
    const description = sanitise(body.description || '');
    const price = sanitise(body.price || '');
    const period = sanitise(body.period || '/ Monthly');
    const features = Array.isArray(body.features) ? JSON.stringify(body.features) : '[]';
    const popular = body.popular ? 1 : 0;

    if (!name || !price) return c.json({ error: 'Name and price are required.' }, 400);

    const inserted = await db.insert(bundles).values({
      category,
      tag,
      name,
      description,
      price,
      period,
      features,
      popular,
      createdAt: new Date().toISOString()
    }).returning();

    return c.json({ data: inserted[0] }, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── PUT Update Bundle ──
adminApp.put('/bundles/:id', roleGuard(['admin']), async (c) => {
  try {
    const bundleId = Number(c.req.param('id'));
    const body = await c.req.json();
    const category = body.category ? sanitise(body.category) : undefined;
    const tag = sanitise(body.tag || '');
    const name = sanitise(body.name || '');
    const description = sanitise(body.description || '');
    const price = sanitise(body.price || '');
    const period = sanitise(body.period || '');
    const features = Array.isArray(body.features) ? JSON.stringify(body.features) : undefined;
    const popular = body.popular !== undefined ? (body.popular ? 1 : 0) : undefined;

    const updated = await db.update(bundles).set({
      category: category || undefined,
      tag: tag || undefined,
      name: name || undefined,
      description: description || undefined,
      price: price || undefined,
      period: period || undefined,
      features: features || undefined,
      popular: popular !== undefined ? popular : undefined
    }).where(eq(bundles.id, bundleId)).returning();

    return c.json({ data: updated[0] });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── DELETE Bundle ──
adminApp.delete('/bundles/:id', roleGuard(['admin']), async (c) => {
  try {
    const bundleId = Number(c.req.param('id'));
    const deleted = await db.delete(bundles).where(eq(bundles.id, bundleId)).returning();
    return c.json({ data: deleted[0] });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── GET Team Members (Admin management) ──
adminApp.get('/team', roleGuard(['admin', 'qa_admin']), async (c) => {
  try {
    const list = await db.select().from(teamMembers);
    return c.json({ data: list });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── POST Create Team Member ──
adminApp.post('/team', roleGuard(['admin']), async (c) => {
  try {
    const body = await c.req.json();
    const name = sanitise(body.name || '');
    const role = sanitise(body.role || '');
    const subtitle = sanitise(body.subtitle || '');
    const description = sanitise(body.description || '');
    const bio = body.bio || '';
    const uniqueFact = sanitise(body.uniqueFact || '');
    const rawImage = sanitise(body.image || '');
    const image = await resolveDirectImageUrl(rawImage);
    const orderIndex = Number(body.orderIndex) || 0;

    if (!name || !role) return c.json({ error: 'Name and Designation (role) are required.' }, 400);

    const inserted = await db.insert(teamMembers).values({
      name,
      role,
      subtitle,
      description,
      bio,
      uniqueFact,
      image: image || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80',
      orderIndex,
      createdAt: new Date().toISOString()
    }).returning();

    return c.json({ data: inserted[0] }, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── PUT Update Team Member ──
adminApp.put('/team/:id', roleGuard(['admin']), async (c) => {
  try {
    const memberId = Number(c.req.param('id'));
    const body = await c.req.json();
    const name = sanitise(body.name || '');
    const role = sanitise(body.role || '');
    const subtitle = sanitise(body.subtitle || '');
    const description = sanitise(body.description || '');
    const bio = body.bio || '';
    const uniqueFact = sanitise(body.uniqueFact || '');
    const rawImage = sanitise(body.image || '');
    const image = rawImage ? await resolveDirectImageUrl(rawImage) : undefined;
    const orderIndex = body.orderIndex !== undefined ? Number(body.orderIndex) : undefined;

    const updated = await db.update(teamMembers).set({
      name: name || undefined,
      role: role || undefined,
      subtitle: subtitle || undefined,
      description: description || undefined,
      bio: bio || undefined,
      uniqueFact: uniqueFact || undefined,
      image: image || undefined,
      orderIndex: orderIndex !== undefined ? orderIndex : undefined
    }).where(eq(teamMembers.id, memberId)).returning();

    return c.json({ data: updated[0] });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── DELETE Team Member ──
adminApp.delete('/team/:id', roleGuard(['admin']), async (c) => {
  try {
    const memberId = Number(c.req.param('id'));
    const deleted = await db.delete(teamMembers).where(eq(teamMembers.id, memberId)).returning();
    return c.json({ data: deleted[0] });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── GET Gallery (Admin Management) ──
adminApp.get('/gallery', roleGuard(['admin', 'qa_admin']), async (c) => {
  try {
    const list = await db.select().from(gallery);
    return c.json({ data: list });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── POST Create Gallery Item ──
adminApp.post('/gallery', roleGuard(['admin']), async (c) => {
  try {
    const body = await c.req.json();
    const title = sanitise(body.title || '');
    const category = sanitise(body.category || 'Graphic Design');
    const mediaType = body.mediaType === 'video' ? 'video' : 'image';
    const rawMediaUrl = sanitise(body.mediaUrl || '');
    const mediaUrl = mediaType === 'image' ? await resolveDirectImageUrl(rawMediaUrl) : rawMediaUrl;
    const rawThumbnailUrl = sanitise(body.thumbnailUrl || '');
    const thumbnailUrl = rawThumbnailUrl ? await resolveDirectImageUrl(rawThumbnailUrl) : (mediaType === 'image' ? mediaUrl : '');
    const description = sanitise(body.description || '');
    const clientName = sanitise(body.clientName || '');
    const featured = body.featured !== undefined ? (body.featured ? 1 : 0) : 1;
    const orderIndex = Number(body.orderIndex) || 0;

    if (!title || !mediaUrl) {
      return c.json({ error: 'Title and Media Link/URL are required.' }, 400);
    }

    const inserted = await db.insert(gallery).values({
      title,
      category,
      mediaType,
      mediaUrl,
      thumbnailUrl: thumbnailUrl || mediaUrl,
      description,
      clientName,
      featured,
      orderIndex,
      createdAt: new Date().toISOString(),
    }).returning();

    return c.json({ data: inserted[0] }, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── PUT Update Gallery Item ──
adminApp.put('/gallery/:id', roleGuard(['admin']), async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const body = await c.req.json();
    const title = body.title ? sanitise(body.title) : undefined;
    const category = body.category ? sanitise(body.category) : undefined;
    const mediaType = body.mediaType ? (body.mediaType === 'video' ? 'video' : 'image') : undefined;
    const rawMediaUrl = body.mediaUrl ? sanitise(body.mediaUrl) : undefined;
    const mediaUrl = rawMediaUrl ? ((mediaType === 'image' || (!mediaType && !body.mediaType)) ? await resolveDirectImageUrl(rawMediaUrl) : rawMediaUrl) : undefined;
    const rawThumb = body.thumbnailUrl ? sanitise(body.thumbnailUrl) : undefined;
    const thumbnailUrl = rawThumb ? await resolveDirectImageUrl(rawThumb) : undefined;
    const description = body.description !== undefined ? sanitise(body.description) : undefined;
    const clientName = body.clientName !== undefined ? sanitise(body.clientName) : undefined;
    const featured = body.featured !== undefined ? (body.featured ? 1 : 0) : undefined;
    const orderIndex = body.orderIndex !== undefined ? Number(body.orderIndex) : undefined;

    const updated = await db.update(gallery).set({
      title,
      category,
      mediaType,
      mediaUrl,
      thumbnailUrl,
      description,
      clientName,
      featured,
      orderIndex,
    }).where(eq(gallery.id, id)).returning();

    return c.json({ data: updated[0] });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── DELETE Gallery Item ──
adminApp.delete('/gallery/:id', roleGuard(['admin']), async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const deleted = await db.delete(gallery).where(eq(gallery.id, id)).returning();
    return c.json({ data: deleted[0] });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export default adminApp;


