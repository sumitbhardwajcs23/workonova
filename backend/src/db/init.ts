import bcrypt from 'bcryptjs';
import { db } from './index.js';
import { clients, freelancers, admins, orders, messages, testimonials } from './schema.js';
import { eq } from 'drizzle-orm';

export async function initDatabase() {
  console.log('📦 Starting WORKONOVA Database Setup & Seeding...');

  try {
    // ── 1. Seed Admin Accounts ──────────────────────────────
    const existingAdmins = await db.select().from(admins).limit(1);
    if (existingAdmins.length === 0) {
      console.log('🌱 Seeding admin accounts...');
      const adminPass  = await bcrypt.hash('admin123', 10);
      const qaPass     = await bcrypt.hash('qa123', 10);

      await db.insert(admins).values({
        name: 'Master Admin',
        email: 'admin@workonova.com',
        passwordHash: adminPass,
        role: 'admin',
        status: 'active',
      });

      await db.insert(admins).values({
        name: 'QA Manager',
        email: 'qa@workonova.com',
        passwordHash: qaPass,
        role: 'qa_admin',
        status: 'active',
      });

      console.log('✅ Admin accounts seeded!');
    }

    // ── 2. Seed Client Accounts ─────────────────────────────
    const existingClients = await db.select().from(clients).limit(1);
    if (existingClients.length === 0) {
      console.log('🌱 Seeding client accounts...');
      const clientPass = await bcrypt.hash('client123', 10);

      const insertedClient = await db.insert(clients).values({
        name: 'Rohit Sharma',
        email: 'client@workonova.com',
        passwordHash: clientPass,
        services: JSON.stringify(['Website Development', 'Graphic Designing', 'Video Editing']),
        status: 'active',
        emailVerified: 1,   // Pre-verified seed account
        firstLogin: 0,      // Suppress welcome popup for seed data
      }).returning();

      console.log('✅ Client accounts seeded!');

      // ── 3. Seed Freelancer Accounts ───────────────────────
      console.log('🌱 Seeding freelancer accounts...');
      const freelancerPass = await bcrypt.hash('freelancer123', 10);

      const insertedFreelancer = await db.insert(freelancers).values({
        name: 'Alex Developer',
        email: 'freelancer@workonova.com',
        passwordHash: freelancerPass,
        services: JSON.stringify(['Website Development', 'Software Development', 'App Development']),
        portfolioLink: 'https://github.com/alexdev',
        bankDetails: JSON.stringify({ accountName: 'Alex Developer', upiId: 'alex@upi', bankName: 'HDFC Bank' }),
        status: 'active',
        emailVerified: 1,
        firstLogin: 0,
      }).returning();

      await db.insert(freelancers).values({
        name: 'Priya Graphics',
        email: 'priya@workonova.com',
        passwordHash: freelancerPass,
        services: JSON.stringify(['Graphic Designing', 'Video Editing', 'Animation', '3D Design & Modeling']),
        portfolioLink: 'https://behance.net/priyagraphics',
        bankDetails: JSON.stringify({ accountName: 'Priya Sharma', upiId: 'priya@upi', bankName: 'ICICI Bank' }),
        status: 'active',
        emailVerified: 1,
        firstLogin: 0,
      });

      console.log('✅ Freelancer accounts seeded!');

      // ── 4. Seed Sample Orders ─────────────────────────────
      console.log('🌱 Seeding sample orders...');
      const clientId     = insertedClient[0].id;
      const freelancerId = insertedFreelancer[0].id;

      const order1 = await db.insert(orders).values({
        clientId,
        serviceCategory: 'Website Development',
        tier: 'gold',
        price: 34999,
        status: 'assigned',
        description: 'Modern high-converting SaaS landing page with responsive animations, Tailwind CSS, and contact form.',
        submissionLink: 'https://drive.google.com/drive/folders/sample-client-brief',
        freelancerId,
        freelancerPayoutAmount: 24500,
      }).returning();

      const order2 = await db.insert(orders).values({
        clientId,
        serviceCategory: 'Video Editing',
        tier: 'silver',
        price: 14999,
        status: 'delivered',
        description: '5 Short-form Instagram Reels with dynamic captions, sound design, and color grading.',
        submissionLink: 'https://drive.google.com/drive/folders/sample-video-brief',
        qaApprovedLink: 'https://drive.google.com/drive/folders/sample-approved-videos',
        freelancerId,
        freelancerPayoutAmount: 10499,
      }).returning();

      // ── 5. Seed Chat Messages ─────────────────────────────
      await db.insert(messages).values({
        orderId: order1[0].id,
        senderId: clientId,
        senderRole: 'client',
        messageText: 'Hi team, please ensure the mobile navigation matches our brand color palette.',
      });

      await db.insert(messages).values({
        orderId: order1[0].id,
        senderId: 0,
        senderRole: 'admin',
        messageText: '[SYSTEM] Task assigned to Alex Developer. Freelancer payout locked at ₹24,500.',
      });

      console.log('✅ Sample orders & messages seeded!');
    }

    // ── 6. Seed Approved Testimonials ──────────────────────
    const existingTestimonials = await db.select().from(testimonials).limit(1);
    if (existingTestimonials.length === 0) {
      console.log('🌱 Seeding approved testimonials...');
      await db.insert(testimonials).values([
        { name: 'Ananya Shah',  role: 'Growth Lead, Nova Labs', stars: 5, status: 'approved',
          quote: 'The process was absurdly simple. We submitted a brief on Monday and had polished product visuals by Friday.' },
        { name: 'Rohit Mehra', role: 'Founder, Metrik',         stars: 5, status: 'approved',
          quote: "It's the first time outsourcing has felt as reliable as working with an internal team. The QA is genuinely excellent." },
        { name: 'Sarah Chen',  role: 'Marketing Director, Relay', stars: 5, status: 'approved',
          quote: 'Clear packages, exceptional quality, zero back-and-forth. Workonova has become our creative unfair advantage.' },
      ]);
      console.log('✅ Testimonials seeded!');
    }

    console.log('🎉 Database initialization complete!');
  } catch (err: any) {
    console.error('❌ Database initialization error:', err.message || err);
  }
}

// Direct CLI execution: `npx tsx src/db/init.ts`
if (process.argv[1]?.endsWith('init.ts') || process.argv[1]?.endsWith('init.js')) {
  initDatabase().then(() => process.exit(0));
}
