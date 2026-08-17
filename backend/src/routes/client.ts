import { Hono } from 'hono';
import { db } from '../db/index.js';
import { orders, messages, testimonials } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { authGuard, roleGuard } from '../middleware/auth.js';

import { sendOrderUpdateEmail, sendPaymentReceiptEmail } from '../utils/mailer.js';
import { createRazorpayOrder, verifyRazorpaySignature, getRazorpayKeyId } from '../utils/razorpay.js';

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
    const sentOrderEmail = await sendOrderUpdateEmail(
      user.email,
      user.name,
      updated[0].id,
      'Intake Files Received & Order Confirmed',
      `Your project brief and asset link have been successfully received. Order status is now PAID & READY FOR FREELANCER ASSIGNMENT.`
    );
    if (!sentOrderEmail) console.error(`❌ Failed to send order submission email to client ${user.email}`);

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

// ═══════════════════════════════════════════════════════════════
// RAZORPAY PAYMENT GATEWAY ENDPOINTS
// ═══════════════════════════════════════════════════════════════

// ── GET Razorpay Public Key ──
clientApp.get('/razorpay/key', (c) => {
  return c.json({ keyId: getRazorpayKeyId() });
});

// ── POST Create Razorpay Order ──
clientApp.post('/razorpay/create-order', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    let orderRecord: any;

    if (body.orderId) {
      const existing = await db.select().from(orders).where(and(eq(orders.id, Number(body.orderId)), eq(orders.clientId, user.id))).limit(1);
      if (existing.length === 0) return c.json({ error: 'Order not found.' }, 404);
      orderRecord = existing[0];
    } else {
      const serviceCategory = sanitise(body.serviceCategory || '');
      const tier = sanitise(body.tier || '');
      const price = Number(body.price) || 0;
      const description = sanitise(body.description || '');

      if (!serviceCategory || !tier || !price) {
        return c.json({ error: 'serviceCategory, tier, and price are required.' }, 400);
      }

      const rows = await db.insert(orders).values({
        clientId: user.id,
        serviceCategory,
        tier,
        price,
        description,
        status: 'pending_payment',
      }).returning();
      orderRecord = rows[0];
    }

    const rzpResult = await createRazorpayOrder({
      amount: orderRecord.price,
      currency: 'INR',
      receipt: `WN-ORD-${orderRecord.id}`,
      notes: {
        orderId: String(orderRecord.id),
        clientEmail: user.email,
        category: orderRecord.serviceCategory,
        tier: orderRecord.tier,
      },
    });

    if (!rzpResult.success || !rzpResult.order) {
      return c.json({ error: rzpResult.error || 'Failed to generate Razorpay payment order' }, 500);
    }

    // Save the razorpay_order_id in DB
    await db.update(orders).set({
      razorpayOrderId: rzpResult.order.id,
      updatedAt: new Date().toISOString(),
    }).where(eq(orders.id, orderRecord.id));

    return c.json({
      success: true,
      orderId: orderRecord.id,
      razorpayOrderId: rzpResult.order.id,
      amount: rzpResult.order.amount,
      currency: rzpResult.order.currency,
      keyId: rzpResult.keyId,
      serviceCategory: orderRecord.serviceCategory,
      tier: orderRecord.tier,
      client: {
        name: user.name,
        email: user.email,
        phone: user.phone || '',
      },
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── POST Verify Razorpay Payment ──
clientApp.post('/razorpay/verify-payment', async (c) => {
  try {
    const user = c.get('user');
    const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = await c.req.json();

    if (!orderId || !razorpay_order_id || !razorpay_payment_id) {
      return c.json({ error: 'Missing required Razorpay payment confirmation fields.' }, 400);
    }

    const orderRecord = await db.select().from(orders).where(and(eq(orders.id, Number(orderId)), eq(orders.clientId, user.id))).limit(1);
    if (orderRecord.length === 0) return c.json({ error: 'Order not found.' }, 404);

    // Verify cryptographic signature
    const isValid = verifyRazorpaySignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature || '',
    });

    if (!isValid) {
      return c.json({ error: 'Payment signature verification failed. Invalid transaction token.' }, 400);
    }

    // Mark order as paid
    const updated = await db.update(orders).set({
      status: 'paid',
      paymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      updatedAt: new Date().toISOString(),
    }).where(eq(orders.id, Number(orderId))).returning();

    // Insert confirmation message
    await db.insert(messages).values({
      orderId: Number(orderId),
      senderId: 0,
      senderRole: 'admin',
      messageText: `[SYSTEM] ✅ Payment of ₹${updated[0].price.toLocaleString('en-IN')} verified successfully via Razorpay (Payment ID: ${razorpay_payment_id}).`,
    });

    // Send complete branded payment receipt & invoice slip email to client
    const sentEmail = await sendPaymentReceiptEmail({
      toEmail: user.email,
      name: user.name,
      orderId: updated[0].id,
      serviceCategory: updated[0].serviceCategory,
      tier: updated[0].tier,
      amount: updated[0].price,
      paymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
    });
    if (!sentEmail) console.error(`❌ Failed to send Razorpay receipt email to ${user.email}`);

    return c.json({
      success: true,
      message: 'Payment verified successfully. Receipt slip delivered to client email.',
      data: updated[0],
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── POST Client Approve Final Work ──
clientApp.post('/orders/:id/client-approve', async (c) => {
  try {
    const user = c.get('user');
    const orderId = Number(c.req.param('id'));

    const existing = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.clientId, user.id))).limit(1);
    if (existing.length === 0) return c.json({ error: 'Order not found.' }, 404);

    const updated = await db.update(orders).set({
      status: 'client_approved',
      updatedAt: new Date().toISOString(),
    }).where(eq(orders.id, orderId)).returning();

    await db.insert(messages).values({
      orderId,
      senderId: user.id,
      senderRole: 'client',
      messageText: `[SYSTEM] ✅ Client approved and finalized the project deliverables. Ready for payout authorization.`,
    });

    return c.json({ success: true, message: 'Project approved successfully!', data: updated[0] });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── POST Client Request Revision / Revoke ──
clientApp.post('/orders/:id/client-revision', async (c) => {
  try {
    const user = c.get('user');
    const orderId = Number(c.req.param('id'));
    const body = await c.req.json();
    const comments = sanitise(body.comments || '');

    if (!comments) return c.json({ error: 'Revision feedback notes are required.' }, 400);

    const existing = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.clientId, user.id))).limit(1);
    if (existing.length === 0) return c.json({ error: 'Order not found.' }, 404);

    const updated = await db.update(orders).set({
      status: 'revision_requested',
      adminRevisionComments: comments,
      updatedAt: new Date().toISOString(),
    }).where(eq(orders.id, orderId)).returning();

    await db.insert(messages).values({
      orderId,
      senderId: user.id,
      senderRole: 'client',
      messageText: `[SYSTEM] 🔄 Client requested revisions: "${comments}"`,
    });

    return c.json({ success: true, message: 'Revision feedback submitted to specialist and QA team.', data: updated[0] });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export default clientApp;
