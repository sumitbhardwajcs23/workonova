import { Hono } from 'hono';
import { db } from '../db/index.js';
import { orders, messages, testimonials, freelancers } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { authGuard, roleGuard } from '../middleware/auth.js';

import { sendOrderUpdateEmail, sendPaymentReceiptEmail, sendMilestonePaymentEmail, sendMidpointApprovedEmail } from '../utils/mailer.js';
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
      milestoneStage: 1,
      amountPaid: 0,
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
      status: orderRecord[0].status,
      updatedAt: new Date().toISOString(),
    }).where(eq(orders.id, orderId)).returning();

    // Send email notification to client
    const sentOrderEmail = await sendOrderUpdateEmail(
      user.email,
      user.name,
      updated[0].id,
      'Intake Files Received & Order Confirmed',
      `Your project brief and asset link have been successfully received. Order is in production pipeline.`
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

// ── POST Client Approve 50% Midpoint Work ──
clientApp.post('/orders/:id/approve-midpoint', async (c) => {
  try {
    const user = c.get('user');
    const orderId = Number(c.req.param('id'));

    const existing = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.clientId, user.id))).limit(1);
    if (existing.length === 0) return c.json({ error: 'Order not found.' }, 404);

    const orderRecord = existing[0];
    const updated = await db.update(orders).set({
      status: 'midpoint_approved',
      midpointApprovedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).where(eq(orders.id, orderId)).returning();

    await db.insert(messages).values({
      orderId,
      senderId: user.id,
      senderRole: 'client',
      messageText: `[SYSTEM] ✅ Client approved 50% Midpoint deliverable. Unlocked Milestone 2 (25%) payment.`,
    });

    if (orderRecord.freelancerId) {
      const fl = await db.select().from(freelancers).where(eq(freelancers.id, orderRecord.freelancerId)).limit(1);
      if (fl.length > 0) {
        await sendMidpointApprovedEmail(fl[0].email, fl[0].name, orderId, orderRecord.serviceCategory);
      }
    }

    return c.json({ success: true, message: 'Midpoint work approved!', data: updated[0] });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════
// RAZORPAY PAYMENT GATEWAY ENDPOINTS (50% -> 25% -> 25% MILESTONES)
// ═══════════════════════════════════════════════════════════════

// ── POST Initiate Custom On-Demand Order (₹100 Advance Scoping Fee) ──
clientApp.post('/custom-order/initiate', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const serviceCategory = sanitise(body.serviceCategory || 'Custom Project');
    const description = sanitise(body.description || '');
    const submissionLink = (body.submissionLink || '').trim();

    if (!description) {
      return c.json({ error: 'Please describe your project requirements and scope.' }, 400);
    }

    const rows = await db.insert(orders).values({
      clientId: user.id,
      serviceCategory,
      tier: 'custom',
      price: 100, // Initial token advance price
      description,
      submissionLink: submissionLink || null,
      status: 'pending_advance',
      milestoneStage: 0,
      amountPaid: 0,
    }).returning();

    const orderRecord = rows[0];

    // Create ₹100 Advance Razorpay order
    const rzpResult = await createRazorpayOrder({
      amount: 100,
      currency: 'INR',
      receipt: `WN-CUST-${orderRecord.id}-ADV100`,
      notes: {
        orderId: String(orderRecord.id),
        type: 'custom_advance_100',
        clientEmail: user.email,
        category: serviceCategory,
      },
    });

    if (!rzpResult.success || !rzpResult.order) {
      return c.json({ error: rzpResult.error || 'Failed to generate payment gateway token' }, 500);
    }

    await db.update(orders).set({
      razorpayOrderId: rzpResult.order.id,
      updatedAt: new Date().toISOString(),
    }).where(eq(orders.id, orderRecord.id));

    return c.json({
      success: true,
      orderId: orderRecord.id,
      milestone: 0,
      milestoneTitle: '₹100 Custom Scoping & Consultation Advance',
      razorpayOrderId: rzpResult.order.id,
      amount: rzpResult.order.amount,
      currency: rzpResult.order.currency,
      keyId: rzpResult.keyId,
      serviceCategory: orderRecord.serviceCategory,
      tier: 'custom',
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

// ── GET Razorpay Public Key ──
clientApp.get('/razorpay/key', (c) => {
  return c.json({ keyId: getRazorpayKeyId() });
});

// ── POST Create Razorpay Order ──
clientApp.post('/razorpay/create-order', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const milestone = Number(body.milestone || 1); // 0 = ₹100 advance, 1 = 50%, 2 = 25%, 3 = 25%
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
        milestoneStage: 1,
        amountPaid: 0,
      }).returning();
      orderRecord = rows[0];
    }

    // Calculate milestone payment amount
    let milestoneAmount = 0;
    let milestoneTitle = '';
    if (milestone === 0 || orderRecord.status === 'pending_advance') {
      milestoneAmount = 100;
      milestoneTitle = '₹100 Custom Project Advance Token';
    } else if (milestone === 1) {
      milestoneAmount = Math.round(orderRecord.price * 0.5); // 50% upfront
      milestoneTitle = 'Milestone 1 (50% Upfront Kickoff)';
    } else if (milestone === 2) {
      milestoneAmount = Math.round(orderRecord.price * 0.25); // 25% midpoint
      milestoneTitle = 'Milestone 2 (25% Midpoint Approval)';
    } else {
      milestoneAmount = Math.max(0, orderRecord.price - (orderRecord.amountPaid || 0)); // 25% final delivery
      milestoneTitle = 'Milestone 3 (25% Final Delivery Release)';
    }

    const rzpResult = await createRazorpayOrder({
      amount: milestoneAmount,
      currency: 'INR',
      receipt: `WN-ORD-${orderRecord.id}-M${milestone}`,
      notes: {
        orderId: String(orderRecord.id),
        milestone: String(milestone),
        clientEmail: user.email,
        category: orderRecord.serviceCategory,
        tier: orderRecord.tier,
      },
    });

    if (!rzpResult.success || !rzpResult.order) {
      return c.json({ error: rzpResult.error || 'Failed to generate Razorpay payment order' }, 500);
    }

    await db.update(orders).set({
      razorpayOrderId: rzpResult.order.id,
      updatedAt: new Date().toISOString(),
    }).where(eq(orders.id, orderRecord.id));

    return c.json({
      success: true,
      orderId: orderRecord.id,
      milestone,
      milestoneTitle,
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
    const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature, milestone = 1 } = await c.req.json();

    if (!orderId || !razorpay_order_id || !razorpay_payment_id) {
      return c.json({ error: 'Missing required Razorpay payment confirmation fields.' }, 400);
    }

    const orderRecord = await db.select().from(orders).where(and(eq(orders.id, Number(orderId)), eq(orders.clientId, user.id))).limit(1);
    if (orderRecord.length === 0) return c.json({ error: 'Order not found.' }, 404);

    const targetOrder = orderRecord[0];

    const isValid = verifyRazorpaySignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature || '',
    });

    if (!isValid) {
      return c.json({ error: 'Payment signature verification failed. Invalid transaction token.' }, 400);
    }

    const currentMilestone = Number(milestone);
    let newStatus = targetOrder.status;
    let newMilestoneStage = currentMilestone;
    let paidThisMilestone = 0;
    let newAmountPaid = targetOrder.amountPaid || 0;
    let milestoneTitle = '';
    let nextStepText = '';

    if (currentMilestone === 0 || targetOrder.status === 'pending_advance') {
      paidThisMilestone = 100;
      newAmountPaid = 100;
      newStatus = 'on_demand_review';
      newMilestoneStage = 0;
      milestoneTitle = '₹100 Advance Scoping Fee';
      nextStepText = 'Brief received! Workonova Leadership will review scope requirements and issue a tailored project quote.';

      const updated = await db.update(orders).set({
        status: newStatus,
        milestoneStage: newMilestoneStage,
        amountPaid: newAmountPaid,
        paymentId: razorpay_payment_id,
        razorpayOrderId: razorpay_order_id,
        updatedAt: new Date().toISOString(),
      }).where(eq(orders.id, Number(orderId))).returning();

      await db.insert(messages).values({
        orderId: Number(orderId),
        senderId: 0,
        senderRole: 'admin',
        messageText: `[SYSTEM] ✅ ₹100 Advance Token confirmed (Payment ID: ${razorpay_payment_id}). Workonova Leadership is reviewing your custom brief and will issue your tailored project quote shortly.`,
      });

      try {
        await sendOrderUpdateEmail(
          user.email,
          user.name,
          updated[0].id,
          'Custom Project Brief Received (₹100 Advance Confirmed)',
          `Your custom project request for ${updated[0].serviceCategory} has been submitted with ₹100 advance deposit. Our engineering & creative leads will review your brief and issue a customized milestone price quote.`
        );
      } catch (emailErr) {
        console.error('Failed to send on-demand email:', emailErr);
      }

      return c.json({ data: updated[0], success: true });
    }

    if (currentMilestone === 1) {
      paidThisMilestone = Math.round(targetOrder.price * 0.5);
      newAmountPaid = paidThisMilestone;
      newStatus = targetOrder.freelancerId ? 'assigned' : 'paid_50';
      newMilestoneStage = 1;
      milestoneTitle = 'Initial Project Kickoff (50%)';
      nextStepText = 'Specialist is assigned and will deliver 50% midpoint work for your review.';
    } else if (currentMilestone === 2) {
      paidThisMilestone = Math.round(targetOrder.price * 0.25);
      newAmountPaid = Math.round(targetOrder.price * 0.75);
      newStatus = 'paid_75';
      newMilestoneStage = 2;
      milestoneTitle = '50% Midpoint Approval (25%)';
      nextStepText = 'Specialist is working on 100% final deliverables.';
    } else {
      paidThisMilestone = Math.max(0, targetOrder.price - newAmountPaid);
      newAmountPaid = targetOrder.price;
      newStatus = 'client_approved';
      newMilestoneStage = 3;
      milestoneTitle = 'Final Project Delivery (25%)';
      nextStepText = 'Project approved! Payout sent to Admin review for disbursement.';
    }

    const updated = await db.update(orders).set({
      status: newStatus,
      milestoneStage: newMilestoneStage,
      amountPaid: newAmountPaid,
      paymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      payoutStatus: currentMilestone === 3 ? 'pending_admin_approval' : targetOrder.payoutStatus,
      updatedAt: new Date().toISOString(),
    }).where(eq(orders.id, Number(orderId))).returning();

    await db.insert(messages).values({
      orderId: Number(orderId),
      senderId: 0,
      senderRole: 'admin',
      messageText: `[SYSTEM] ✅ Milestone ${currentMilestone} payment of ₹${paidThisMilestone.toLocaleString('en-IN')} received via Razorpay (Payment ID: ${razorpay_payment_id}). Total paid: ₹${newAmountPaid.toLocaleString('en-IN')}/${targetOrder.price.toLocaleString('en-IN')}.`,
    });

    await sendMilestonePaymentEmail({
      toEmail: user.email,
      name: user.name,
      orderId: updated[0].id,
      serviceCategory: updated[0].serviceCategory,
      milestoneNumber: currentMilestone,
      milestoneTitle,
      amountPaid: paidThisMilestone,
      totalOrderPrice: targetOrder.price,
      paymentId: razorpay_payment_id,
      nextStepDescription: nextStepText,
    });

    return c.json({
      success: true,
      message: `Milestone ${currentMilestone} verified successfully!`,
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
      payoutStatus: 'pending_admin_approval', // Explicitly regulated by admin
      updatedAt: new Date().toISOString(),
    }).where(eq(orders.id, orderId)).returning();

    await db.insert(messages).values({
      orderId,
      senderId: user.id,
      senderRole: 'client',
      messageText: `[SYSTEM] ✅ Client approved and finalized the project deliverables. Payout sent to Admin queue for regulation & disbursement.`,
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
