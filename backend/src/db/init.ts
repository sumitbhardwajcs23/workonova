import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db } from './index.js';
import { clients, freelancers, admins, orders, messages, testimonials, blogs, bundles, teamMembers } from './schema.js';
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

    // Client, Freelancer, Order and Message seeding removed.
    // Accounts and project data will strictly originate from real user signups and bookings.

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

    // ── 7. Seed Default Blogs ─────────────────────────────
    const existingBlogs = await db.select().from(blogs).limit(1);
    if (existingBlogs.length === 0) {
      console.log('🌱 Seeding default blogs...');
      await db.insert(blogs).values([
        {
          title: 'The Future of Blind Workspaces: Why Anonymity Elevates Creative Projects',
          publishedAt: 'August 12, 2026',
          author: 'Workonova Editorial',
          content: 'In creative fields, cognitive bias can silently sink projects. When freelancers know they are working for a Fortune 500 company versus a small startup, their designs shift. Workonova\'s blind-collaboration space protects identity on both ends, allowing creators to focus entirely on brief compliance and pure execution quality.'
        },
        {
          title: 'AI-Assisted Workflows: Optimizing Software Handoffs',
          publishedAt: 'July 28, 2026',
          author: 'Tech & Automation Team',
          content: 'Integrating artificial intelligence into software development pipelines isn\'t about replacing engineers; it is about eliminating manual feedback loops. By automating branch creation, seeding test environments, and validation triggers, we reduce delivery times by 40% and secure robust production builds.'
        },
        {
          title: 'Scaling Corporate Post-Production: High-Speed Video Editing Rules',
          publishedAt: 'June 15, 2026',
          author: 'Creative Guild',
          content: 'Post-production demands coordination. Our creative leads share three non-negotiable rules for scaling video assets: keeping strict brand asset folders, providing timestamped reference files during intake, and structuring multi-channel ratios early in the editing phase.'
        }
      ]);
      console.log('✅ Default blogs seeded!');
    }

    // ── 8. Seed Default Bundles ───────────────────────────
    const existingBundles = await db.select().from(bundles).limit(1);
    if (existingBundles.length === 0) {
      console.log('🌱 Seeding default bundles...');
      await db.insert(bundles).values([
        {
          category: 'Website Development',
          tag: 'STARTER WEB',
          name: 'Starter Landing Page',
          description: 'Single high-converting landing page with modern responsive design.',
          price: '₹14,999',
          period: '/ One-time',
          features: JSON.stringify(['1 Responsive Landing Page (React / WP)', 'Contact Form & Email Integration', 'Basic On-Page SEO & Speed Optimization', '48-Hour Rapid Delivery', '1 Round of Free Revisions']),
          popular: 0
        },
        {
          category: 'Website Development',
          tag: 'MOST POPULAR',
          name: 'Growth Business Portal',
          description: 'Complete multi-page corporate website with admin dashboard & analytics.',
          price: '₹34,999',
          period: '/ One-time',
          features: JSON.stringify(['Up to 6 Custom Pages + CMS Admin', 'E-Commerce / Payment Gateway Setup', 'Full Technical & Mobile SEO (Lighthouse 95+)', 'Database & API Backend Integration', '3 Rounds of Free Revisions']),
          popular: 1
        },
        {
          category: 'Website Development',
          tag: 'ENTERPRISE WEB',
          name: 'Enterprise Custom Platform',
          description: 'Custom SaaS web platform or complex web application built to scale.',
          price: '₹79,999',
          period: '/ Project',
          features: JSON.stringify(['Custom Full-Stack Web App (Next.js / Node / PG)', 'Role-Based User Dashboards & Subscriptions', 'High-Scale Cloud Architecture & Security Audit', 'Dedicated Lead Fullstack Engineer', 'Unlimited Revisions until Launch']),
          popular: 0
        },
        {
          category: 'All Services',
          tag: 'STARTUPS & SOLO CREATORS',
          name: 'Starter Creative Suite',
          description: 'Ideal for early-stage startups and creators needing high-impact graphics and videos.',
          price: '₹14,999',
          period: '/ Monthly',
          features: JSON.stringify(['15 Graphic Design Creatives / Month', '4 Edited Video Reels (up to 60s)', 'Basic On-Page SEO / Social Management', 'Turnaround Time: 48 Hours', 'Dedicated Communication']),
          popular: 0
        }
      ]);
      console.log('✅ Default bundles seeded!');
    }

    // ── 9. Seed Default Team Members ──────────────────────
    const existingTeam = await db.select().from(teamMembers).limit(1);
    if (existingTeam.length === 0) {
      console.log('🌱 Seeding default team members...');
      await db.insert(teamMembers).values([
        {
          name: 'Dharmendra Sharma',
          role: 'Founder / CEO / MD',
          subtitle: 'Strategic Leadership & Agency Vision',
          description: 'Founder, CEO, and Managing Director driving WORKONOVA with a vision to build high-impact creative technology and performance marketing solutions.',
          bio: 'Dharmendra Sharma is the visionary Founder and CEO of WORKONOVA. With over a decade of leadership in software design and digital agency consulting, Dharmendra has pioneered the anonymized workspace concept to eliminate cognitive bias and bring pure project delivery quality to the forefront of creative operations.',
          uniqueFact: 'Maintains a personal daily focus of reviewing the active QC queue to guarantee every custom client deliverable meets aesthetic thresholds.',
          image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
          orderIndex: 0
        },
        {
          name: 'Sanjay Yadav',
          role: 'Co-Founder / HR',
          subtitle: 'People Strategy & Operations',
          description: 'Co-Founder & HR Director managing company culture, talent acquisition, operational efficiency, and client excellence.',
          bio: 'Sanjay Yadav is the Co-Founder and HR Director at WORKONOVA, managing organizational growth, talent retention, and operations compliance. Sanjay specializes in vetting the top 3% of creative and technical talent across India.',
          uniqueFact: 'Has personally vetted and interviewed over 1,200 professional creators to build our agile talent roster.',
          image: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=600&q=80',
          orderIndex: 1
        },
        {
          name: 'Harshit Bhatt',
          role: 'Digital Marketing, SEO & SMM Expert',
          subtitle: 'Meta Ads, SEO & Social Media Growth',
          description: 'Performance marketing specialist driving high-ROAS Meta Ads campaigns, search engine ranking (SEO), and social media growth funnels.',
          bio: 'Harshit Bhatt leads the Digital Marketing and Growth department at WORKONOVA. A performance marketing specialist with high-velocity campaign experience, Harshit designs paid advertising setups (Meta & Google Ads) and search engine optimization maps.',
          uniqueFact: 'Averaged a verified 4.2x ROAS across high-scale advertising campaigns in the last fiscal quarter.',
          image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80',
          orderIndex: 2
        },
        {
          name: 'Prachi',
          role: 'Creative & Graphic Design Lead',
          subtitle: 'UI/UX & Brand Identity Design',
          description: 'Leading creative graphics, brand visual identity, and aesthetic UI/UX experiences across web and mobile platforms.',
          bio: 'Prachi is the Creative and Graphic Design Lead at WORKONOVA. Possessing a deep background in fine arts and digital UI/UX design, Prachi leads the branding, design system curation, and visual direction of all premium creative assets.',
          uniqueFact: 'Has designed and consulted on brand identity packages for over 80 startups worldwide.',
          image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80',
          orderIndex: 3
        }
      ]);
      console.log('✅ Default team members seeded!');
    }

    console.log('🎉 Database initialization complete!');
  } catch (err: any) {
    console.error('❌ Database initialization error:', err);
  }
}

// Direct CLI execution: `npx tsx src/db/init.ts`
if (process.argv[1]?.endsWith('init.ts') || process.argv[1]?.endsWith('init.js')) {
  initDatabase().then(() => process.exit(0));
}
