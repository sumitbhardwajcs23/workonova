# WORKONOVA — Database & Schema Architecture Reference

This document outlines where, how, and in what format the WORKONOVA database is stored, including the complete column structure for all tables.

---

## 📂 Database Location & Format

*   **Database Engine:** SQLite (v3)
*   **Database File Location:** `d:\worknova\p1\backend\worknova.db`
*   **Storage Mechanism:** Serverless single-file transactional database. Read/Write concurrency is optimized using **WAL (Write-Ahead Logging)** mode enabled on startup.
*   **Drizzle Schema definition:** Defined in [schema.ts](file:///d:/worknova/p1/backend/src/db/schema.ts)

---

## 📊 Full Table Structures

### 1. `clients` Table
Stores all client profile records.
*   **id:** `INTEGER PRIMARY KEY AUTOINCREMENT`
*   **name:** `TEXT NOT NULL` — Full name
*   **email:** `TEXT NOT NULL UNIQUE` — Unique login email
*   **password_hash:** `TEXT NOT NULL` — Bcrypt hashed password
*   **services:** `TEXT` — JSON stringified array of service categories (interests)
*   **status:** `TEXT NOT NULL DEFAULT 'pending_verification'` — Account state (`pending_verification` | `active` | `suspended`)
*   **email_verified:** `INTEGER NOT NULL DEFAULT 0` — Email verification boolean flag (`0 = false`, `1 = true`)
*   **first_login:** `INTEGER NOT NULL DEFAULT 1` — Tracks whether to trigger the welcome popup (`1 = true`, `0 = false`)
*   **created_at:** `TEXT DEFAULT (datetime('now'))` — ISO Timestamp

---

### 2. `freelancers` Table
Stores all creative/tech specialists.
*   **id:** `INTEGER PRIMARY KEY AUTOINCREMENT`
*   **name:** `TEXT NOT NULL` — Full name
*   **email:** `TEXT NOT NULL UNIQUE` — Unique login email
*   **password_hash:** `TEXT NOT NULL` — Bcrypt hashed password
*   **services:** `TEXT` — JSON stringified array of service categories (expertise)
*   **portfolio_link:** `TEXT` — Portfolio / Github / Behance website URL
*   **bank_details:** `TEXT` — JSON stringified bank transfer details
*   **status:** `TEXT NOT NULL DEFAULT 'pending_verification'` — Account state (`pending_verification` | `active` | `suspended`)
*   **email_verified:** `INTEGER NOT NULL DEFAULT 0` — Email verification boolean flag (`0 = false`, `1 = true`)
*   **first_login:** `INTEGER NOT NULL DEFAULT 1` — Tracks whether to trigger the welcome popup (`1 = true`, `0 = false`)
*   **created_at:** `TEXT DEFAULT (datetime('now'))` — ISO Timestamp

---

### 3. `admins` Table
Stores system administrators and QA managers.
*   **id:** `INTEGER PRIMARY KEY AUTOINCREMENT`
*   **name:** `TEXT NOT NULL` — Full name
*   **email:** `TEXT NOT NULL UNIQUE` — Login email
*   **password_hash:** `TEXT NOT NULL` — Bcrypt hashed password
*   **role:** `TEXT NOT NULL DEFAULT 'admin'` — Role type (`admin` | `qa_admin`)
*   **status:** `TEXT NOT NULL DEFAULT 'active'` — Account state (`active` | `suspended`)
*   **created_at:** `TEXT DEFAULT (datetime('now'))` — ISO Timestamp

---

### 4. `otp_tokens` Table
Stores security OTP codes for account verification and password resets.
*   **id:** `INTEGER PRIMARY KEY AUTOINCREMENT`
*   **email:** `TEXT NOT NULL` — Recipient email
*   **code:** `TEXT NOT NULL` — 6-digit numeric OTP code
*   **type:** `TEXT NOT NULL` — OTP context (`verify_email` | `forgot_password`)
*   **expires_at:** `TEXT NOT NULL` — Expiration ISO timestamp (+10 mins from creation)
*   **used:** `INTEGER NOT NULL DEFAULT 0` — Verification flag (`0 = active`, `1 = used/invalidated`)
*   **created_at:** `TEXT DEFAULT (datetime('now'))` — ISO Timestamp

---

### 5. `orders` Table
Stores orders (intake briefs, status, assignments, payouts).
*   **id:** `INTEGER PRIMARY KEY AUTOINCREMENT`
*   **client_id:** `INTEGER NOT NULL` — References `clients.id`
*   **service_category:** `TEXT NOT NULL` — Service Category
*   **tier:** `TEXT NOT NULL` — Package tier (`silver` | `gold` | `custom`)
*   **price:** `INTEGER NOT NULL` — Total price in INR
*   **status:** `TEXT NOT NULL DEFAULT 'pending_payment'` — Order lifecycle state (`pending_payment` | `paid` | `assigned` | `submitted` | `qa_approved` | `revision_requested` | `delivered` | `cancelled`)
*   **description:** `TEXT` — Project briefing notes
*   **submission_link:** `TEXT` — Client intake files (Drive/Dropbox) / Freelancer deliverable submit link
*   **qa_approved_link:** `TEXT` — Final audited asset links released by Admin/QA
*   **freelancer_id:** `INTEGER` — References `freelancers.id` (assigned worker)
*   **freelancer_payout_amount:** `INTEGER` — Locked payout amount for freelancer
*   **payment_id:** `TEXT` — Payment checkout reference ID
*   **razorpay_order_id:** `TEXT` — Razorpay payment reference Order ID
*   **admin_revision_comments:** `TEXT` — QA revision feedback notes
*   **created_at:** `TEXT DEFAULT (datetime('now'))`
*   **updated_at:** `TEXT DEFAULT (datetime('now'))`

---

### 6. `messages` Table
Tracks real-time order chat messages.
*   **id:** `INTEGER PRIMARY KEY AUTOINCREMENT`
*   **order_id:** `INTEGER NOT NULL` — References `orders.id`
*   **sender_id:** `INTEGER NOT NULL` — Sender ID
*   **sender_role:** `TEXT NOT NULL` — Role type (`client` | `freelancer` | `admin`)
*   **message_text:** `TEXT NOT NULL` — Chat content
*   **created_at:** `TEXT DEFAULT (datetime('now'))`

---

### 7. `testimonials` Table
Testimonials queue for landing page selection.
*   **id:** `INTEGER PRIMARY KEY AUTOINCREMENT`
*   **name:** `TEXT NOT NULL` — Author name
*   **role:** `TEXT NOT NULL` — Author role tag
*   **quote:** `TEXT NOT NULL` — Review text
*   **stars:** `INTEGER NOT NULL DEFAULT 5` — Star count (1 to 5)
*   **status:** `TEXT NOT NULL DEFAULT 'pending'` — Display queue status (`pending` | `approved` | `rejected`)
*   **created_at:** `TEXT DEFAULT (datetime('now'))`
