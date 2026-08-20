import { Hono } from 'hono';
import { db } from '../db/index.js';
import { orders, messages, freelancers, clients } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { authGuard, roleGuard } from '../middleware/auth.js';
import { sendMidpointSubmittedEmail } from '../utils/mailer.js';

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
    const allOrders = await db.select({
      id: orders.id,
      serviceCategory: orders.serviceCategory,
      tier: orders.tier,
      price: orders.price,
      description: orders.description,
      submissionLink: orders.submissionLink, // Client's initial raw assets / Drive / Dropbox link
      midpointSubmissionLink: orders.midpointSubmissionLink, // 50% milestone work
      midpointSubmissionNotes: orders.midpointSubmissionNotes,
      midpointApprovedAt: orders.midpointApprovedAt,
      freelancerSubmissionLink: orders.freelancerSubmissionLink, // Freelancer's final delivered assets link
      qaApprovedLink: orders.qaApprovedLink,
      status: orders.status,
      freelancerId: orders.freelancerId,
      assignedFreelancerIds: orders.assignedFreelancerIds,
      deadline: orders.deadline,
      durationValue: orders.durationValue,
      durationUnit: orders.durationUnit,
      projectNotice: orders.projectNotice,
      assignmentStatus: orders.assignmentStatus,
      assignedAt: orders.assignedAt,
      declineReason: orders.declineReason,
      declinedBy: orders.declinedBy,
      declinedAt: orders.declinedAt,
      acceptedAt: orders.acceptedAt,
      milestoneStage: orders.milestoneStage,
      amountPaid: orders.amountPaid,
      freelancerPayoutAmount: orders.freelancerPayoutAmount,
      payoutStatus: orders.payoutStatus,
      payoutReleasedAt: orders.payoutReleasedAt,
      adminRevisionComments: orders.adminRevisionComments,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
    }).from(orders);

    const relevantTasks = allOrders.filter(ord => {
      // 1. Direct assignment accepted by or specifically assigned to this user
      if (ord.freelancerId === user.id) return true;

      // 2. Candidate in multi-specialist FCFS pool
      if (ord.assignedFreelancerIds) {
        try {
          const parsed = JSON.parse(ord.assignedFreelancerIds);
          if (Array.isArray(parsed) && parsed.includes(user.id)) {
            // If already claimed by another user, do not show in active roster
            if (ord.assignmentStatus === 'accepted' && ord.freelancerId && ord.freelancerId !== user.id) {
              return false;
            }
            return true;
          }
        } catch {}
      }

      return false;
    }).map(task => {
      let candidateCount = 1;
      try {
        if (task.assignedFreelancerIds) {
          const parsed = JSON.parse(task.assignedFreelancerIds);
          if (Array.isArray(parsed)) candidateCount = parsed.length;
        }
      } catch {}

      return {
        ...task,
        isFcfsOffer: candidateCount > 1 && task.assignmentStatus !== 'accepted',
        candidateCount,
      };
    });

    return c.json({ data: relevantTasks });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── POST Accept Assigned Project Offer (First-Come First-Serve Atomic Lock) ──
freelancerApp.post('/tasks/:id/accept', async (c) => {
  try {
    const user = c.get('user');
    const orderId = Number(c.req.param('id'));

    const taskRecords = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (taskRecords.length === 0) return c.json({ error: 'Task not found.' }, 404);

    const taskRecord = taskRecords[0];

    // Check if user is eligible candidate
    let isCandidate = taskRecord.freelancerId === user.id;
    if (!isCandidate && taskRecord.assignedFreelancerIds) {
      try {
        const parsed = JSON.parse(taskRecord.assignedFreelancerIds);
        if (Array.isArray(parsed) && parsed.includes(user.id)) {
          isCandidate = true;
        }
      } catch {}
    }

    if (!isCandidate) {
      return c.json({ error: 'Task not offered or assigned to your account.' }, 403);
    }

    // FCFS Check: Has another specialist already claimed this task?
    if (taskRecord.assignmentStatus === 'accepted' && taskRecord.freelancerId && taskRecord.freelancerId !== user.id) {
      return c.json({
        error: '⚡ This project has already been claimed by another specialist (First-Come, First-Served). Thank you for your interest!',
        claimed: true,
      }, 409);
    }

    const nowIso = new Date().toISOString();
    const updated = await db.update(orders).set({
      freelancerId: user.id,
      assignedFreelancerIds: JSON.stringify([user.id]), // Locked strictly to the winner
      assignmentStatus: 'accepted',
      acceptedAt: nowIso,
      status: 'assigned',
      updatedAt: nowIso,
    }).where(eq(orders.id, orderId)).returning();

    // Insert system message to project discussion
    try {
      await db.insert(messages).values({
        orderId,
        senderId: user.id,
        senderRole: 'freelancer',
        messageText: `[SYSTEM] 🎯 Specialist ${user.name || 'Specialist'} was the FIRST to accept Task #${orderId} (FCFS). Production is officially active!`,
      });
    } catch (msgErr) {
      console.error('Failed to log acceptance system message:', msgErr);
    }

    return c.json({
      success: true,
      message: 'Project assignment accepted! Production is now active.',
      data: updated[0],
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── POST Decline/Reject Assigned Project Offer ──
freelancerApp.post('/tasks/:id/reject', async (c) => {
  try {
    const user = c.get('user');
    const orderId = Number(c.req.param('id'));
    const body = await c.req.json().catch(() => ({}));
    const reasonOption = sanitise(body.reason || '');
    const customNote = sanitise(body.customNote || '');
    const fullReason = [reasonOption, customNote].filter(Boolean).join(' — ') || 'Schedule/Bandwidth Constraints';

    const taskRecords = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (taskRecords.length === 0) return c.json({ error: 'Task not found.' }, 404);

    const prevOrder = taskRecords[0];

    // Check candidate
    let candidateIds: number[] = [];
    try {
      if (prevOrder.assignedFreelancerIds) {
        const parsed = JSON.parse(prevOrder.assignedFreelancerIds);
        if (Array.isArray(parsed)) candidateIds = parsed;
      }
    } catch {}

    if (candidateIds.length === 0 && prevOrder.freelancerId) {
      candidateIds = [prevOrder.freelancerId];
    }

    if (!candidateIds.includes(user.id) && prevOrder.freelancerId !== user.id) {
      return c.json({ error: 'Task not assigned or offered to you.' }, 403);
    }

    const nowIso = new Date().toISOString();
    const remainingCandidates = candidateIds.filter(id => id !== user.id);

    if (remainingCandidates.length > 0) {
      // Other candidates are still invited to take the task on FCFS
      await db.update(orders).set({
        assignedFreelancerIds: JSON.stringify(remainingCandidates),
        freelancerId: (prevOrder.freelancerId === user.id) ? null : prevOrder.freelancerId,
        updatedAt: nowIso,
      }).where(eq(orders.id, orderId));

      try {
        await db.insert(messages).values({
          orderId,
          senderId: user.id,
          senderRole: 'freelancer',
          messageText: `[SYSTEM] ⚠️ Specialist ${user.name || 'Specialist'} declined the FCFS offer (Reason: "${fullReason}"). ${remainingCandidates.length} other invited specialist(s) can still accept.`,
        });
      } catch (msgErr) {
        console.error('Failed to log decline message:', msgErr);
      }
    } else {
      // No remaining candidates — reset order back to unassigned desk
      const returnStatus = (prevOrder.amountPaid && prevOrder.amountPaid > 0) ? 'paid_50' : 'paid';

      await db.update(orders).set({
        freelancerId: null,
        assignedFreelancerIds: null,
        freelancerPayoutAmount: 0,
        assignmentStatus: 'declined',
        declineReason: fullReason,
        declinedBy: user.name || 'Specialist',
        declinedAt: nowIso,
        status: returnStatus,
        updatedAt: nowIso,
      }).where(eq(orders.id, orderId));

      try {
        await db.insert(messages).values({
          orderId,
          senderId: user.id,
          senderRole: 'freelancer',
          messageText: `[SYSTEM] ⚠️ Specialist ${user.name || 'Specialist'} declined the assignment (Reason: "${fullReason}"). Order returned to Assign Desk for reassignment.`,
        });
      } catch (msgErr) {
        console.error('Failed to log decline system message:', msgErr);
      }
    }

    return c.json({
      success: true,
      message: 'Project assignment declined.',
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Alias for decline
freelancerApp.post('/tasks/:id/decline', async (c) => {
  return freelancerApp.fetch(new Request(c.req.url.replace('/decline', '/reject'), {
    method: 'POST',
    headers: c.req.raw.headers,
    body: await c.req.raw.clone().text(),
  }));
});

// ── POST Submit 50% Midpoint Work ──
freelancerApp.post('/tasks/:id/submit-midpoint', async (c) => {
  try {
    const user = c.get('user');
    const orderId = Number(c.req.param('id'));
    const body = await c.req.json();
    const midpointSubmissionLink = (body.midpointSubmissionLink || '').trim();
    const midpointSubmissionNotes = sanitise(body.midpointSubmissionNotes || '');

    if (!midpointSubmissionLink) {
      return c.json({ error: '50% Midpoint deliverable link is required.' }, 400);
    }

    const taskRecord = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.freelancerId, user.id))).limit(1);
    if (taskRecord.length === 0) return c.json({ error: 'Task not found or not assigned to you.' }, 404);

    const updated = await db.update(orders).set({
      midpointSubmissionLink,
      midpointSubmissionNotes,
      status: 'midpoint_submitted',
      updatedAt: new Date().toISOString(),
    }).where(eq(orders.id, orderId)).returning();

    await db.insert(messages).values({
      orderId,
      senderId: user.id,
      senderRole: 'freelancer',
      messageText: `[SYSTEM] 📤 Specialist uploaded 50% Midpoint Deliverable for client review: ${midpointSubmissionLink}`,
    });

    // Notify client via email
    const clientRows = await db.select().from(clients).where(eq(clients.id, taskRecord[0].clientId)).limit(1);
    if (clientRows.length > 0) {
      await sendMidpointSubmittedEmail(clientRows[0].email, clientRows[0].name, orderId, taskRecord[0].serviceCategory, midpointSubmissionNotes);
    }

    return c.json({
      success: true,
      message: '50% Midpoint deliverable submitted successfully!',
      data: updated[0],
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── POST Submit 100% Final Task Work ──
freelancerApp.post('/tasks/:id/submit', async (c) => {
  try {
    const user = c.get('user');
    const orderId = Number(c.req.param('id'));
    const { submissionLink } = await c.req.json();
    if (!submissionLink) return c.json({ error: 'Asset submission link is required.' }, 400);

    const taskRecord = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.freelancerId, user.id))).limit(1);
    if (taskRecord.length === 0) return c.json({ error: 'Task not found or not assigned to you.' }, 404);

    // Save into freelancerSubmissionLink (preserving client's original submissionLink)
    const updated = await db.update(orders).set({
      freelancerSubmissionLink: submissionLink,
      status: 'submitted',
      updatedAt: new Date().toISOString()
    }).where(eq(orders.id, orderId)).returning();

    // Insert system message to project discussion
    await db.insert(messages).values({
      orderId,
      senderId: user.id,
      senderRole: 'freelancer',
      messageText: `[SYSTEM] 📤 Specialist uploaded 100% completed final assets for QA validation review: ${submissionLink}`,
    });

    return c.json({ data: { id: updated[0].id, status: updated[0].status, freelancerSubmissionLink: updated[0].freelancerSubmissionLink } });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── GET Task Messages (Filtered for specialist & shared broadcast) ──
freelancerApp.get('/tasks/:id/messages', async (c) => {
  try {
    const user = c.get('user');
    const orderId = Number(c.req.param('id'));
    const taskRecord = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.freelancerId, user.id))).limit(1);
    if (taskRecord.length === 0) return c.json({ error: 'Task not found.' }, 404);
    
    const allMessages = await db.select().from(messages).where(eq(messages.orderId, orderId));
    const flMessages = allMessages.filter(msg => msg.targetAudience !== 'client_only' && msg.targetAudience !== 'internal');
    return c.json({ data: flMessages });
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
    const newMessage = await db.insert(messages).values({
      orderId,
      senderId: user.id,
      senderRole: 'freelancer',
      targetAudience: 'all',
      messageText,
    }).returning();
    return c.json({ data: newMessage[0] }, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── GET Payout History ──
freelancerApp.get('/payouts', async (c) => {
  try {
    const user = c.get('user');
    const allMyTasks = await db.select({
      id: orders.id,
      serviceCategory: orders.serviceCategory,
      tier: orders.tier,
      freelancerPayoutAmount: orders.freelancerPayoutAmount,
      payoutStatus: orders.payoutStatus,
      payoutReleasedAt: orders.payoutReleasedAt,
      status: orders.status,
      updatedAt: orders.updatedAt,
      createdAt: orders.createdAt,
    }).from(orders).where(eq(orders.freelancerId, user.id));

    const completedPayouts = allMyTasks.filter(t => 
      t.payoutStatus === 'payout_released' || t.status === 'completed' || t.status === 'delivered'
    );

    return c.json({ data: completedPayouts });
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
