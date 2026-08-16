CREATE TABLE "admins" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'admin' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" text DEFAULT '2026-08-16T16:06:41.153Z',
	CONSTRAINT "admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"services" text,
	"status" text DEFAULT 'pending_verification' NOT NULL,
	"email_verified" integer DEFAULT 0 NOT NULL,
	"first_login" integer DEFAULT 1 NOT NULL,
	"created_at" text DEFAULT '2026-08-16T16:06:41.152Z',
	CONSTRAINT "clients_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "freelancers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"services" text,
	"portfolio_link" text,
	"bank_details" text,
	"status" text DEFAULT 'pending_verification' NOT NULL,
	"email_verified" integer DEFAULT 0 NOT NULL,
	"first_login" integer DEFAULT 1 NOT NULL,
	"created_at" text DEFAULT '2026-08-16T16:06:41.153Z',
	CONSTRAINT "freelancers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"sender_id" integer NOT NULL,
	"sender_role" text NOT NULL,
	"message_text" text NOT NULL,
	"created_at" text DEFAULT '2026-08-16T16:06:41.153Z'
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"service_category" text NOT NULL,
	"tier" text NOT NULL,
	"price" integer NOT NULL,
	"status" text DEFAULT 'pending_payment' NOT NULL,
	"description" text,
	"submission_link" text,
	"qa_approved_link" text,
	"freelancer_id" integer,
	"freelancer_payout_amount" integer,
	"payment_id" text,
	"razorpay_order_id" text,
	"admin_revision_comments" text,
	"created_at" text DEFAULT '2026-08-16T16:06:41.153Z',
	"updated_at" text DEFAULT '2026-08-16T16:06:41.153Z'
);
--> statement-breakpoint
CREATE TABLE "otp_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"code" text NOT NULL,
	"type" text NOT NULL,
	"expires_at" text NOT NULL,
	"used" integer DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT '2026-08-16T16:06:41.153Z'
);
--> statement-breakpoint
CREATE TABLE "testimonials" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"quote" text NOT NULL,
	"stars" integer DEFAULT 5 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" text DEFAULT '2026-08-16T16:06:41.153Z'
);
