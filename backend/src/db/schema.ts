import { pgTable, serial, integer, text } from 'drizzle-orm/pg-core';

// ═══════════════════════════════════════════════════════════════
// WORKONOVA DATABASE SCHEMA (POSTGRESQL MIGRATED)
// Separate tables per role for clean RBAC isolation
// File: backend/src/db/schema.ts
// ═══════════════════════════════════════════════════════════════

// ─── 1. CLIENTS TABLE ─────────────────────────────────────────
// Stores all client accounts created via public signup or admin onboarding
export const clients = pgTable('clients', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  services: text('services'),           // JSON array: services they're interested in
  status: text('status').notNull().default('pending_verification'),
  // 'pending_verification' | 'active' | 'suspended'
  emailVerified: integer('email_verified').notNull().default(0), // 0=false, 1=true
  firstLogin: integer('first_login').notNull().default(1),       // 1=show welcome popup
  createdAt: text('created_at').default(new Date().toISOString()),
});

// ─── 2. FREELANCERS TABLE ─────────────────────────────────────
// Stores all creative/tech specialists
export const freelancers = pgTable('freelancers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  services: text('services'),           // JSON array: services they can provide
  portfolioLink: text('portfolio_link'),
  bankDetails: text('bank_details'),    // JSON stringified bank transfer details
  status: text('status').notNull().default('pending_verification'),
  // 'pending_verification' | 'active' | 'suspended'
  emailVerified: integer('email_verified').notNull().default(0), // 0=false, 1=true
  firstLogin: integer('first_login').notNull().default(1),       // 1=show welcome popup
  createdAt: text('created_at').default(new Date().toISOString()),
});

// ─── 3. ADMINS TABLE ──────────────────────────────────────────
// Admin and QA accounts — created ONLY by super admin, no public signup
export const admins = pgTable('admins', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('admin'), // 'admin' | 'qa_admin'
  status: text('status').notNull().default('active'),
  createdAt: text('created_at').default(new Date().toISOString()),
});

// ─── 4. OTP TOKENS TABLE ──────────────────────────────────────
// Persistent OTP store for: email verification and forgot password flows
export const otpTokens = pgTable('otp_tokens', {
  id: serial('id').primaryKey(),
  email: text('email').notNull(),
  code: text('code').notNull(),
  type: text('type').notNull(), // 'verify_email' | 'forgot_password'
  expiresAt: text('expires_at').notNull(),
  used: integer('used').notNull().default(0), // 0=active, 1=used
  createdAt: text('created_at').default(new Date().toISOString()),
});

// ─── 5. ORDERS TABLE ──────────────────────────────────────────
// Project orders placed by clients, assigned to freelancers
export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').notNull(),        // References clients.id
  serviceCategory: text('service_category').notNull(),
  tier: text('tier').notNull(),                    // 'silver' | 'gold' | 'custom'
  price: integer('price').notNull(),
  status: text('status').notNull().default('pending_payment'),
  // 'pending_payment' | 'paid' | 'assigned' | 'submitted' | 'qa_approved'
  // | 'revision_requested' | 'delivered' | 'cancelled'
  description: text('description'),
  submissionLink: text('submission_link'),
  qaApprovedLink: text('qa_approved_link'),
  freelancerId: integer('freelancer_id'),           // References freelancers.id
  freelancerPayoutAmount: integer('freelancer_payout_amount'),
  paymentId: text('payment_id'),
  razorpayOrderId: text('razorpay_order_id'),
  adminRevisionComments: text('admin_revision_comments'),
  createdAt: text('created_at').default(new Date().toISOString()),
  updatedAt: text('updated_at').default(new Date().toISOString()),
});

// ─── 6. MESSAGES TABLE ────────────────────────────────────────
// Chat messages per order between client / admin / freelancer
export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull(),
  senderId: integer('sender_id').notNull(),
  senderRole: text('sender_role').notNull(), // 'client' | 'freelancer' | 'admin'
  messageText: text('message_text').notNull(),
  createdAt: text('created_at').default(new Date().toISOString()),
});

// ─── 7. TESTIMONIALS TABLE ────────────────────────────────────
// Client reviews shown on the landing page after admin approval
export const testimonials = pgTable('testimonials', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  quote: text('quote').notNull(),
  stars: integer('stars').notNull().default(5),
  status: text('status').notNull().default('pending'), // 'pending' | 'approved' | 'rejected'
  createdAt: text('created_at').default(new Date().toISOString()),
});

// ─── Backwards-compat alias — some old routes still reference `users` ─────
// We keep this so existing code compiles without breaking during migration.
// Remove once all routes are updated to use clients/freelancers/admins tables.
export const users = clients; // Temporary alias — will be removed in next refactor phase
