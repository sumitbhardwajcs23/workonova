# 🚀 WORKONOVA — Deep-Tech & Creative Agency Ecosystem

<div align="center">

![Workonova Platform](https://img.shields.io/badge/Platform-Workonova-3ddc17?style=for-the-badge&logo=rocket)
![React 19](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-7.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Hono Backend](https://img.shields.io/badge/Hono-v4-E36002?style=for-the-badge&logo=hono&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Drizzle_ORM-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8.2-646CFF?style=for-the-badge&logo=vite&logoColor=white)

<p align="center">
  <strong>An enterprise-grade, full-stack on-demand creative and deep-tech talent ecosystem.</strong><br>
  Streamlining client project ordering, automated expertise-based freelancer matching, QA governance, and financial management.
</p>

[✨ Live Features](#-key-features) • [🏛️ System Architecture](#️-system-architecture) • [🚀 Quick Start](#-quick-start) • [🗄️ Database Schema](#️-database-schema) • [📦 Deployment](#-deployment-guide) • [🔄 Recent Updates](#-whats-new-in-this-update)

</div>

---

## 🌟 Executive Overview

**WORKONOVA** is a high-performance, full-stack digital services agency platform engineered to connect businesses with elite tech and creative specialists. Built with an ultrafast **Hono + TypeScript** backend, a glassmorphic **React 19** frontend, and **Drizzle ORM**, Workonova bridges client intake, curated talent matching, strict internal QA auditing, and automated financial settlements.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Clients["💼 Client Portal"]
        C1[Browse Services & Bundles] --> C2[Place On-Demand / Tiered Order]
        C2 --> C3[Advance / Full Razorpay Checkout]
        C3 --> C4[Order Tracking & Live Asset Chat]
    end

    subgraph AdminDesk["🛡️ Admin & QA Governance Desk (/admin)"]
        A1[Intake Review & Custom Quote Pricing]
        A2[Expertise-Based Talent Assignment]
        A3[QA Review: Approve / Request Revision]
        A4[Financial Ledger & Payout Dispatch]
    end

    subgraph Freelancers["⚡ Freelancer Portal"]
        F1[Review Matched Assigned Brief]
        F2[Deliver Artifacts via Cloud/Drive Link]
        F3[Resolve QA Revisions]
        F4[Track Completed Orders & Payouts]
    end

    C2 -->|Order Created| A1
    A1 -->|Assign Talent| A2
    A2 -->|Push Brief| F1
    F2 -->|Submit Deliverables| A3
    A3 -->|Approve & Release| C4
    A3 -->|Approve & Release| A4
    A4 -->|Settle Earnings| F4
```

---

## ✨ Key Features & Portals

### 🌐 1. Public Experience & Landing Page
- **Cinematic Hero**: Video-integrated hero section with crisp CTAs and responsive overlays.
- **Service Categories & Bundles**: Interactive pricing tables for *Starter*, *Growth*, and *Enterprise* service tiers with comprehensive deliverable breakdowns.
- **Interactive Portfolio & Showcase**: Dynamic ImgBB & online asset resolution with real-time modal previews.
- **Secured Authentication**: Integrated Client & Freelancer modal auth with 6-digit email OTP verification and password reset workflows.

### 💼 2. Client Portal & Dashboard
- **Tiered & On-Demand Ordering**: Purchase pre-defined service packages or request custom on-demand quotes with initial ₹100 token advance.
- **Full Lifecycle Order Tracking**: Status pipeline tracking (`pending_payment` ➔ `paid` ➔ `assigned` ➔ `submitted` ➔ `qa_approved` ➔ `delivered`).
- **Interactive Asset Vault**: Real-time project communication, delivery file preview, and Razorpay PDF payment receipt generation.

### ⚡ 3. Freelancer Workspace
- **Expertise-Matched Assignments**: Auto-assigned or targeted task matching based on registered skill categories.
- **Brief & Asset Delivery**: Direct cloud asset submission (Google Drive/Dropbox/Figma links) and task status updates.
- **QA Feedback Loop**: In-app feedback comments from QA managers with revision request resolution.
- **Earnings & Ledger**: Real-time tracking of locked payout amounts and bank withdrawal statuses.

### 🛡️ 4. Admin & QA Governance Desk (`/admin`)
- **Discrete URL Isolation**: Hidden from public view, accessible exclusively via direct route with enterprise credentials.
- **Assignment Desk**: Instant matching and assignment of freelancers grouped by domain expertise.
- **On-Demand Quote Desk**: Custom quote price configuration and invoice generation.
- **Dossier Directory**: Comprehensive Client & Freelancer directories featuring phone synchronization, account verification, and status controls.
- **Financial Center & Package Management**: Real-time service package pricing controls and total revenue/payout analytics.

---

## 💻 Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Vite 8, React Router v7, Vanilla CSS3 (Glassmorphism & Micro-animations), jsPDF |
| **Backend** | Hono v4, Node.js (`@hono/node-server`), TypeScript, Tsx |
| **Database & ORM** | PostgreSQL / Neon Serverless / SQLite (WAL mode), Drizzle ORM, Drizzle Kit |
| **Auth & Security** | Bcrypt password hashing, 6-digit Time-based OTP Tokens, Protected Route Guards |
| **Cloud & Deployment** | AWS S3 / Amplify, Vercel SPA Configuration, PM2 Process Manager |

---

## 🗄️ Database Schema

The core relational structure managed via **Drizzle ORM**:

```
├── clients                # Client profiles, email verification, auth hashes
├── freelancers            # Creative & tech specialists, expertise, bank details
├── admins                 # System admins & QA governance managers
├── otp_tokens             # 6-digit verification & password reset tokens
├── orders                 # Intake briefs, service tiers, status pipeline, deliverables
├── messages               # Real-time project discussion threads per order
├── testimonials           # Client reviews & testimonials moderation queue
└── category_packages      # Real-time dynamic service bundles & pricing
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js `v20.0.0+`
- npm or pnpm
- PostgreSQL database instance (or SQLite for local fallback)

### 1. Clone the Repository
```bash
git clone https://github.com/sumitbhardwajcs23/workonova.git
cd workonova
```

### 2. Backend Setup
```bash
cd backend
npm install

# Configure environment variables
cp .env.example .env

# Initialize and seed database schema
npm run db:push
npm run db:init

# Start development server (Port 3001 or configured PORT)
npm run dev
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install

# Start Vite dev server (Port 5173)
npm run dev
```

Visit `http://localhost:5173` for the landing page and `http://localhost:5173/admin` for the administrative console.

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)
```env
PORT=3001
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/worknova
JWT_SECRET=your_super_secret_jwt_key

# Email Transporter (OTP Delivery)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Payment Gateway
RAZORPAY_KEY_ID=rzp_test_xxxx
RAZORPAY_KEY_SECRET=xxxx
```

### Frontend (`frontend/src/config.ts`)
```typescript
export const API_BASE_URL = "http://localhost:3001/api";
```

---

## 📦 Deployment Guide

### Vercel (Frontend SPA)
The project includes `vercel.json` for client-side routing support:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### AWS S3 / Amplify
Run the automated deployment scripts in `/backend`:
```bash
cd backend
npm run deploy:amplify
# or
node deploy_frontend.js
```

---

## 🔄 What's New in This Update

- 🎨 **Logo & Visual Asset Integrity**: Fixed responsive asset clipping across all viewport sizes, headers, and footers.
- 📱 **Real Phone Number Sync**: Live contact synchronization in both Client and Freelancer dossier inspection modals.
- 🔒 **Dedicated Admin Portal (`/admin`)**: Hardened admin accessibility removed from landing page CTAs, styled to match the unified brand design system.
- 💡 **On-Demand Custom Quote Flow**: Client ₹100 advance deposit workflow and admin on-demand pricing desk.
- 🧾 **Razorpay Invoicing & Receipts**: Instant client PDF invoice generation and download upon payment confirmation.
- 🎯 **Domain-Expertise Matching**: Smart talent grouping and one-click freelancer assignment on the Admin Kanban desk.

---

## 📄 License

This project is proprietary and confidential. Developed for **Workonova**.
