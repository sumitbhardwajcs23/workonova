import { Hono } from 'hono';
import { sign, verify } from 'hono/jwt';
import bcrypt from 'bcryptjs';
import { db } from '../db/index.js';
import { clients, freelancers, admins, otpTokens } from '../db/schema.js';
import { eq, and, gt } from 'drizzle-orm';
import { sendWelcomeEmail, sendOtpEmail, sendPasswordResetEmail, sendEmailChangeOtpEmail } from '../utils/mailer.js';

const authApp = new Hono();
export const JWT_SECRET = process.env.JWT_SECRET || 'worknova-secret-key-123456';

// ── Input sanitisation ──
function sanitise(str: string): string {
  return str.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '').replace(/<[^>]*>/g, '').trim();
}

// ── Generate 6-digit OTP ──
function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── Persist OTP to DB ──
async function persistOtp(email: string, type: 'verify_email' | 'forgot_password' | 'change_email'): Promise<string> {
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  console.log(`📧 Generated OTP for ${email} (type: ${type})`);
  // Invalidate old unused OTPs for this email+type
  await db.delete(otpTokens).where(and(eq(otpTokens.email, email), eq(otpTokens.type, type)));
  await db.insert(otpTokens).values({ email, code, type, expiresAt, used: 0 });
  return code;
}

// ── Validate OTP from DB ──
async function validateOtp(email: string, code: string, type: 'verify_email' | 'forgot_password' | 'change_email'): Promise<boolean> {
  const now = new Date().toISOString();
  const row = await db.select().from(otpTokens).where(
    and(
      eq(otpTokens.email, email),
      eq(otpTokens.code, code),
      eq(otpTokens.type, type),
      eq(otpTokens.used, 0)
    )
  ).limit(1);
  if (row.length === 0) {
    console.warn(`⚠️ OTP validation failed: No matching active code found for ${email}`);
    return false;
  }
  if (row[0].expiresAt < now) {
    console.warn(`⚠️ OTP validation failed: Code has expired for ${email}`);
    return false;
  }
  // Mark as used
  await db.update(otpTokens).set({ used: 1 }).where(eq(otpTokens.id, row[0].id));
  console.log(`✅ OTP successfully verified and invalidated for ${email}`);
  return true;
}

// ── Lookup user across all tables ──
async function findUserByEmail(email: string) {
  const client = await db.select().from(clients).where(eq(clients.email, email)).limit(1);
  if (client.length > 0) return { ...client[0], role: 'client' as const };

  const freelancer = await db.select().from(freelancers).where(eq(freelancers.email, email)).limit(1);
  if (freelancer.length > 0) return { ...freelancer[0], role: 'freelancer' as const };

  const admin = await db.select().from(admins).where(eq(admins.email, email)).limit(1);
  if (admin.length > 0) return { ...admin[0], emailVerified: 1, firstLogin: 0 };

  return null;
}

// ═══════════════════════════════════════════
// POST /api/auth/send-otp
// Sends OTP for email verification (signup flow)
// ═══════════════════════════════════════════
authApp.post('/send-otp', async (c) => {
  try {
    const { email, name } = await c.req.json();
    const cleanEmail = sanitise(email || '').toLowerCase();
    const cleanName  = sanitise(name || 'User');
    if (!cleanEmail) return c.json({ error: 'Email is required.' }, 400);

    const code = await persistOtp(cleanEmail, 'verify_email');
    const sent = await sendOtpEmail(cleanEmail, cleanName, code);
    if (!sent) console.error(`❌ Failed to send OTP email to ${cleanEmail}`);
    return c.json({ message: 'OTP sent to your email.' });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ═══════════════════════════════════════════
// POST /api/auth/verify-email
// Called with { email, otp } — marks emailVerified=1
// ═══════════════════════════════════════════
authApp.post('/verify-email', async (c) => {
  try {
    const { email, otp } = await c.req.json();
    const cleanEmail = sanitise(email || '').toLowerCase();
    if (!cleanEmail || !otp) return c.json({ error: 'Email and OTP are required.' }, 400);

    const valid = await validateOtp(cleanEmail, otp.toString().trim(), 'verify_email');
    if (!valid) return c.json({ error: 'Invalid or expired OTP. Please try again.' }, 400);

    // Mark verified in the right table
    let userRecord: any;
    let role: 'client' | 'freelancer' = 'client';

    const clientRow = await db.select().from(clients).where(eq(clients.email, cleanEmail)).limit(1);
    if (clientRow.length > 0) {
      await db.update(clients).set({ emailVerified: 1, status: 'active' }).where(eq(clients.email, cleanEmail));
      userRecord = clientRow[0];
      role = 'client';
    } else {
      const freelancerRow = await db.select().from(freelancers).where(eq(freelancers.email, cleanEmail)).limit(1);
      if (freelancerRow.length > 0) {
        await db.update(freelancers).set({ emailVerified: 1, status: 'active' }).where(eq(freelancers.email, cleanEmail));
        userRecord = freelancerRow[0];
        role = 'freelancer';
      }
    }

    if (!userRecord) return c.json({ error: 'User account not found.' }, 404);

    // Sign new fully verified token
    const token = await sign({
      id: userRecord.id,
      name: userRecord.name,
      email: userRecord.email,
      role: role,
      emailVerified: 1,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    }, JWT_SECRET, 'HS256');

    return c.json({
      token,
      message: 'Email verified successfully.',
      user: {
        id: userRecord.id,
        name: userRecord.name,
        email: userRecord.email,
        phone: userRecord.phone || null,
        role: role,
        emailVerified: 1,
      }
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ═══════════════════════════════════════════
// POST /api/auth/register
// Self-registration for clients and freelancers only
// ═══════════════════════════════════════════
authApp.post('/register', async (c) => {
  try {
    const body = await c.req.json();
    const name          = sanitise(body.name || '');
    const email         = sanitise(body.email || '').toLowerCase();
    const password      = body.password || '';
    const role          = body.role || 'client';
    const phone         = sanitise(body.phone || '').trim();
    const services      = body.services || [];
    const portfolioLink = body.portfolioLink || '';

    if (!name || !email || !password || !phone) return c.json({ error: 'Name, email, password, and phone number are required.' }, 400);
    if (!['client', 'freelancer'].includes(role)) return c.json({ error: 'Self-registration is limited to client or freelancer.' }, 400);
    if (password.length < 8) return c.json({ error: 'Password must be at least 8 characters.' }, 400);

    // Validate phone number: only allow digits and optional leading + sign (E.164 standard: 7 to 15 digits)
    const numericPhone = phone.replace(/[^\d]/g, '');
    if (numericPhone.length < 7 || numericPhone.length > 15) {
      return c.json({ error: 'Please enter a valid phone number (7 to 15 digits).' }, 400);
    }

    // Check uniqueness across all 3 tables
    const existing = await findUserByEmail(email);
    if (existing) return c.json({ error: 'An account with this email already exists.' }, 400);

    const passwordHash = await bcrypt.hash(password, 10);

    let newUser: any;
    if (role === 'client') {
      const rows = await db.insert(clients).values({
        name, email, passwordHash, phone,
        services: services.length > 0 ? JSON.stringify(services) : null,
        status: 'pending_verification',
        emailVerified: 0,
        firstLogin: 1,
      }).returning();
      newUser = { ...rows[0], role: 'client' };
    } else {
      const cappedServices = Array.isArray(services) ? services.slice(0, 4) : [];
      const rows = await db.insert(freelancers).values({
        name, email, passwordHash, phone,
        services: cappedServices.length > 0 ? JSON.stringify(cappedServices) : null,
        portfolioLink: portfolioLink || null,
        status: 'pending_verification',
        emailVerified: 0,
        firstLogin: 1,
      }).returning();
      newUser = { ...rows[0], role: 'freelancer' };
    }

    // Issue a temporary token (can access dashboard only after OTP verify)
    const token = await sign({
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      emailVerified: 0,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    }, JWT_SECRET);

    // Automatically send verification OTP on register
    const code = await persistOtp(email, 'verify_email');
    const sent = await sendOtpEmail(email, name, code);
    if (!sent) console.error(`❌ Failed to send welcome registration OTP email to ${email}`);

    return c.json({
      token,
      requiresVerification: true,
      user: { id: newUser.id, name: newUser.name, email: newUser.email, phone: newUser.phone || null, role: newUser.role, emailVerified: 0 },
    }, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ═══════════════════════════════════════════
// POST /api/auth/login
// Queries the correct table based on selected role switch
// ═══════════════════════════════════════════
authApp.post('/login', async (c) => {
  try {
    const body     = await c.req.json();
    const email    = sanitise(body.email || '').toLowerCase();
    const password = body.password || '';
    const role     = body.role || 'client'; // 'client' | 'freelancer' | 'admin'

    if (!email || !password) return c.json({ error: 'Email and password are required.' }, 400);

    let user: any = null;
    if (role === 'client') {
      const client = await db.select().from(clients).where(eq(clients.email, email)).limit(1);
      if (client.length > 0) user = { ...client[0], role: 'client' as const };
    } else if (role === 'freelancer') {
      const freelancer = await db.select().from(freelancers).where(eq(freelancers.email, email)).limit(1);
      if (freelancer.length > 0) user = { ...freelancer[0], role: 'freelancer' as const };
    } else if (role === 'admin' || role === 'qa_admin') {
      const admin = await db.select().from(admins).where(eq(admins.email, email)).limit(1);
      if (admin.length > 0) user = { ...admin[0], emailVerified: 1, firstLogin: 0 };
    }

    if (!user) return c.json({ error: `Invalid email or password for ${role}.` }, 401);

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return c.json({ error: 'Invalid email or password.' }, 401);

    if (user.status !== 'active') {
      if (user.status === 'pending_verification') {
        return c.json({ error: 'Please verify your email first. Check your inbox for the OTP.' }, 403);
      }
      return c.json({ error: 'Your account has been suspended. Contact support.' }, 403);
    }

    // For clients/freelancers that weren't verified via OTP somehow
    if ('emailVerified' in user && user.emailVerified === 0) {
      return c.json({ error: 'Please verify your email first. Check your inbox for the OTP.' }, 403);
    }

    const token = await sign({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: 1,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    }, JWT_SECRET);

    // After first login, clear the flag
    const isFirst = 'firstLogin' in user ? (user.firstLogin === 1) : false;
    if (isFirst) {
      if (user.role === 'client') {
        await db.update(clients).set({ firstLogin: 0 }).where(eq(clients.id, user.id));
      } else if (user.role === 'freelancer') {
        await db.update(freelancers).set({ firstLogin: 0 }).where(eq(freelancers.id, user.id));
      }
    }

    return c.json({
      token,
      firstLogin: isFirst,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || null,
        role: user.role,
        emailVerified: 1,
        services: 'services' in user && user.services ? JSON.parse(user.services as string) : [],
        portfolioLink: 'portfolioLink' in user ? user.portfolioLink : null,
        bankDetails: 'bankDetails' in user && (user as any).bankDetails ? JSON.parse((user as any).bankDetails) : null,
      },
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ═══════════════════════════════════════════
// POST /api/auth/forgot-password/send-otp
// Sends OTP to registered email for password reset
// ═══════════════════════════════════════════
authApp.post('/forgot-password/send-otp', async (c) => {
  try {
    const { email } = await c.req.json();
    const cleanEmail = sanitise(email || '').toLowerCase();
    if (!cleanEmail) return c.json({ error: 'Email is required.' }, 400);

    const user = await findUserByEmail(cleanEmail);
    // Always return success to prevent email enumeration
    if (!user) return c.json({ message: 'If this email is registered, you will receive an OTP.' });

    const code = await persistOtp(cleanEmail, 'forgot_password');
    const sent = await sendPasswordResetEmail(cleanEmail, user.name, code);
    if (!sent) console.error(`❌ Failed to send password reset email to ${cleanEmail}`);

    return c.json({ message: 'Password reset OTP sent to your email.' });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ═══════════════════════════════════════════
// POST /api/auth/forgot-password/verify-otp
// Validates the reset OTP — returns a short-lived reset token
// ═══════════════════════════════════════════
authApp.post('/forgot-password/verify-otp', async (c) => {
  try {
    const { email, otp } = await c.req.json();
    const cleanEmail = sanitise(email || '').toLowerCase();
    if (!cleanEmail || !otp) return c.json({ error: 'Email and OTP are required.' }, 400);

    const valid = await validateOtp(cleanEmail, otp.toString().trim(), 'forgot_password');
    if (!valid) return c.json({ error: 'Invalid or expired OTP. Please request a new one.' }, 400);

    // Issue a short-lived password-reset token
    const resetToken = await sign({
      email: cleanEmail,
      purpose: 'password_reset',
      exp: Math.floor(Date.now() / 1000) + 15 * 60, // 15 min
    }, JWT_SECRET);

    return c.json({ resetToken, message: 'OTP verified. You may now set a new password.' });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ═══════════════════════════════════════════
// POST /api/auth/forgot-password/reset
// Updates the password using a valid reset token
// ═══════════════════════════════════════════
authApp.post('/forgot-password/reset', async (c) => {
  try {
    const { resetToken, newPassword } = await c.req.json();
    if (!resetToken || !newPassword) return c.json({ error: 'Reset token and new password are required.' }, 400);
    if (newPassword.length < 8) return c.json({ error: 'Password must be at least 8 characters.' }, 400);

    let payload: any;
    try {
      payload = await verify(resetToken, JWT_SECRET, 'HS256');
    } catch (e: any) {
      console.error("JWT_VERIFY_ERROR:", e.message || e);
      return c.json({ error: `Reset token is invalid or expired. Details: ${e.message || e}` }, 400);
    }

    if (payload.purpose !== 'password_reset') return c.json({ error: 'Invalid reset token.' }, 400);

    const email = payload.email as string;
    const hash  = await bcrypt.hash(newPassword, 10);

    // Update in the correct table
    const clientRow = await db.select().from(clients).where(eq(clients.email, email)).limit(1);
    if (clientRow.length > 0) {
      await db.update(clients).set({ passwordHash: hash }).where(eq(clients.email, email));
    } else {
      const freelancerRow = await db.select().from(freelancers).where(eq(freelancers.email, email)).limit(1);
      if (freelancerRow.length > 0) {
        await db.update(freelancers).set({ passwordHash: hash }).where(eq(freelancers.email, email));
      } else {
        await db.update(admins).set({ passwordHash: hash }).where(eq(admins.email, email));
      }
    }

    return c.json({ message: 'Password reset successfully. You can now log in with your new password.' });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ═══════════════════════════════════════════
// GET /api/auth/me
// ═══════════════════════════════════════════
authApp.get('/me', async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  return c.json({ user });
});

// ═══════════════════════════════════════════
// GET /api/auth/profile
// Returns full profile for the authenticated client or freelancer
// ═══════════════════════════════════════════
authApp.get('/profile', async (c) => {
  try {
    const authUser = await getAuthUser(c);
    if (!authUser) return c.json({ error: 'Unauthorized' }, 401);

    if (authUser.role === 'client') {
      const rows = await db.select().from(clients).where(eq(clients.id, authUser.id)).limit(1);
      if (rows.length === 0) return c.json({ error: 'Client not found' }, 404);
      const { passwordHash, ...safeClient } = rows[0];
      return c.json({
        profile: {
          ...safeClient,
          role: 'client',
          services: safeClient.services ? JSON.parse(safeClient.services) : [],
        }
      });
    } else if (authUser.role === 'freelancer') {
      const rows = await db.select().from(freelancers).where(eq(freelancers.id, authUser.id)).limit(1);
      if (rows.length === 0) return c.json({ error: 'Freelancer not found' }, 404);
      const { passwordHash, ...safeFreelancer } = rows[0];
      return c.json({
        profile: {
          ...safeFreelancer,
          role: 'freelancer',
          services: safeFreelancer.services ? JSON.parse(safeFreelancer.services) : [],
          bankDetails: safeFreelancer.bankDetails ? JSON.parse(safeFreelancer.bankDetails) : null,
        }
      });
    } else {
      return c.json({ profile: { id: authUser.id, name: authUser.name, email: authUser.email, role: 'admin' } });
    }
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ═══════════════════════════════════════════
// PUT /api/auth/profile
// Updates profile details (Name, Phone, Vetted Services, Portfolio, etc.)
// ═══════════════════════════════════════════
authApp.put('/profile', async (c) => {
  try {
    const authUser = await getAuthUser(c);
    if (!authUser) return c.json({ error: 'Unauthorized' }, 401);

    const body = await c.req.json();
    const name = body.name ? sanitise(body.name) : undefined;
    const phone = body.phone ? sanitise(body.phone) : undefined;
    const services = Array.isArray(body.services) ? (authUser.role === 'freelancer' ? body.services.slice(0, 4) : body.services) : undefined;
    const portfolioLink = body.portfolioLink !== undefined ? body.portfolioLink : undefined;
    const bankDetails = body.bankDetails !== undefined ? JSON.stringify(body.bankDetails) : undefined;

    if (authUser.role === 'client') {
      const updateData: any = {};
      if (name) updateData.name = name;
      if (phone) updateData.phone = phone;
      if (services) updateData.services = JSON.stringify(services);

      await db.update(clients).set(updateData).where(eq(clients.id, authUser.id));
      const updated = await db.select().from(clients).where(eq(clients.id, authUser.id)).limit(1);
      const { passwordHash, ...safeClient } = updated[0];
      return c.json({
        message: 'Profile updated successfully',
        profile: {
          ...safeClient,
          role: 'client',
          services: safeClient.services ? JSON.parse(safeClient.services) : [],
        }
      });
    } else if (authUser.role === 'freelancer') {
      const updateData: any = {};
      if (name) updateData.name = name;
      if (phone) updateData.phone = phone;
      if (services) updateData.services = JSON.stringify(services);
      if (portfolioLink !== undefined) updateData.portfolioLink = portfolioLink;
      if (bankDetails !== undefined) updateData.bankDetails = bankDetails;

      await db.update(freelancers).set(updateData).where(eq(freelancers.id, authUser.id));
      const updated = await db.select().from(freelancers).where(eq(freelancers.id, authUser.id)).limit(1);
      const { passwordHash, ...safeFreelancer } = updated[0];
      return c.json({
        message: 'Profile updated successfully',
        profile: {
          ...safeFreelancer,
          role: 'freelancer',
          services: safeFreelancer.services ? JSON.parse(safeFreelancer.services) : [],
          bankDetails: safeFreelancer.bankDetails ? JSON.parse(safeFreelancer.bankDetails) : null,
        }
      });
    } else {
      return c.json({ error: 'Profile edit not available for admin role here.' }, 400);
    }
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ═══════════════════════════════════════════
// POST /api/auth/profile/request-email-change
// Sends a 6-digit OTP to the newly entered email address
// ═══════════════════════════════════════════
authApp.post('/profile/request-email-change', async (c) => {
  try {
    const authUser = await getAuthUser(c);
    if (!authUser) return c.json({ error: 'Unauthorized' }, 401);

    const { newEmail } = await c.req.json();
    const cleanEmail = sanitise(newEmail || '').toLowerCase();

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return c.json({ error: 'Please provide a valid email address.' }, 400);
    }

    if (cleanEmail === authUser.email.toLowerCase()) {
      return c.json({ error: 'New email address is the same as your current email.' }, 400);
    }

    // Check if new email is already taken
    const existing = await findUserByEmail(cleanEmail);
    if (existing) {
      return c.json({ error: 'This email address is already registered to another account.' }, 400);
    }

    // Generate & send OTP
    const otpCode = await persistOtp(cleanEmail, 'change_email');
    await sendEmailChangeOtpEmail(cleanEmail, authUser.name, otpCode);

    return c.json({ message: `Verification code sent to ${cleanEmail}` });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ═══════════════════════════════════════════
// POST /api/auth/profile/verify-email-change
// Verifies OTP and permanently commits email change
// ═══════════════════════════════════════════
authApp.post('/profile/verify-email-change', async (c) => {
  try {
    const authUser = await getAuthUser(c);
    if (!authUser) return c.json({ error: 'Unauthorized' }, 401);

    const { newEmail, otp } = await c.req.json();
    const cleanEmail = sanitise(newEmail || '').toLowerCase();

    if (!cleanEmail || !otp) {
      return c.json({ error: 'New email and OTP are required.' }, 400);
    }

    const isValid = await validateOtp(cleanEmail, otp.toString().trim(), 'change_email');
    if (!isValid) {
      return c.json({ error: 'Invalid or expired OTP. Please request a new code.' }, 400);
    }

    // Update in database
    if (authUser.role === 'client') {
      await db.update(clients).set({ email: cleanEmail }).where(eq(clients.id, authUser.id));
    } else if (authUser.role === 'freelancer') {
      await db.update(freelancers).set({ email: cleanEmail }).where(eq(freelancers.id, authUser.id));
    } else {
      await db.update(admins).set({ email: cleanEmail }).where(eq(admins.id, authUser.id));
    }

    // Issue updated JWT token
    const token = await sign({
      id: authUser.id,
      name: authUser.name,
      email: cleanEmail,
      role: authUser.role,
      emailVerified: 1,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
    }, JWT_SECRET);

    return c.json({
      message: 'Email address updated successfully!',
      token,
      email: cleanEmail,
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── Auth Context Helper (used by other routes) ──
export async function getAuthUser(c: any) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const payload = await verify(token, JWT_SECRET, 'HS256');
    return payload as { id: number; name: string; email: string; role: string; emailVerified?: number };
  } catch {
    return null;
  }
}

export default authApp;
