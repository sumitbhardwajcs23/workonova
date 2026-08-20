import { useState, useEffect, useRef } from 'react';
import { getUser, getToken, logout } from '../utils/auth.js';
import WelcomePopup from '../components/WelcomePopup.tsx';
import { downloadClientInvoicePDF } from '../utils/pdfInvoice.js';
import { API_BASE } from '../config.js';
import './ClientDashboard.css';

// ── TYPES & INTERFACES ────────────────────────────────────────
interface Order {
  id: number;
  serviceCategory: string;
  tier: string;
  price: number;
  status: string;
  milestoneStage?: number;
  amountPaid?: number;
  description: string;
  submissionLink: string;
  midpointSubmissionLink?: string;
  midpointSubmissionNotes?: string;
  midpointApprovedAt?: string;
  freelancerSubmissionLink?: string;
  qaApprovedLink?: string;
  payoutStatus?: string;
  paymentId?: string;
  razorpayOrderId?: string;
  freelancerId?: number;
  assignedFreelancerIds?: string;
  deadline?: string;
  durationValue?: number;
  durationUnit?: string;
  projectNotice?: string;
  createdAt: string;
  adminRevisionComments?: string;
}

interface Message {
  id: number;
  orderId: number;
  senderId: number;
  senderRole: string;
  messageText: string;
  createdAt: string;
}

interface Project {
  id: string;
  dbId?: number;
  title: string;
  category: 'web' | 'design' | 'video' | 'ai' | 'content';
  freelancer: string;
  status: 'In Progress' | 'In Review' | 'Delivered' | 'Cancelled' | 'Submitted' | 'Client Approved';
  rawStatus?: string;
  milestoneStage?: number;
  amountPaid?: number;
  midpointSubmissionLink?: string;
  midpointSubmissionNotes?: string;
  midpointApprovedAt?: string;
  tier?: string;
  paymentId?: string;
  razorpayOrderId?: string;
  placedDate: string;
  estDelivery: string;
  deadline?: string;
  durationValue?: number;
  durationUnit?: string;
  projectNotice?: string;
  amount: number;
  currentStep: number;
  stepDates: string[];
  assets: Array<{ name: string; url: string }>;
  updates: Array<{ date: string; text: string }>;
  deliverables: { title: string; links: Array<{ name: string; url: string }> };
  revisionsLeft: number;
  slaHoursRemaining?: number;
  discussion: Array<{ sender: string; text: string; time: string; type: 'admin' | 'team' | 'client' }>;
}

interface Notification {
  id: string;
  title: string;
  desc: string;
  time: string;
  unread: boolean;
}

// ── FIXED BUNDLES CATALOG FOR ADD-ONS ──────────────────────────
const ADDON_CATALOG: Record<string, Array<{ label: string; cost: number; desc: string }>> = {
  web: [
    { label: 'Extra Staging / Thank You Page', cost: 2500, desc: 'Includes responsive build + email subscription webhook link.' },
    { label: 'Full SEO optimization (Lighthouse 100)', cost: 4500, desc: 'Meta tags, semantic structure and speed optimizations.' }
  ],
  ai: [{ label: 'Additional CRM webhook link', cost: 2000, desc: 'Sync data to HubSpot / Salesforce' }],
  video: [{ label: 'Add-on 1 Additional Edited Reel', cost: 2000, desc: '30s cuts from original footage pool' }],
  design: [{ label: '2 Extra Carousel Ad Variations', cost: 3500, desc: 'Figma layouts formatted for LinkedIn and Instagram' }]
};

// ── BRAND PROFILE DATA ──────────────────────────────────────────
interface BrandProfile {
  name: string;
  logo: string;
  colors: string[];
  font: string;
  driveLink: string;
  briefs: string[];
}

const INITIAL_BRAND_PROFILES: Record<string, BrandProfile> = {};

const serviceCategories = [
  'Graphic Designing', 'Video Editing', '3D Design & Modeling', 'VFX',
  'Animation', 'Digital Marketing', 'Website Development', 'Software Development',
  'App Development', 'AI Services', 'IT Services', 'Cyber Security'
];

const pricingTiers = [
  {
    name: 'Starter Creative',
    tag: 'silver',
    price: 14999,
    period: '/ Monthly',
    badge: 'STARTUPS & SOLO CREATORS',
    desc: 'Ideal for early-stage startups and creators needing high-impact graphics and short video edits.',
    features: ['15 Graphic Design Creatives / Month', '4 Edited Video Reels (up to 60s)', 'Basic On-Page SEO / Social Management', 'Turnaround Time: 48 Hours', 'Dedicated Communication']
  },
  {
    name: 'Growth Tech & Ads Suite',
    tag: 'gold',
    price: 34999,
    period: '/ Monthly',
    badge: 'MOST POPULAR · SCALING BRANDS',
    desc: 'Our most popular bundle for scaling brands looking for full high-converting website + ads + content.',
    features: ['30 Graphic Design Creatives & Banners', '10 Viral Video Reels / Shorts', 'Full Meta & Google Ads Campaign Setup', '1 Custom High-Speed React / WP Landing Page', 'Monthly ROI Dashboard & Weekly Strategy Call', 'Priority 24-Hour Turnaround']
  },
  {
    name: 'Enterprise Premium',
    tag: 'custom',
    price: 79999,
    period: '/ Monthly',
    badge: 'ENTERPRISES & HIGH-SCALE BRANDS',
    desc: 'All-inclusive digital powerhouse for established brands needing custom software, 3D/VFX, and AI automation.',
    features: ['Unlimited Graphic & Motion Graphics Requests', 'Full Stack Software / Mobile App / AI Bot Build', '3D Product Renders & VFX Ads Production', 'Omnichannel Digital Marketing & Lead Gen', 'Dedicated Creative Director + Lead Developer', '1-on-1 Direct Access to Leadership']
  }
];

const CATEGORY_PRICING_CATALOG: Record<string, Array<{ name: string; tag: string; price: number; period: string; badge: string; desc: string; features: string[] }>> = {
  'Website Development': [
    { name: 'Starter Landing Page', tag: 'silver', price: 14999, period: '/ One-time', badge: 'STARTER WEB', desc: 'Single high-converting landing page with modern responsive design.', features: ['1 Responsive Landing Page (React / WP)', 'Contact Form & Email Integration', 'Basic On-Page SEO & Speed Optimization', '48-Hour Rapid Delivery', '1 Round of Free Revisions'] },
    { name: 'Growth Business Portal', tag: 'gold', price: 34999, period: '/ One-time', badge: 'MOST POPULAR', desc: 'Complete multi-page corporate website with admin dashboard & analytics.', features: ['Up to 6 Custom Pages + CMS Admin', 'E-Commerce / Payment Gateway Setup', 'Full Technical & Mobile SEO (Lighthouse 95+)', 'Database & API Backend Integration', '3 Rounds of Free Revisions'] },
    { name: 'Enterprise Custom Platform', tag: 'custom', price: 79999, period: '/ Project', badge: 'ENTERPRISE WEB', desc: 'Custom SaaS web platform or complex web application built to scale.', features: ['Custom Full-Stack Web App (Next.js / Node / PG)', 'Role-Based User Dashboards & Subscriptions', 'High-Scale Cloud Architecture & Security Audit', 'Dedicated Lead Fullstack Engineer', 'Unlimited Revisions until Launch'] }
  ],
  'Graphic Designing': [
    { name: 'Starter Creative Pack', tag: 'silver', price: 9999, period: '/ Monthly', badge: 'STARTER DESIGN', desc: 'Essential social media graphics & promo banners for active handles.', features: ['12 Social Media Post Creatives', '2 Ad Banner Sets (Meta/Google)', 'Source Files Delivered (Figma/PSD)', '72-Hour Turnaround Time', '2 Revision Rounds'] },
    { name: 'Growth Brand Identity', tag: 'gold', price: 24999, period: '/ Monthly', badge: 'MOST POPULAR', desc: 'Complete brand visual identity, UI graphics, and marketing collaterals.', features: ['30 High-Res Creatives & Carousels', 'Full Brand Guidelines & Logo Suite', 'Product Packaging / Label Design', 'Dedicated Senior Graphic Designer', 'Priority 24-Hour Delivery'] },
    { name: 'Enterprise Design Studio', tag: 'custom', price: 54999, period: '/ Monthly', badge: 'ENTERPRISE DESIGN', desc: 'Dedicated design team producing unlimited graphic requests & UI design.', features: ['Unlimited Graphic & UI/UX Requests', 'Design System & Component Library', '3D Graphics & Motion Elements', 'Direct 1-on-1 Access to Creative Lead', 'Same-Day Urgent Turnaround'] }
  ],
  'Video Editing': [
    { name: 'Starter Reels Pack', tag: 'silver', price: 12999, period: '/ Monthly', badge: 'STARTER VIDEO', desc: 'Short-form reels & shorts edited with dynamic captions and cuts.', features: ['5 Short-Form Reels / Shorts (up to 60s)', 'Engaging Dynamic Captions & Sound Effects', 'Basic Color Correction & Audio Clean', '48-Hour Turnaround', '2 Revisions per Video'] },
    { name: 'Growth Creator Suite', tag: 'gold', price: 29999, period: '/ Monthly', badge: 'MOST POPULAR', desc: 'High-production video content for YouTube long-form, ads, and reels.', features: ['12 Viral Reels / Shorts', '2 YouTube Long-Form Videos (10-15 mins)', 'Advanced Motion Graphics & Lower Thirds', 'Color Grading & Sound Design', 'Priority 24-Hour Delivery'] },
    { name: 'Enterprise VFX Production', tag: 'custom', price: 69999, period: '/ Monthly', badge: 'ENTERPRISE VIDEO', desc: 'Full post-production pipeline including 3D tracking, VFX, and commercials.', features: ['Unlimited Short & Long-Form Video Edits', 'Custom 3D VFX & Green Screen Compositing', 'Commercial Ad Production Suite', 'Dedicated Senior Video Editor', 'Unlimited Revisions'] }
  ],
  'App Development': [
    { name: 'Starter MVP App', tag: 'silver', price: 39999, period: '/ Project', badge: 'STARTER APP', desc: 'Core feature mobile application for Android & iOS testing.', features: ['Cross-Platform App (React Native / Flutter)', 'User Authentication & Database Setup', 'Google Play Store / App Store Submission', '2-Week Rapid Build', 'Bug-Fix Guarantee'] },
    { name: 'Growth Business App', tag: 'gold', price: 79999, period: '/ Project', badge: 'MOST POPULAR', desc: 'Full-featured mobile application with payment, push notifications & admin.', features: ['iOS & Android App with Custom UI/UX', 'Push Notifications & Payment Gateway', 'Admin Management Portal & Analytics', 'API & Third-Party Webhook Integrations', '30 Days Post-Launch Support'] },
    { name: 'Enterprise Custom App', tag: 'custom', price: 149999, period: '/ Project', badge: 'ENTERPRISE APP', desc: 'High-performance scalable native app architecture for large platforms.', features: ['High-Concurrency Architecture & Microservices', 'Real-Time Chat / Geo-Tracking / Offline Sync', 'Dedicated Mobile Architect & Security Audit', 'End-to-End SLA & Source Code Handover', '6 Months SLA Maintenance'] }
  ],
  'AI Services': [
    { name: 'Starter AI Bot', tag: 'silver', price: 19999, period: '/ One-time', badge: 'STARTER AI', desc: 'Custom AI chatbot trained on your business documents and FAQs.', features: ['Custom Knowledge-Base AI Chatbot', 'Website Widget & WhatsApp Integration', 'Lead Capture & Email Webhook Sync', '72-Hour Deployment', 'Basic Analytics Dashboard'] },
    { name: 'Growth AI Automation', tag: 'gold', price: 44999, period: '/ One-time', badge: 'MOST POPULAR', desc: 'Multi-agent AI workflows automating support, content, and data ops.', features: ['Autonomous AI Agent Workflows (Gemini/GPT-4)', 'CRM & Database Integration (HubSpot/Salesforce)', 'AI Image/Voice/Text Content Pipeline', 'Custom Dashboard & Fine-Tuned Prompts', 'Full Workflow Training'] },
    { name: 'Enterprise AI Ecosystem', tag: 'custom', price: 99999, period: '/ Project', badge: 'ENTERPRISE AI', desc: 'Proprietary AI model integration, vector search & enterprise automation.', features: ['Fine-Tuned LLM / RAG Vector Database System', 'Self-Hosted Secure AI Infrastructure', 'Omnichannel AI Support & Phone Voice Bots', 'Dedicated AI Engineer & SLA', 'Continuous Model Fine-Tuning'] }
  ]
};

const CAT_META: Record<string, { icon: string; label: string; subs: string[] }> = {
  video:   { icon: '🎬', label: 'Video & Motion',          subs: ['Short-Form Reels / Shorts', 'YouTube Long-Form', '2D/3D Motion Graphics'] },
  design:  { icon: '🎨', label: 'Graphic & Brand Design',  subs: ['UI/UX Design (Figma)', 'Graphic Design & Ads', 'Brand Identity & Logos'] },
  web:     { icon: '🌐', label: 'Web & Software Dev',      subs: ['Web Development', 'E-Commerce & Custom CMS'] },
  ai:      { icon: '⚡', label: 'AI & Automation',         subs: ['AI Agents & Chatbots', 'Workflow Automation'] },
  content: { icon: '✍️', label: 'Content & Marketing',     subs: [] }
};

function getActiveCategoryTiers(cat: string, dbBundlesList: any[] = []) {
  const customCategoryBundles = dbBundlesList.filter(
    b => (b.category || 'All Services') === cat
  );

  if (customCategoryBundles.length > 0) {
    return customCategoryBundles.map(b => {
      const features = typeof b.features === 'string' ? JSON.parse(b.features) : b.features;
      const cleanPrice = parseInt(String(b.price).replace(/[^0-9]/g, '')) || 14999;
      let tagKey = 'silver';
      if (b.tag?.toLowerCase().includes('gold') || b.popular === 1) tagKey = 'gold';
      else if (b.tag?.toLowerCase().includes('custom') || b.tag?.toLowerCase().includes('enterprise')) tagKey = 'custom';

      return {
        name: b.name,
        tag: tagKey,
        price: cleanPrice,
        period: b.period || '/ Monthly',
        badge: b.tag || 'PACKAGE TIER',
        desc: b.description,
        features: Array.isArray(features) ? features : []
      };
    });
  }

  if (CATEGORY_PRICING_CATALOG[cat]) {
    return CATEGORY_PRICING_CATALOG[cat];
  }
  return pricingTiers;
}

// ── HELPERS ────────────────────────────────────────────────────
function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

function statusClass(status: string) {
  return status.toLowerCase().replace(' ', '-');
}

// ══════════════════════════════════════════════════════════════
// PROJECT CARD COMPONENT
// ══════════════════════════════════════════════════════════════
function ProjectCard({
  project, onOpenRevision, onOpenApprove, onOpenAddon, onOpenThread, onDownloadInvoice, triggerToast
}: {
  project: Project;
  onOpenRevision: () => void;
  onOpenApprove: () => void;
  onOpenAddon: () => void;
  onOpenThread: () => void;
  onDownloadInvoice: () => void;
  triggerToast: (msg: string) => void;
}) {
  const stepLabels = ['Submitted', 'In Progress', 'In Review', 'Delivered'];
  const percentSla = project.slaHoursRemaining ? Math.round((project.slaHoursRemaining / 72) * 100) : 0;

  // Milestone status computations
  const isM1Paid = project.rawStatus !== 'pending_payment';
  const isM2Ready = project.rawStatus === 'midpoint_submitted';
  const isM2Paid = ['midpoint_approved', 'paid_75', 'submitted', 'qa_approved', 'client_approved', 'completed', 'delivered'].includes(project.rawStatus || '') || (project.milestoneStage || 1) >= 2;
  const isM3Ready = ['submitted', 'qa_approved'].includes(project.rawStatus || '');
  const isM3Paid = ['client_approved', 'completed', 'delivered'].includes(project.rawStatus || '') || (project.milestoneStage || 1) >= 3;

  return (
    <article className={`cd-project-card cat-${project.category}`}>
      {/* Card Header */}
      <div className="cd-card-head">
        <div className="cd-card-tags">
          <span className={`cd-cat-pill ${project.category}`}>{project.category.toUpperCase()}</span>
          <span className="cd-order-id">ORDER #{project.id.replace('db-', '')}</span>
        </div>
        <div className="cd-card-right">
          <span className={`cd-status-pill ${statusClass(project.status)}`}>{project.status}</span>
          <span className="cd-assigned">Assigned: <b>{project.freelancer}</b></span>
        </div>
      </div>

      {/* Card Body */}
      <div className="cd-card-body">
        <h2 className="cd-project-title">{project.title}</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', margin: '4px 0 10px 0', fontSize: 12 }}>
          <span style={{ color: '#64748b' }}>Placed: {project.placedDate}</span>
          <span style={{ color: '#cbd5e1' }}>•</span>
          {project.durationValue ? (
            <span style={{ color: '#059669', fontWeight: 600, background: '#ecfdf5', padding: '2px 7px', borderRadius: 4, border: '1px solid #a7f3d0' }}>
              ⏱️ Time Limit: {project.durationValue} {project.durationUnit || 'days'}
            </span>
          ) : null}
          <span style={{ color: '#cbd5e1' }}>•</span>
          <span style={{ color: '#4f46e5', fontWeight: 600 }}>
            📅 Target Delivery: <b>{project.deadline ? new Date(project.deadline).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : project.estDelivery}</b>
          </span>
        </div>

        {/* Project Notice Box if set */}
        {project.projectNotice && (
          <div style={{ background: '#f8fafc', borderLeft: '3px solid #6366f1', padding: '6px 12px', borderRadius: 4, fontSize: 11.5, color: '#334155', marginBottom: 12 }}>
            <b>📝 Project Notice / Scope Guidelines:</b> "{project.projectNotice}"
          </div>
        )}

        {/* 4-Step Progress Tracker */}
        <div className="cd-stepper">
          {stepLabels.map((label, i) => {
            const isDone = i < project.currentStep;
            const isCurrent = i === project.currentStep;
            const circleClass = isDone ? 'done' : isCurrent ? 'current' : 'future';
            const lineClass = i < project.currentStep ? 'done' : '';
            return (
              <div key={i} className="cd-step">
                <div className="cd-step-track">
                  <div className={`cd-step-circle ${circleClass}`}>
                    {isDone ? '✓' : isCurrent ? '●' : '○'}
                  </div>
                  {i < 3 && <div className={`cd-step-line ${lineClass}`} />}
                </div>
                <div className="cd-step-label">{label}</div>
                <div className="cd-step-date">{project.stepDates[i] || ''}</div>
              </div>
            );
          })}
        </div>

        {/* ════ 3-STAGE MILESTONE ESCROW ROADMAP ════ */}
        <div style={{
          background: '#0f172a',
          border: '1px solid #334155',
          borderRadius: 10,
          padding: '14px 16px',
          marginTop: 16,
          color: '#ffffff'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, color: '#a5b4fc', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
              🛡️ 3-Stage Escrow Protection (50% → 25% → 25%)
            </span>
            <span style={{ fontSize: 11.5, background: 'rgba(99, 102, 241, 0.2)', border: '1px solid #6366f1', padding: '2px 8px', borderRadius: 4, color: '#c7d2fe', fontWeight: 600 }}>
              Order Value: ₹{project.amount.toLocaleString('en-IN')}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
            {/* Stage 1: 50% Kickoff */}
            <div style={{
              background: isM1Paid ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
              border: `1px solid ${isM1Paid ? '#10b981' : '#f59e0b'}`,
              borderRadius: 8,
              padding: 10,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: isM1Paid ? '#34d399' : '#fbbf24' }}>
                {isM1Paid ? '✓ Stage 1 (50% Paid)' : '⏳ Stage 1 (50% Due)'}
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, marginTop: 2, color: '#ffffff' }}>
                ₹{Math.round(project.amount * 0.5).toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                {isM1Paid ? 'Kickoff Secured · Specialist Assigned' : 'Pay 50% to start production'}
              </div>
            </div>

            {/* Stage 2: 50% Midpoint Review & 25% Payment */}
            <div style={{
              background: isM2Paid ? 'rgba(16, 185, 129, 0.12)' : (isM2Ready ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.05)'),
              border: `1px solid ${isM2Paid ? '#10b981' : (isM2Ready ? '#818cf8' : '#334155')}`,
              borderRadius: 8,
              padding: 10,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: isM2Paid ? '#34d399' : (isM2Ready ? '#a5b4fc' : '#94a3b8') }}>
                {isM2Paid ? '✓ Stage 2 (25% Paid)' : (isM2Ready ? '🔔 50% Work Ready for Review!' : '○ Stage 2 (25% Midpoint)')}
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, marginTop: 2, color: '#ffffff' }}>
                ₹{Math.round(project.amount * 0.25).toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                {isM2Paid ? 'Midpoint Approved & Paid' : (isM2Ready ? 'Review Draft & Pay 25%' : 'After 50% Work Uploaded')}
              </div>
            </div>

            {/* Stage 3: 100% Final Delivery & 25% Balance */}
            <div style={{
              background: isM3Paid ? 'rgba(16, 185, 129, 0.12)' : (isM3Ready ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.05)'),
              border: `1px solid ${isM3Paid ? '#10b981' : (isM3Ready ? '#34d399' : '#334155')}`,
              borderRadius: 8,
              padding: 10,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: isM3Paid ? '#34d399' : (isM3Ready ? '#34d399' : '#94a3b8') }}>
                {isM3Paid ? '✓ Stage 3 (100% Paid)' : (isM3Ready ? '🚀 Final Deliverables Ready!' : '○ Stage 3 (25% Balance)')}
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, marginTop: 2, color: '#ffffff' }}>
                ₹{Math.round(project.amount * 0.25).toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                {isM3Paid ? 'Fully Settled & Delivered' : (isM3Ready ? 'Review Finals & Pay 25%' : 'On 100% Delivery')}
              </div>
            </div>
          </div>

          {/* Actionable Stage Alert Buttons */}
          {['on_demand_review', 'pending_advance'].includes(project.rawStatus || '') && (
            <div style={{ marginTop: 14, background: 'rgba(245, 158, 11, 0.15)', border: '1px solid #f59e0b', borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <b style={{ fontSize: 13, color: '#fef3c7' }}>⚡ Custom Brief Under Scoping Review (₹100 Advance Paid ✓)</b>
                <p style={{ margin: '3px 0 0 0', fontSize: 12, color: '#fde68a' }}>
                  Workonova Leadership is evaluating your custom requirements. A customized price quote will be issued here shortly.
                </p>
              </div>
              <button
                className="cd-btn-primary"
                style={{ padding: '8px 16px', fontSize: 12.5, fontWeight: 700, background: '#f59e0b', borderColor: '#d97706', color: '#111827' }}
                onClick={onOpenThread}
              >
                💬 Discussion Thread
              </button>
            </div>
          )}

          {project.rawStatus === 'quote_provided' && (
            <div style={{ marginTop: 14, background: 'rgba(99, 102, 241, 0.25)', border: '1px solid #818cf8', borderRadius: 8, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <b style={{ fontSize: 14, color: '#ffffff' }}>🎉 Custom Scope Quoted: ₹{project.amount.toLocaleString('en-IN')}</b>
                <p style={{ margin: '3px 0 0 0', fontSize: 12, color: '#c7d2fe' }}>
                  Admin quote ready. Authorize 50% Kickoff milestone (₹{Math.round(project.amount * 0.5).toLocaleString('en-IN')}) to begin production.
                </p>
              </div>
              <button
                className="cd-btn-primary"
                style={{ padding: '9px 18px', fontSize: 13, fontWeight: 700, background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', borderColor: '#4338ca' }}
                onClick={onOpenApprove}
              >
                💳 Accept &amp; Pay 50% Kickoff (₹{Math.round(project.amount * 0.5).toLocaleString('en-IN')}) →
              </button>
            </div>
          )}

          {project.rawStatus === 'midpoint_submitted' && (
            <div style={{ marginTop: 14, background: 'rgba(99, 102, 241, 0.2)', border: '1px solid #6366f1', borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <b style={{ fontSize: 13, color: '#ffffff' }}>🔔 50% Midpoint Deliverable Uploaded by Specialist!</b>
                <p style={{ margin: '3px 0 0 0', fontSize: 12, color: '#c7d2fe' }}>
                  Preview intermediate drafts/prototype. Approving unlocks Milestone 2 payment (25% = ₹{Math.round(project.amount * 0.25).toLocaleString('en-IN')}) so your specialist can finalize the rest.
                </p>
              </div>
              <button
                className="cd-btn-primary"
                style={{ padding: '8px 16px', fontSize: 12.5, fontWeight: 700, background: '#6366f1', borderColor: '#4f46e5' }}
                onClick={onOpenApprove}
              >
                🔍 Review 50% Midpoint &amp; Pay 25% →
              </button>
            </div>
          )}

          {['submitted', 'qa_approved'].includes(project.rawStatus || '') && (
            <div style={{ marginTop: 14, background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <b style={{ fontSize: 13, color: '#ffffff' }}>🚀 100% Final Deliverables Ready for Your Review!</b>
                <p style={{ margin: '3px 0 0 0', fontSize: 12, color: '#a7f3d0' }}>
                  Review completed files. Approving will finalize your order and authorize the remaining 25% balance payment.
                </p>
              </div>
              <button
                className="cd-btn-primary"
                style={{ padding: '8px 16px', fontSize: 12.5, fontWeight: 700, background: '#10b981', borderColor: '#059669' }}
                onClick={onOpenApprove}
              >
                ⭐ Review 100% Final Work &amp; Pay 25% →
              </button>
            </div>
          )}
        </div>

        {/* SLA Countdown */}
        {project.status === 'In Review' && project.slaHoursRemaining !== undefined && (
          <div className="cd-sla-bar" style={{ marginTop: 14 }}>
            <div className="cd-sla-bar-header">
              <span>⏰ Review SLA (Auto-Approves in {project.slaHoursRemaining} Hours)</span>
              <span className="cd-sla-countdown">{String(project.slaHoursRemaining).padStart(2, '0')}:00:00</span>
            </div>
            <div className="cd-sla-track">
              <div className="cd-sla-fill" style={{ width: `${percentSla}%` }} />
            </div>
            <p className="cd-sla-sub">Payment releases automatically if no revisions are asked within the countdown.</p>
          </div>
        )}

        {/* Production Milestones */}
        <div className="cd-sub-heading">Production Milestones</div>
        <div className="cd-milestones">
          {project.updates.map((u, i) => (
            <div key={i} className="cd-milestone">
              <span className="cd-milestone-date">{u.date}</span>
              <span className="cd-milestone-dot" />
              <span>{u.text}</span>
            </div>
          ))}
        </div>

        {/* Assets & Files */}
        <div className="cd-sub-heading assets">Project Assets &amp; Files</div>
        <div className="cd-assets">
          {project.assets.map((a, i) => (
            <a key={i} className="cd-asset-pill" href={a.url} target="_blank" rel="noopener noreferrer">
              📄 {a.name}
            </a>
          ))}
          <button className="cd-asset-pill" onClick={() => triggerToast('✏️ Opening asset upload editor...')}>
            ✎ Update Assets
          </button>
        </div>

        {/* Deliverables */}
        <div className="cd-sub-heading deliverables">Deliverables</div>
        <div className="cd-deliverables-box">
          <div className="cd-deliverables-title">
            📎 {project.deliverables.title}
            {project.status !== 'In Review' && project.status !== 'Delivered' && (
              <small>Downloads unlock when review is ready</small>
            )}
          </div>
          <div className="cd-deliverables-links">
            {(project.status === 'In Review' || project.status === 'Delivered') ? (
              <>
                {project.deliverables.links.map((l, i) => (
                  <a key={i} className="cd-dl-btn primary" href={l.url} target="_blank" rel="noopener noreferrer">
                    {l.name}
                  </a>
                ))}
                {project.deliverables.links.length === 0 && (
                  <span className="cd-dl-btn locked">⚠️ Waiting for QA-approved asset links</span>
                )}
              </>
            ) : (
              <span className="cd-dl-btn locked">⇩ Downloads unlock when review is ready</span>
            )}
          </div>
        </div>
      </div>

      {/* Action Row */}
      <div className="cd-card-actions" style={{ flexWrap: 'wrap', gap: 8 }}>
        {project.status === 'In Review' && (
          <>
            <button className="cd-action-btn" onClick={onOpenRevision}>
              🔄 Request Revision <span style={{ opacity: 0.7 }}>({project.revisionsLeft} left)</span>
            </button>
            <button className="cd-action-btn primary-action" onClick={onOpenApprove}>
              {project.rawStatus === 'midpoint_submitted' ? '✅ Review 50% Midpoint & Pay 25%' : '✅ Approve Final Deliverables'}
            </button>
          </>
        )}
        {project.status === 'In Progress' && (
          <button className="cd-action-btn" onClick={onOpenAddon}>
            ➕ Request Scope Add-on
          </button>
        )}
        <button className="cd-action-btn" onClick={onOpenThread}>
          💬 Discussion ({project.discussion.length})
        </button>

        {/* 📄 Direct PDF Tax Invoice Download on EVERY Project Card */}
        <button
          className="cd-action-btn"
          style={{ background: '#1e293b', color: '#ffffff', border: '1px solid #475569', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          onClick={onDownloadInvoice}
        >
          📄 Download GST Tax Invoice (PDF)
        </button>
      </div>
    </article>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ══════════════════════════════════════════════════════════════
export default function ClientDashboard() {
  const user = getUser();
  const token = getToken();

  // ── CORE DATA STATES ──────────────────────────────────────────
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  // ── NAVIGATION & VIEW ──────────────────────────────────────────
  const [currentView, setCurrentView] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── HEADER & DROP OVERLAYS ────────────────────────────────────
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);

  const [notifications, setNotifications] = useState<Notification[]>([]);

  // ── BRAND VAULT STATE ─────────────────────────────────────────
  const [brandProfiles, setBrandProfiles] = useState<Record<string, BrandProfile>>(INITIAL_BRAND_PROFILES);
  const [selectedBrandKey, setSelectedBrandKey] = useState('');

  // ── BILLING & GST STATE ───────────────────────────────────────
  const [billingDetails, setBillingDetails] = useState({
    companyName: '',
    gstNumber: '',
    billingEmail: '',
    billingAddress: ''
  });

  // ── SUPPORT STATE ─────────────────────────────────────────────
  const [supportSubject, setSupportSubject] = useState('Project-related question');
  const [supportOrderId, setSupportOrderId] = useState('');
  const [supportMessage, setSupportMessage] = useState('');

  const [activeProjectForModal, setActiveProjectForModal] = useState<Project | null>(null);
  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false);
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);
  const [addonModalOpen, setAddonModalOpen] = useState(false);
  const [threadModalOpen, setThreadModalOpen] = useState(false);
  const [newBrandModalOpen, setNewBrandModalOpen] = useState(false);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [billingModalOpen, setBillingModalOpen] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackRole, setFeedbackRole] = useState('');
  const [feedbackQuote, setFeedbackQuote] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  // Custom On-Demand Order Modal States
  const [customOrderModalOpen, setCustomOrderModalOpen] = useState(false);
  const [customCategory, setCustomCategory] = useState(serviceCategories[0]);
  const [customBrief, setCustomBrief] = useState('');
  const [customLink, setCustomLink] = useState('');
  const [customBudget, setCustomBudget] = useState('');
  const [customDurationValue, setCustomDurationValue] = useState<number | ''>('');
  const [customDurationUnit, setCustomDurationUnit] = useState<string>('days');
  const [customDeadline, setCustomDeadline] = useState<string>('');
  const [customNotice, setCustomNotice] = useState<string>('');
  const [customSubmitting, setCustomSubmitting] = useState(false);

  // Modal fields
  const [newProjCategory, setNewProjCategory] = useState(serviceCategories[0]);
  const [newProjTier, setNewProjTier] = useState('silver');
  const [newProjPrice, setNewProjPrice] = useState(14999);
  const [newProjBrief, setNewProjBrief] = useState('');
  const [newProjLink, setNewProjLink] = useState('');
  const [newProjDurationValue, setNewProjDurationValue] = useState<number | ''>('');
  const [newProjDurationUnit, setNewProjDurationUnit] = useState<string>('days');
  const [newProjDeadline, setNewProjDeadline] = useState<string>('');
  const [newProjNotice, setNewProjNotice] = useState<string>('');
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  const [revWebUrl, setRevWebUrl] = useState('');
  const [revWebIssueType, setRevWebIssueType] = useState('bug');
  const [revWebDesc, setRevWebDesc] = useState('');
  const [revVidTime, setRevVidTime] = useState('');
  const [revVidDesc, setRevVidDesc] = useState('');
  const [revVidNotes, setRevVidNotes] = useState('');
  const [revDesignItem, setRevDesignItem] = useState('Ad Creative #1 (Facebook Feed)');
  const [revDesignDesc, setRevDesignDesc] = useState('');

  const [selectedAddonIndex, setSelectedAddonIndex] = useState<number | null>(null);
  const [ac1, setAc1] = useState(false);
  const [ac2, setAc2] = useState(false);
  const [ac3, setAc3] = useState(false);

  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);

  const [newBrandName, setNewBrandName] = useState('');
  const [newBrandIndustry, setNewBrandIndustry] = useState('');
  const [newBrandColor, setNewBrandColor] = useState('#56c41a');
  const [newBrandFolder, setNewBrandFolder] = useState('');

  const [testimonialQuote, setTestimonialQuote] = useState('');
  const [testimonialStars, setTestimonialStars] = useState(5);

  // ── PROFILE & EMAIL CHANGE OTP STATE ──────────────────────────
  const [clientProfile, setClientProfile] = useState<{ name: string; email: string; phone?: string } | null>(null);
  const [editName, setEditName] = useState(user?.name || '');
  const [editPhone, setEditPhone] = useState((user as any)?.phone || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [emailChangeModalOpen, setEmailChangeModalOpen] = useState(false);
  const [newEmailInput, setNewEmailInput] = useState('');
  const [emailOtpInput, setEmailOtpInput] = useState('');
  const [emailOtpSent, setEmailOtpSent] = useState(false);

  const toastTimerRef = useRef<any>(null);

  // ── TOAST ─────────────────────────────────────────────────────
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastVisible(false), 3500);
  };

  // ── KEYBOARD SHORTCUT ─────────────────────────────────────────
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, []);

  // ── FETCH ORDERS & LIVE BUNDLES ───────────────────────────────
  const [dbBundles, setDbBundles] = useState<any[]>([]);

  const fetchLiveBundles = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/public/bundles`);
      const data = await res.json();
      if (res.ok && data.data) {
        setDbBundles(data.data);
      }
    } catch (e) { console.error('Error fetching live bundles:', e); }
  };

  const fetchOrders = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/client/orders`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch orders');
      mergeOrdersAndTemplates(data.data || []);
    } catch (err: any) {
      if (!silent) triggerToast('❌ Error: ' + err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchLiveBundles();

    // Fast real-time synchronization (every 2s when tab is active)
    const syncInterval = setInterval(() => {
      if (!document.hidden) {
        fetchOrders(true);
      }
    }, 2000);

    // Instant sync when user switches back to tab or focuses window
    const handleVisibilitySync = () => {
      if (!document.hidden) {
        fetchOrders(true);
        fetchLiveBundles();
      }
    };

    window.addEventListener('focus', handleVisibilitySync);
    document.addEventListener('visibilitychange', handleVisibilitySync);

    return () => {
      clearInterval(syncInterval);
      window.removeEventListener('focus', handleVisibilitySync);
      document.removeEventListener('visibilitychange', handleVisibilitySync);
    };
  }, []);

  // ── CHAT POLLING (Real-time 1.2s sync when modal open) ───────────
  useEffect(() => {
    let interval: any;
    if (threadModalOpen && activeProjectForModal?.dbId) {
      fetchChatMessages(activeProjectForModal.dbId);
      interval = setInterval(() => {
        if (!document.hidden) {
          fetchChatMessages(activeProjectForModal.dbId!);
        }
      }, 1200);
    }
    return () => clearInterval(interval);
  }, [threadModalOpen, activeProjectForModal]);

  useEffect(() => { chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.profile) {
        setClientProfile(data.profile);
        setEditName(data.profile.name || user?.name || '');
        setEditPhone(data.profile.phone || '');
      }
    } catch (e) {
      console.error('Error fetching profile:', e);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: editName, phone: editPhone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile');
      triggerToast('✅ Profile updated successfully!');
      fetchProfile();
      const cur = getUser();
      if (cur) {
        cur.name = editName;
        (cur as any).phone = editPhone;
        localStorage.setItem('workonova_user', JSON.stringify(cur));
      }
    } catch (err: any) {
      triggerToast('❌ Error: ' + err.message);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleRequestEmailChange = async () => {
    if (!newEmailInput || !newEmailInput.includes('@')) {
      triggerToast('⚠️ Please enter a valid new email address.');
      return;
    }
    setProfileSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/profile/request-email-change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newEmail: newEmailInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send OTP to new email');
      setEmailOtpSent(true);
      triggerToast(`📧 Verification OTP sent to ${newEmailInput}`);
    } catch (err: any) {
      triggerToast('❌ Error: ' + err.message);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleVerifyEmailChange = async () => {
    if (!emailOtpInput || emailOtpInput.trim().length !== 6) {
      triggerToast('⚠️ Please enter the 6-digit OTP received in email.');
      return;
    }
    setProfileSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/profile/verify-email-change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newEmail: newEmailInput, otp: emailOtpInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid OTP');
      if (data.token) {
        localStorage.setItem('workonova_token', data.token);
      }
      const cur = getUser();
      if (cur) {
        cur.email = data.email || newEmailInput;
        localStorage.setItem('workonova_user', JSON.stringify(cur));
      }
      triggerToast('🎉 Email address successfully updated!');
      setEmailChangeModalOpen(false);
      setNewEmailInput('');
      setEmailOtpInput('');
      setEmailOtpSent(false);
      fetchProfile();
    } catch (err: any) {
      triggerToast('❌ Error: ' + err.message);
    } finally {
      setProfileSaving(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // ── MERGE ORDERS ──────────────────────────────────────────────
  const mergeOrdersAndTemplates = (orders: Order[]) => {
    const mappedDbProjects: Project[] = orders.map((o) => {
      let category: 'web' | 'design' | 'video' | 'ai' | 'content' = 'web';
      const cat = o.serviceCategory.toLowerCase();
      if (cat.includes('design') || cat.includes('logo') || cat.includes('brand') || cat.includes('graphic')) category = 'design';
      else if (cat.includes('video') || cat.includes('edit') || cat.includes('motion') || cat.includes('vfx') || cat.includes('anim')) category = 'video';
      else if (cat.includes('ai') || cat.includes('automation') || cat.includes('chatbot')) category = 'ai';
      else if (cat.includes('content') || cat.includes('marketing') || cat.includes('copy')) category = 'content';

      let status: 'Submitted' | 'In Progress' | 'In Review' | 'Delivered' | 'Cancelled' | 'Client Approved' = 'In Progress';
      let currentStep = 1;
      if (o.status === 'pending_advance') { status = 'Submitted'; currentStep = 0; }
      else if (o.status === 'on_demand_review') { status = 'In Review'; currentStep = 0; }
      else if (o.status === 'quote_provided') { status = 'In Review'; currentStep = 0; }
      else if (o.status === 'pending_payment') { status = 'Submitted'; currentStep = 0; }
      else if (o.status === 'paid' || o.status === 'paid_50' || o.status === 'assigned') { status = 'In Progress'; currentStep = 1; }
      else if (o.status === 'midpoint_submitted' || o.status === 'midpoint_approved') { status = 'In Review'; currentStep = 2; }
      else if (o.status === 'paid_75' || o.status === 'submitted') { status = 'In Progress'; currentStep = 2; }
      else if (o.status === 'qa_approved') { status = 'In Review'; currentStep = 2; }
      else if (o.status === 'revision_requested') { status = 'In Progress'; currentStep = 1; }
      else if (o.status === 'client_approved') { status = 'Client Approved'; currentStep = 3; }
      else if (o.status === 'completed' || o.status === 'delivered') { status = 'Delivered'; currentStep = 3; }
      else if (o.status === 'cancelled') { status = 'Cancelled'; currentStep = 0; }

      const createdDate = new Date(o.createdAt || Date.now());
      const estDate = o.deadline ? new Date(o.deadline) : new Date(createdDate.getTime() + 4 * 24 * 60 * 60 * 1000);
      const formattedCreated = createdDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
      const formattedEst = o.deadline
        ? estDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : estDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      const deliverableLinks = o.qaApprovedLink ? [{ name: '🖼️ Download Final QA Assets', url: o.qaApprovedLink }] : (o.midpointSubmissionLink ? [{ name: '📁 Preview 50% Midpoint Work', url: o.midpointSubmissionLink }] : []);
      const updates = [{ date: createdDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }), text: o.status === 'on_demand_review' ? '₹100 Advance received. Custom scoping under review.' : 'Intake brief successfully submitted.' }];
      if (o.adminRevisionComments) updates.unshift({ date: new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }), text: o.status === 'quote_provided' ? `Custom Quote: ₹${o.price.toLocaleString('en-IN')} — ${o.adminRevisionComments}` : `Revision requested: "${o.adminRevisionComments}"` });
      if (o.midpointSubmissionLink) updates.unshift({ date: new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }), text: `Specialist uploaded 50% Midpoint Deliverable.` });

      return {
        id: `db-${o.id}`, dbId: o.id, title: `${o.serviceCategory} - Order #${o.id}`, category,
        freelancer: ['pending_payment', 'pending_advance', 'on_demand_review', 'quote_provided'].includes(o.status) ? 'Not Assigned (Scoping)' : (o.freelancerId ? 'Workonova Specialist' : 'Workonova Specialist'),
        status, rawStatus: o.status,
        milestoneStage: o.milestoneStage || 1,
        amountPaid: o.amountPaid || 0,
        midpointSubmissionLink: o.midpointSubmissionLink,
        midpointSubmissionNotes: o.midpointSubmissionNotes,
        midpointApprovedAt: o.midpointApprovedAt,
        tier: o.tier,
        paymentId: o.paymentId,
        razorpayOrderId: o.razorpayOrderId,
        placedDate: formattedCreated, estDelivery: formattedEst, amount: o.price, currentStep,
        deadline: o.deadline,
        durationValue: o.durationValue,
        durationUnit: o.durationUnit,
        projectNotice: o.projectNotice,
        stepDates: [createdDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }), o.status !== 'pending_payment' ? 'In Progress' : 'Pending Intake', (o.status === 'submitted' || o.status === 'qa_approved' || o.status === 'delivered') ? 'Under Review' : 'Est. ' + formattedEst, o.status === 'delivered' ? 'Finalized' : 'Handoff'],
        assets: [{ name: 'Project Brief Link', url: o.submissionLink || '#' }],
        updates,
        deliverables: { title: o.qaApprovedLink ? 'QA approved finals are ready' : (o.midpointSubmissionLink ? '50% Midpoint Deliverables Ready' : 'Assets in Progress Pipeline'), links: deliverableLinks },
        revisionsLeft: 2, slaHoursRemaining: status === 'In Review' ? 72 : undefined, discussion: []
      };
    });

    setAllProjects(mappedDbProjects);
  };

  // ── CREATE CUSTOM ON-DEMAND ORDER (₹100 ADVANCE SCOPING FEE) ──
  const handleCreateCustomOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customBrief.trim()) {
      triggerToast('⚠️ Please provide your project requirements in the brief.');
      return;
    }
    if (customLink.trim()) {
      const drivePattern = /^(https?:\/\/)?(drive\.google\.com|dropbox\.com|.*\.dropbox\.com)\/.+$/;
      if (!drivePattern.test(customLink.trim())) {
        triggerToast('⚠️ Asset folder must be a valid Google Drive or Dropbox link.');
        return;
      }
    }

    setCustomSubmitting(true);
    try {
      // 1. Initialize ₹100 Advance Order on backend
      const res = await fetch(`${API_BASE}/api/client/custom-order/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          serviceCategory: customCategory,
          description: customBrief + (customBudget ? `\n[Client Budget / Timeline Target: ${customBudget}]` : ''),
          submissionLink: customLink.trim() || undefined,
          durationValue: customDurationValue !== '' ? Number(customDurationValue) : undefined,
          durationUnit: customDurationUnit || 'days',
          deadline: customDeadline || undefined,
          projectNotice: customNotice.trim() || undefined
        })
      });
      const rzpData = await res.json();
      if (!res.ok) throw new Error(rzpData.error || 'Failed to initiate custom order');

      const { orderId, razorpayOrderId, amount, currency, keyId } = rzpData;

      // 2. Open Razorpay Checkout for ₹100 Advance
      if (typeof window !== 'undefined' && (window as any).Razorpay) {
        const options = {
          key: keyId,
          amount: amount,
          currency: currency || 'INR',
          name: 'WORKONOVA',
          description: `${customCategory} — ₹100 Custom Scoping & Consultation Advance`,
          image: '/assets/workonova-logo.webp',
          order_id: razorpayOrderId,
          prefill: {
            name: user?.name || '',
            email: user?.email || '',
            contact: (user as any)?.phone || '',
          },
          theme: { color: '#6366f1' },
          modal: {
            ondismiss: function() {
              setCustomSubmitting(false);
              triggerToast('ℹ️ ₹100 Advance payment dismissed. Order saved in pending queue.');
              fetchOrders(true);
            }
          },
          handler: async function (response: any) {
            try {
              // 3. Verify payment for milestone 0 (₹100 advance)
              const verifyRes = await fetch(`${API_BASE}/api/client/razorpay/verify-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                  orderId,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  milestone: 0
                })
              });
              const verifyData = await verifyRes.json();
              if (!verifyRes.ok) throw new Error(verifyData.error || 'Payment verification failed');

              triggerToast('🎉 ₹100 Advance Paid! Workonova Leadership will review your brief and issue your quote.');
              setCustomBrief('');
              setCustomLink('');
              setCustomBudget('');
              setCustomDurationValue('');
              setCustomDurationUnit('days');
              setCustomDeadline('');
              setCustomNotice('');
              setCustomOrderModalOpen(false);
              fetchOrders();
            } catch (err: any) {
              triggerToast('❌ Verification error: ' + err.message);
            } finally {
              setCustomSubmitting(false);
            }
          }
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } else {
        throw new Error('Razorpay payment gateway failed to load in browser.');
      }
    } catch (err: any) {
      triggerToast('❌ Error: ' + err.message);
      setCustomSubmitting(false);
    }
  };

  // ── ORDER CREATION (MILESTONE 1: 50% UPFRONT) ────────────────
  const handleTierChange = (tierTag: string) => {
    setNewProjTier(tierTag);
    const activeTiers = getActiveCategoryTiers(newProjCategory, dbBundles);
    const selected = activeTiers.find(p => p.tag === tierTag);
    if (selected) setNewProjPrice(selected.price);
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjBrief || !newProjLink) { triggerToast('⚠️ Please provide both brief description and assets folder link.'); return; }
    const drivePattern = /^(https?:\/\/)?(drive\.google\.com|dropbox\.com|.*\.dropbox\.com)\/.+$/;
    if (!drivePattern.test(newProjLink)) { triggerToast('⚠️ Link must be a valid Google Drive or Dropbox URL.'); return; }
    
    setPaymentProcessing(true);
    try {
      // 1. Initialize Razorpay order on backend (Milestone 1 = 50% upfront)
      const rzpRes = await fetch(`${API_BASE}/api/client/razorpay/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          serviceCategory: newProjCategory,
          tier: newProjTier,
          price: newProjPrice,
          description: newProjBrief,
          milestone: 1,
          durationValue: newProjDurationValue !== '' ? Number(newProjDurationValue) : undefined,
          durationUnit: newProjDurationUnit || 'days',
          deadline: newProjDeadline || undefined,
          projectNotice: newProjNotice.trim() || undefined
        })
      });
      const rzpData = await rzpRes.json();
      if (!rzpRes.ok) throw new Error(rzpData.error || 'Failed to initialize payment gateway');

      const { orderId, razorpayOrderId, amount, currency, keyId } = rzpData;

      // 2. Open Razorpay Checkout Modal
      if (typeof window !== 'undefined' && (window as any).Razorpay) {
        const options = {
          key: keyId,
          amount: amount,
          currency: currency || 'INR',
          name: 'WORKONOVA',
          description: `${newProjCategory} — Milestone 1 (50% Upfront Kickoff)`,
          image: '/assets/workonova-logo.webp',
          order_id: razorpayOrderId,
          prefill: {
            name: user?.name || '',
            email: user?.email || '',
            contact: (user as any)?.phone || '',
          },
          theme: {
            color: '#6366f1'
          },
          modal: {
            ondismiss: function() {
              setPaymentProcessing(false);
              triggerToast('ℹ️ Payment dismissed. Order saved in pending queue.');
              fetchOrders(true);
            }
          },
          handler: async function (response: any) {
            try {
              // 3. Verify cryptographic payment signature
              const verifyRes = await fetch(`${API_BASE}/api/client/razorpay/verify-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                  orderId,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  milestone: 1
                })
              });
              const verifyData = await verifyRes.json();
              if (!verifyRes.ok) throw new Error(verifyData.error || 'Payment verification failed');

              // 4. Submit intake brief & assets link
              await fetch(`${API_BASE}/api/client/orders/${orderId}/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                  description: newProjBrief,
                  submissionLink: newProjLink,
                  durationValue: newProjDurationValue !== '' ? Number(newProjDurationValue) : undefined,
                  durationUnit: newProjDurationUnit || 'days',
                  deadline: newProjDeadline || undefined,
                  projectNotice: newProjNotice.trim() || undefined
                })
              });

              triggerToast('🎉 Milestone 1 (50%) paid & Project order activated!');
              setNewProjBrief('');
              setNewProjLink('');
              setNewProjDurationValue('');
              setNewProjDurationUnit('days');
              setNewProjDeadline('');
              setNewProjNotice('');
              setNewProjectModalOpen(false);
              fetchOrders();
            } catch (err: any) {
              triggerToast('❌ Verification error: ' + err.message);
            } finally {
              setPaymentProcessing(false);
            }
          }
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } else {
        throw new Error('Razorpay SDK not loaded in browser.');
      }
    } catch (err: any) {
      triggerToast('❌ Payment initialisation failed: ' + err.message);
      setPaymentProcessing(false);
    }
  };

  // ── PAY NEXT MILESTONE (MILESTONE 2: 25% or MILESTONE 3: 25%) ──
  const handlePayMilestone = async (project: Project, milestoneNumber: number) => {
    if (!project.dbId) return;
    setPaymentProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/api/client/razorpay/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          orderId: project.dbId,
          milestone: milestoneNumber,
        }),
      });
      const rzpData = await res.json();
      if (!res.ok) throw new Error(rzpData.error || 'Failed to initiate milestone payment');

      const options = {
        key: rzpData.keyId,
        amount: rzpData.amount,
        currency: rzpData.currency || 'INR',
        name: 'WORKONOVA',
        description: `${rzpData.milestoneTitle} — Order #${project.dbId}`,
        image: '/assets/workonova-logo.webp',
        order_id: rzpData.razorpayOrderId,
        prefill: {
          name: user?.name,
          email: user?.email,
          contact: (user as any)?.phone || '',
        },
        theme: { color: '#6366f1' },
        handler: async (response: any) => {
          try {
            const verifyRes = await fetch(`${API_BASE}/api/client/razorpay/verify-payment`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                orderId: project.dbId,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                milestone: milestoneNumber,
              }),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error || 'Verification failed');
            triggerToast(`✅ Milestone ${milestoneNumber} payment verified successfully!`);
            fetchOrders(true);
            setActiveProjectForModal(null);
            setApproveModalOpen(false);
          } catch (err: any) {
            triggerToast('❌ Verification error: ' + err.message);
          }
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      triggerToast('❌ Payment failed: ' + err.message);
    } finally {
      setPaymentProcessing(false);
    }
  };

  // ── APPROVE 50% MIDPOINT DELIVERABLE ─────────────────────────
  const handleApproveMidpoint = async (project: Project) => {
    if (!project.dbId) return;
    try {
      const res = await fetch(`${API_BASE}/api/client/orders/${project.dbId}/approve-midpoint`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to approve midpoint deliverable');
      triggerToast('✅ 50% Midpoint approved! Launching Milestone 2 payment (25%)…');
      fetchOrders(true);
      handlePayMilestone(project, 2);
    } catch (err: any) {
      triggerToast('❌ Error: ' + err.message);
    }
  };

  const handlePayPendingOrder = async (p: Project) => {
    if (!p.dbId) return;
    setPaymentProcessing(true);
    try {
      const rzpRes = await fetch(`${API_BASE}/api/client/razorpay/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId: p.dbId })
      });
      const rzpData = await rzpRes.json();
      if (!rzpRes.ok) throw new Error(rzpData.error || 'Failed to initialize payment');

      const { orderId, razorpayOrderId, amount, currency, keyId, serviceCategory, tier } = rzpData;

      if (typeof window !== 'undefined' && (window as any).Razorpay) {
        const options = {
          key: keyId,
          amount,
          currency: currency || 'INR',
          name: 'WORKONOVA',
          description: `${serviceCategory || p.title} (${(tier || 'Order').toUpperCase()})`,
          image: '/assets/workonova-logo.webp',
          order_id: razorpayOrderId,
          prefill: {
            name: user?.name || '',
            email: user?.email || '',
            contact: user?.phone || '',
          },
          theme: { color: '#6366f1' },
          modal: {
            ondismiss: function () {
              setPaymentProcessing(false);
              triggerToast('ℹ️ Payment window dismissed.');
            }
          },
          handler: async function (response: any) {
            try {
              const verifyRes = await fetch(`${API_BASE}/api/client/razorpay/verify-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                  orderId,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                })
              });
              const verifyData = await verifyRes.json();
              if (!verifyRes.ok) throw new Error(verifyData.error || 'Payment verification failed');
              triggerToast('🎉 Payment verified successfully!');
              fetchOrders();
            } catch (err: any) {
              triggerToast('❌ Verification error: ' + err.message);
            } finally {
              setPaymentProcessing(false);
            }
          }
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } else {
        triggerToast('⚠️ Razorpay checkout unavailable.');
        setPaymentProcessing(false);
      }
    } catch (e: any) {
      setPaymentProcessing(false);
      triggerToast('❌ ' + e.message);
    }
  };

  // ── CHAT ──────────────────────────────────────────────────────
  const fetchChatMessages = async (orderId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/client/orders/${orderId}/messages`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) setChatMessages(data.data || []);
    } catch (e) { console.error(e); }
  };

  const handleSendChatMessage = async (e: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const textToSend = customText || newMessageText.trim();
    if (!textToSend || !activeProjectForModal?.dbId) return;

    // Optimistic UI update: render outgoing message immediately with 0ms latency
    const optimisticMsg = {
      id: Date.now(),
      orderId: activeProjectForModal.dbId,
      senderId: 0,
      senderRole: 'client' as const,
      messageText: textToSend,
      createdAt: new Date().toISOString(),
    };
    setChatMessages(prev => [...prev, optimisticMsg]);
    if (!customText) setNewMessageText('');

    try {
      const res = await fetch(`${API_BASE}/api/client/orders/${activeProjectForModal.dbId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messageText: textToSend })
      });
      if (res.ok) {
        fetchChatMessages(activeProjectForModal.dbId);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ── SUPPORT TICKET ────────────────────────────────────────────
  const handleSupportTicketSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportMessage) return;
    triggerToast('📩 Support ticket opened! Priya Mehta will reply within 4 hours.');
    setSupportMessage('');
  };

  // ── REVISION ─────────────────────────────────────────────────
  const triggerRevisionRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProjectForModal) return;
    let details = '';
    if (activeProjectForModal.category === 'web') details = `Bug on (${revWebUrl}): ${revWebDesc}`;
    else if (activeProjectForModal.category === 'video') details = `Cut at ${revVidTime}: ${revVidDesc}. Notes: ${revVidNotes}`;
    else details = `Design mod for ${revDesignItem}: ${revDesignDesc}`;
    
    if (activeProjectForModal.dbId) {
      try {
        await fetch(`${API_BASE}/api/client/orders/${activeProjectForModal.dbId}/client-revision`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ comments: details })
        });
      } catch (err) {
        console.error('Failed to submit revision to server:', err);
      }
    }
    
    setAllProjects(prev => prev.map(p => p.id === activeProjectForModal.id ? { ...p, status: 'In Progress', currentStep: 1, slaHoursRemaining: undefined, revisionsLeft: p.revisionsLeft - 1, updates: [{ date: 'Today', text: `Revision requested: "${details.slice(0, 50)}..."` }, ...p.updates] } : p));
    setRevisionModalOpen(false);
    triggerToast('🔄 Revision sent to specialist! Project returned to In Progress.');
    fetchOrders(true);
  };

  // ── APPROVE ───────────────────────────────────────────────────
  const triggerPayoutFinalize = async () => {
    if (!activeProjectForModal) return;
    
    if (activeProjectForModal.dbId) {
      try {
        await fetch(`${API_BASE}/api/client/orders/${activeProjectForModal.dbId}/client-approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        });
      } catch (err) {
        console.error('Failed to approve project on server:', err);
      }
    }
    
    setAllProjects(prev => prev.map(p => p.id === activeProjectForModal.id ? { ...p, status: 'Client Approved', currentStep: 3, slaHoursRemaining: undefined, updates: [{ date: 'Today', text: 'Project finalized and approved by client!' }, ...p.updates] } : p));
    setApproveModalOpen(false);
    triggerToast('✅ Deliverables approved! Admin authorized to release specialist payout.');
    fetchOrders(true);
    setFeedbackRating(5);
    setFeedbackModalOpen(true);
  };

  const handleTestimonialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackQuote.trim()) {
      triggerToast('⚠️ Please write a short review comment.');
      return;
    }
    setFeedbackSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/client/testimonials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: user?.name || 'Verified Client',
          role: feedbackRole.trim() || 'Client',
          quote: feedbackQuote.trim(),
          stars: feedbackRating,
        })
      });
      if (res.ok) {
        triggerToast('⭐ Thank you! Your testimonial has been submitted to admin queue.');
        setFeedbackModalOpen(false);
        setFeedbackQuote('');
        setFeedbackRole('');
      } else {
        triggerToast('⚠️ Failed to submit testimonial.');
      }
    } catch (err) {
      console.error('Testimonial submit error:', err);
      triggerToast('⚠️ Error submitting testimonial.');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  // ── ADD-ON ────────────────────────────────────────────────────
  const triggerAddonPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProjectForModal || selectedAddonIndex === null) return;
    const item = (ADDON_CATALOG[activeProjectForModal.category] || [])[selectedAddonIndex];
    if (!item) return;
    setAllProjects(prev => prev.map(p => p.id === activeProjectForModal.id ? { ...p, amount: p.amount + item.cost, updates: [{ date: 'Today', text: `Add-on purchased: "${item.label}" (+₹${item.cost})` }, ...p.updates] } : p));
    if (activeProjectForModal.dbId) handleSendChatMessage(e, `➕ [SYSTEM RELAY] Client purchased Add-on: "${item.label}" (+₹${item.cost})`);
    setAddonModalOpen(false);
    triggerToast(`💳 Add-on "${item.label}" purchased!`);
  };

  // ── BRAND PROFILE ─────────────────────────────────────────────
  const handleCreateBrand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandName) return;
    const key = newBrandName.toLowerCase().replace(/[^a-z0-9]/g, '');
    setBrandProfiles(prev => ({ ...prev, [key]: { name: newBrandName, logo: '🖼️ Logo_Draft_Vault.png', colors: [newBrandColor, '#222222', '#f9f9f9'], font: 'Inter / Outfit', driveLink: newBrandFolder || 'https://drive.google.com', briefs: [] } }));
    setSelectedBrandKey(key);
    setNewBrandModalOpen(false); setNewBrandName(''); setNewBrandFolder('');
    triggerToast('📁 New brand profile added!');
  };

  // ── BILLING ───────────────────────────────────────────────────
  const handleBillingSave = (e: React.FormEvent) => {
    e.preventDefault();
    setBillingModalOpen(false);
    triggerToast('✅ Billing settings saved!');
  };

  // ── COUNTS & FILTERS ──────────────────────────────────────────
  const liveCount = allProjects.filter(p => p.status === 'In Progress' || p.status === 'In Review').length;
  const actionCount = allProjects.filter(p => p.status === 'In Review').length;
  const totalSpent = allProjects.filter(p => p.status !== 'Cancelled').reduce((s, p) => s + p.amount, 0);
  const completedCount = allProjects.filter(p => p.status === 'Delivered').length;
  const initials = getInitials(user?.name || 'Rohit Sharma');

  const catCount = (cat: string) => allProjects.filter(p => p.category === cat).length;

  const filteredProjects = allProjects.filter(p => {
    if (currentView === 'live') { if (p.status !== 'In Progress' && p.status !== 'In Review') return false; }
    else if (currentView === 'action-required') { if (p.status !== 'In Review') return false; }
    else if (currentView.startsWith('cat-')) { if (p.category !== currentView.replace('cat-', '')) return false; }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return p.title.toLowerCase().includes(q) || p.freelancer.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
    }
    return true;
  });

  const openProject = (p: Project) => {
    setActiveProjectForModal(p);
    setChatMessages([]);
    setThreadModalOpen(true);
    if (p.dbId) fetchChatMessages(p.dbId);
  };

  const goView = (view: string) => { setCurrentView(view); setSidebarOpen(false); };

  // ── RENDER HELPERS ────────────────────────────────────────────
  const renderProjectCards = (projects: Project[], emptyIcon: string, emptyTitle: string, emptyDesc: string) => (
    projects.length === 0 ? (
      <div className="cd-empty">
        <div className="cd-empty-icon">{emptyIcon}</div>
        <h2>{emptyTitle}</h2>
        <p>{emptyDesc}</p>
        <button className="cd-new-btn" style={{ margin: '0 auto' }} onClick={() => setNewProjectModalOpen(true)}>+ Start New Project</button>
      </div>
    ) : (
      projects.map(p => (
        <ProjectCard key={p.id} project={p}
          onOpenRevision={() => { setActiveProjectForModal(p); setRevisionModalOpen(true); }}
          onOpenApprove={() => { setActiveProjectForModal(p); setApproveModalOpen(true); }}
          onOpenAddon={() => { setActiveProjectForModal(p); setAddonModalOpen(true); }}
          onOpenThread={() => openProject(p)}
          onDownloadInvoice={() => {
            const inv = `WN-INV-2026-${String(p.dbId || p.id.replace('db-', '')).padStart(4, '0')}`;
            downloadClientInvoicePDF({
              orderId: p.dbId || Number(p.id.replace('db-', '')) || 101,
              clientName: clientProfile?.name || user?.name || 'Valued Client',
              clientEmail: clientProfile?.email || user?.email || 'client@workonova.com',
              clientPhone: clientProfile?.phone || (user as any)?.phone || '',
              serviceCategory: p.title?.replace(' - Intake Setup', '')?.replace(/ - Order #\d+/, '') || 'Creative & Tech Delivery',
              tier: p.tier || 'STANDARD',
              totalPrice: p.amount || 14999,
              amountPaid: p.amountPaid || p.amount || 14999,
              milestoneStage: p.milestoneStage || 1,
              paymentId: p.paymentId || 'rzp_live_escrow_audit',
              razorpayOrderId: p.razorpayOrderId,
              date: p.placedDate,
            });
            triggerToast(`📄 Downloaded Tax Invoice ${inv}.pdf`);
          }}
          triggerToast={triggerToast}
        />
      ))
    )
  );

  const getCatPageTitle = () => {
    const key = currentView.replace('cat-', '') as keyof typeof CAT_META;
    const meta = CAT_META[key];
    return meta ? `${meta.icon} ${meta.label} Projects` : '📂 Projects';
  };

  // ══════════════════════════════════════════════════════════════
  // JSX RENDER
  // ══════════════════════════════════════════════════════════════
  return (
    <div className="cd-root">
      <WelcomePopup role="client" />

      {/* ═══════════ SIDEBAR ═══════════ */}
      {sidebarOpen && <div className="cd-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      <aside className={`cd-sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="cd-sidebar-logo">
          <img src="/assets/workonova-logo.webp" alt="WN" />
          <span>WORKONOVA</span>
        </div>

        <div className="cd-sidebar-nav">
          {/* Main nav */}
          <button className={`cd-nav-item${currentView === 'overview' ? ' active' : ''}`} onClick={() => goView('overview')}>
            <span className="cd-nav-icon">📊</span><span>Dashboard Overview</span>
          </button>
          <button className={`cd-nav-item${currentView === 'live' ? ' active' : ''}`} onClick={() => goView('live')}>
            <span className="cd-nav-icon">⚡</span><span>Live Projects</span>
            {liveCount > 0 && <b className="cd-nav-badge">{liveCount}</b>}
          </button>
          <button className={`cd-nav-item${currentView === 'all-projects' ? ' active' : ''}`} onClick={() => goView('all-projects')}>
            <span className="cd-nav-icon">📂</span><span>All My Projects</span>
            <b className="cd-nav-badge">{allProjects.length}</b>
          </button>
          <button className={`cd-nav-item${currentView === 'action-required' ? ' active' : ''}`} onClick={() => goView('action-required')}>
            <span className="cd-nav-icon">⚠️</span><span>Action Required</span>
            {actionCount > 0 && <b className="cd-nav-badge urgent">{actionCount}</b>}
          </button>

          {/* Filter by service */}
          <p className="cd-nav-label">Filter by Service</p>
          {Object.entries(CAT_META).map(([key, meta]) => (
            <div key={key}>
              <button className={`cd-nav-item${currentView === `cat-${key}` ? ' active' : ''}`} onClick={() => goView(`cat-${key}`)}>
                <span className="cd-nav-icon">{meta.icon}</span>
                <span>{meta.label}</span>
                {catCount(key) > 0 && <b className="cd-nav-badge">{catCount(key)}</b>}
              </button>
              {currentView === `cat-${key}` && meta.subs.length > 0 && (
                <div className="cd-nav-sub open">
                  {meta.subs.map(s => <span key={s}>{s}</span>)}
                </div>
              )}
            </div>
          ))}

          {/* Assets & Billing */}
          <p className="cd-nav-label">Assets &amp; Billing</p>
          <button className={`cd-nav-item${currentView === 'brand-vault' ? ' active' : ''}`} onClick={() => goView('brand-vault')}>
            <span className="cd-nav-icon">📁</span><span>My Brand Vault</span>
          </button>
          <button className={`cd-nav-item${currentView === 'invoices' ? ' active' : ''}`} onClick={() => goView('invoices')}>
            <span className="cd-nav-icon">📄</span><span>Invoices &amp; GST Receipts</span>
          </button>
          <button className={`cd-nav-item${currentView === 'profile' ? ' active' : ''}`} onClick={() => goView('profile')}>
            <span className="cd-nav-icon">👤</span><span>Profile &amp; Security</span>
          </button>
          <button className={`cd-nav-item${currentView === 'support' ? ' active' : ''}`} onClick={() => goView('support')}>
            <span className="cd-nav-icon">💬</span><span>Support &amp; Help Desk</span>
          </button>
        </div>
      </aside>

      {/* ═══════════ HEADER ═══════════ */}
      <div className="cd-header">
        <button className="cd-hamburger" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Menu">
          <span /><span /><span />
        </button>

        {/* Search */}
        <div className="cd-search">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
          <input
            ref={searchInputRef}
            type="search"
            placeholder="Search Projects, Orders, Invoices… (Ctrl+K)"
            autoComplete="off"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <kbd>Ctrl K</kbd>
        </div>

        {/* Right actions */}
        <div className="cd-header-right">
          {/* Notifications */}
          <button className="cd-notif-btn" onClick={() => { setNotifPanelOpen(!notifPanelOpen); setProfileDropdownOpen(false); setNotifications(prev => prev.map(n => ({ ...n, unread: false }))); }} aria-label="Notifications">
            🔔
            {notifications.some(n => n.unread) && (
              <span className="cd-notif-badge">{notifications.filter(n => n.unread).length}</span>
            )}
          </button>

          {/* Brand Vault */}
          <button className="cd-vault-btn" onClick={() => goView('brand-vault')}>
            📁 Brand Vault
          </button>

          {/* User pill */}
          <div style={{ position: 'relative' }}>
            <button className="cd-user-pill" onClick={() => { setProfileDropdownOpen(!profileDropdownOpen); setNotifPanelOpen(false); }}>
              <div className="cd-avatar">{initials}</div>
              <div className="cd-user-meta">
                <b>{user?.name || 'Rohit Sharma'}</b>
                <small>NorthStar Agency · Gold Client</small>
              </div>
              <span className="cd-header-chevron">▾</span>
            </button>

            {profileDropdownOpen && (
              <div className="cd-profile-dropdown">
                <div className="cd-dd-header">
                  <div className="cd-avatar" style={{ width: 36, height: 36, fontSize: 13 }}>{initials}</div>
                  <div>
                    <b>{user?.name || 'Rohit Sharma'}</b>
                    <small>{user?.email || 'rohit@northstar.in'}</small>
                  </div>
                </div>
                <hr className="cd-dd-hr" />
                <button className="cd-dd-item" onClick={() => { setProfileDropdownOpen(false); goView('profile'); }}>👤 Edit Profile &amp; Contact</button>
                <button className="cd-dd-item" onClick={() => { setProfileDropdownOpen(false); goView('invoices'); }}>📄 GST Invoices</button>
                <button className="cd-dd-item" onClick={() => { setProfileDropdownOpen(false); goView('brand-vault'); }}>📁 Brand Vault</button>
                <button className="cd-dd-item" onClick={() => { setProfileDropdownOpen(false); goView('support'); }}>💬 Help &amp; Support</button>
                <hr className="cd-dd-hr" />
                <button className="cd-dd-item danger" onClick={logout}>↪ Logout</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Notification Panel */}
      {notifPanelOpen && (
        <>
          <div className="cd-notif-backdrop" onClick={() => setNotifPanelOpen(false)} />
          <div className="cd-notif-panel">
            <div className="cd-notif-header">
              <h3>Notifications</h3>
              <button className="cd-notif-close" onClick={() => setNotifPanelOpen(false)}>×</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {notifications.map(n => (
                <div key={n.id} className={`cd-notif-item${n.unread ? ' unread' : ''}`}>
                  <span className={`cd-notif-dot${!n.unread ? ' read' : ''}`} />
                  <div>
                    <b>{n.title}</b>
                    <p>{n.desc}</p>
                    <time>{n.time}</time>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ═══════════ MAIN CONTENT ═══════════ */}
      <main className="cd-main">
        {loading ? (
          <div className="cd-loading">
            <div className="cd-spinner" />
            <p>Loading your workspace…</p>
          </div>
        ) : (
          <>
            {/* ════ OVERVIEW ════ */}
            {currentView === 'overview' && (
              <>
                <div className="cd-view-header">
                  <div>
                    <h1>Welcome back, {user?.name?.split(' ')[0] || 'Rohit'}! 👋</h1>
                    <p>Here's your full production command centre.</p>
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button
                      className="cd-new-btn"
                      style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)' }}
                      onClick={() => setCustomOrderModalOpen(true)}
                    >
                      ⚡ Custom / On-Demand (₹100 Adv)
                    </button>
                    <button className="cd-new-btn" onClick={() => setNewProjectModalOpen(true)}>
                      + Fixed Packages
                    </button>
                  </div>
                </div>

                {/* 🛡️ 3-STAGE MILESTONE ESCROW EXPLAINER BANNER */}
                <div style={{
                  background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)',
                  border: '1px solid #6366f1',
                  borderRadius: 12,
                  padding: '20px 24px',
                  marginBottom: 24,
                  color: '#ffffff',
                  boxShadow: '0 4px 20px rgba(99, 102, 241, 0.15)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8 }}>
                        🛡️ How Workonova 3-Stage Milestone Escrow Works
                      </h3>
                      <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#cbd5e1' }}>
                        Your funds are 100% protected. Payments are split into 3 safe milestone steps as work progresses:
                      </p>
                    </div>
                    <span style={{ fontSize: 12, background: 'rgba(52, 211, 153, 0.2)', border: '1px solid #10b981', color: '#34d399', padding: '4px 10px', borderRadius: 20, fontWeight: 700 }}>
                      ✓ 100% Buyer Protection Guarantee
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                    <div style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 8, padding: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#38bdf8', marginBottom: 4 }}>1️⃣ 50% Upfront Kickoff</div>
                      <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', lineHeight: 1.4 }}>
                        You pay 50% to start. Funds are locked in escrow while a verified specialist is assigned.
                      </p>
                    </div>
                    <div style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 8, padding: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#a5b4fc', marginBottom: 4 }}>2️⃣ 50% Work Review $\rightarrow$ Pay 25%</div>
                      <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', lineHeight: 1.4 }}>
                        Specialist uploads 50% draft/prototype. You review &amp; approve to release the 25% second milestone.
                      </p>
                    </div>
                    <div style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 8, padding: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#34d399', marginBottom: 4 }}>3️⃣ 100% Final Delivery $\rightarrow$ Pay 25%</div>
                      <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', lineHeight: 1.4 }}>
                        Specialist delivers final files &amp; source code. You approve and pay the remaining 25% balance.
                      </p>
                    </div>
                  </div>
                </div>

                {/* KPI Cards */}
                <div className="cd-kpi-grid">
                  <div className="cd-kpi-card" onClick={() => goView('live')}>
                    <div className="cd-kpi-icon live">⚡</div>
                    <div><b>{liveCount}</b><small>Live Projects</small></div>
                  </div>
                  <div className="cd-kpi-card" onClick={() => goView('action-required')}>
                    <div className="cd-kpi-icon urgent">⚠️</div>
                    <div><b>{actionCount}</b><small>Action Required</small></div>
                  </div>
                  <div className="cd-kpi-card">
                    <div className="cd-kpi-icon done">✓</div>
                    <div><b>{completedCount}</b><small>Completed Projects</small></div>
                  </div>
                  <div className="cd-kpi-card" onClick={() => goView('invoices')}>
                    <div className="cd-kpi-icon money">₹</div>
                    <div><b>₹{totalSpent.toLocaleString('en-IN')}</b><small>Total Invested</small></div>
                  </div>
                </div>

                {/* Live Projects at a Glance */}
                <p className="cd-section-title">⚡ Live Projects at a Glance</p>
                {renderProjectCards(
                  allProjects.filter(p => p.status === 'In Progress' || p.status === 'In Review'),
                  '⚡', 'No Live Projects', 'Start a new project from our creative/tech bundles catalogue.'
                )}

                {/* Recent Orders Table */}
                <p className="cd-section-title" style={{ marginTop: 28 }}>📋 Recent Orders</p>
                <div className="cd-table-wrap">
                  <table className="cd-table">
                    <thead>
                      <tr><th>Order ID</th><th>Service</th><th>Placed</th><th>Amount</th><th>Status</th><th>Action</th></tr>
                    </thead>
                    <tbody>
                      {allProjects.slice(0, 5).map(p => (
                        <tr key={p.id}>
                          <td><b>#{p.id.replace('db-', '')}</b></td>
                          <td>{p.title}</td>
                          <td>{p.placedDate}</td>
                          <td>₹{p.amount.toLocaleString('en-IN')}</td>
                          <td><span className={`cd-status-pill ${statusClass(p.status)}`}>{p.status}</span></td>
                          <td>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <button className="cd-table-link" onClick={() => openProject(p)}>Chat &amp; Details ↗</button>
                              {p.freelancer === 'Not Assigned' && p.dbId && (
                                <button className="cd-table-link" style={{ color: '#6366f1', fontWeight: 700 }} onClick={() => handlePayPendingOrder(p)}>Pay 💳</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* ════ LIVE PROJECTS ════ */}
            {currentView === 'live' && (
              <>
                <div className="cd-view-header">
                  <div><h1>⚡ Live Projects</h1><p>Active work currently in production.</p></div>
                  <button className="cd-new-btn" onClick={() => setNewProjectModalOpen(true)}>+ Start New Project</button>
                </div>
                {renderProjectCards(filteredProjects, '⚡', 'No Active Projects', 'You have no active projects in production right now.')}
              </>
            )}

            {/* ════ ALL PROJECTS ════ */}
            {currentView === 'all-projects' && (
              <>
                <div className="cd-view-header">
                  <div><h1>📂 All My Projects</h1><p>Complete history of all your orders.</p></div>
                </div>
                <div className="cd-table-wrap">
                  <table className="cd-table">
                    <thead>
                      <tr><th>Order ID</th><th>Service</th><th>Placed</th><th>Amount</th><th>Freelancer</th><th>Status</th><th>Action</th></tr>
                    </thead>
                    <tbody>
                      {filteredProjects.map(p => (
                        <tr key={p.id}>
                          <td><b>#{p.id.replace('db-', '')}</b></td>
                          <td>{p.title}</td>
                          <td>{p.placedDate}</td>
                          <td>₹{p.amount.toLocaleString('en-IN')}</td>
                          <td>{p.freelancer}</td>
                          <td><span className={`cd-status-pill ${statusClass(p.status)}`}>{p.status}</span></td>
                          <td><button className="cd-table-link" onClick={() => openProject(p)}>Chat &amp; Details ↗</button></td>
                        </tr>
                      ))}
                      {filteredProjects.length === 0 && (
                        <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: '#aaa' }}>No projects found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* ════ ACTION REQUIRED ════ */}
            {currentView === 'action-required' && (
              <>
                <div className="cd-view-header">
                  <div><h1>⚠️ Action Required</h1><p>These projects need your review, approval, or revision input.</p></div>
                </div>
                {renderProjectCards(filteredProjects, '✓', 'All Clear!', 'No actions required from your side at the moment.')}
              </>
            )}

            {/* ════ CATEGORY VIEWS ════ */}
            {currentView.startsWith('cat-') && (
              <>
                <div className="cd-view-header">
                  <div><h1 className="cd-page-title">{getCatPageTitle()}</h1></div>
                  <button className="cd-new-btn" onClick={() => setNewProjectModalOpen(true)}>+ Start New Project</button>
                </div>
                {renderProjectCards(filteredProjects, '📂', 'No Projects in This Category', "You haven't placed any orders under this service filter yet.")}
              </>
            )}

            {/* ════ BRAND VAULT ════ */}
            {currentView === 'brand-vault' && (
              <>
                <div className="cd-view-header">
                  <div>
                    <h1>📁 My Brand Vault</h1>
                    <p>Permanent digital locker — your team never asks for logos and assets twice.</p>
                  </div>
                  <button className="cd-new-btn" onClick={() => setNewBrandModalOpen(true)}>+ New Brand Profile</button>
                </div>
                <div className="cd-brand-grid">
                  <div className="cd-brand-list">
                    {Object.entries(brandProfiles).map(([key, bp]) => (
                      <button key={key} className={`cd-brand-list-item${selectedBrandKey === key ? ' active' : ''}`} onClick={() => setSelectedBrandKey(key)}>
                        📁 {bp.name}
                      </button>
                    ))}
                    <button className="cd-brand-list-item" onClick={() => setNewBrandModalOpen(true)}>+ Add Brand Profile</button>
                  </div>
                  {brandProfiles[selectedBrandKey] && (
                    <div className="cd-brand-detail">
                      <h3>🎨 {brandProfiles[selectedBrandKey].name}</h3>
                      <div className="cd-brand-field"><label>Brand Logo</label><p>{brandProfiles[selectedBrandKey].logo}</p></div>
                      <div className="cd-brand-field">
                        <label>Color Palette</label>
                        <div className="cd-brand-colors">
                          {brandProfiles[selectedBrandKey].colors.map(c => (
                            <div key={c} className="cd-brand-swatch" style={{ background: c }} title={c} />
                          ))}
                        </div>
                      </div>
                      <div className="cd-brand-field"><label>Typography</label><p>{brandProfiles[selectedBrandKey].font}</p></div>
                      <div className="cd-brand-field">
                        <label>Brand Documents</label>
                        <div className="cd-assets" style={{ marginTop: 4 }}>
                          {brandProfiles[selectedBrandKey].briefs.map(b => (
                            <button key={b} className="cd-asset-pill" onClick={() => triggerToast('📂 Opening file brief...')}>📄 {b}</button>
                          ))}
                          <button className="cd-asset-pill" onClick={() => triggerToast('📎 Attach file...')}>➕ Add Doc</button>
                        </div>
                      </div>
                      <div className="cd-brand-field">
                        <label>Cloud Folder</label>
                        <a className="cd-dl-btn secondary" href={brandProfiles[selectedBrandKey].driveLink} target="_blank" rel="noopener noreferrer">📁 View Google Drive ↗</a>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ════ INVOICES ════ */}
            {currentView === 'invoices' && (
              <>
                <div className="cd-view-header">
                  <div><h1>📄 Invoices &amp; GST Receipts</h1></div>
                </div>
                <div className="cd-kpi-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 20 }}>
                  <div className="cd-kpi-card"><div className="cd-kpi-icon money">₹</div><div><b>₹{totalSpent.toLocaleString('en-IN')}</b><small>Total Spent</small></div></div>
                  <div className="cd-kpi-card"><div className="cd-kpi-icon done">✓</div><div><b>₹0</b><small>Pending Payment</small></div></div>
                  <div className="cd-kpi-card"><div className="cd-kpi-icon live">🧾</div><div><b>₹{Math.round(totalSpent * 0.18).toLocaleString('en-IN')}</b><small>GST Claimable (18%)</small></div></div>
                </div>
                <p className="cd-section-title">Invoice History</p>
                <div className="cd-table-wrap">
                  <table className="cd-table">
                    <thead><tr><th>Invoice #</th><th>Order</th><th>Date</th><th>Amount</th><th>GST</th><th>Download</th></tr></thead>
                    <tbody>
                      {allProjects.map((p, i) => {
                        const inv = `WN-INV-2026-${String(p.dbId || 100 + i).padStart(4, '0')}`;
                        return (
                          <tr key={p.id}>
                            <td><b>{inv}</b></td>
                            <td>#{p.id.replace('db-', '')}</td>
                            <td>{p.placedDate}</td>
                            <td>₹{p.amount.toLocaleString('en-IN')}</td>
                            <td>₹{Math.round(p.amount * 0.18).toLocaleString('en-IN')}</td>
                            <td>
                              <button
                                className="cd-table-link"
                                style={{ background: '#4f46e5', color: '#ffffff', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                                onClick={() => {
                                  downloadClientInvoicePDF({
                                    orderId: p.dbId || Number(p.id.replace('db-', '')) || (100 + i),
                                    clientName: clientProfile?.name || user?.name || 'Valued Client',
                                    clientEmail: clientProfile?.email || user?.email || 'client@workonova.com',
                                    clientPhone: clientProfile?.phone || (user as any)?.phone || '',
                                    serviceCategory: p.title?.replace(' - Intake Setup', '')?.replace(/ - Order #\d+/, '') || 'Creative & Tech Delivery',
                                    tier: p.tier || 'STANDARD',
                                    totalPrice: p.amount || 14999,
                                    amountPaid: p.amountPaid || p.amount || 14999,
                                    milestoneStage: p.milestoneStage || 3,
                                    paymentId: p.paymentId || 'rzp_live_escrow_audit',
                                    razorpayOrderId: p.razorpayOrderId,
                                    date: p.placedDate,
                                  });
                                  triggerToast(`📄 Downloaded Tax Invoice ${inv}.pdf`);
                                }}
                              >
                                📥 Export PDF
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {allProjects.length === 0 && (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: '#888' }}>
                            No invoice records found. Start a project to generate tax invoices.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* ════ PROFILE & CONTACT SETTINGS ════ */}
            {currentView === 'profile' && (
              <>
                <div className="cd-view-header">
                  <div>
                    <h1>👤 Account Profile &amp; Contact Details</h1>
                    <p>Manage your client contact profile, registered phone, and secure email verification.</p>
                  </div>
                </div>
                <div className="cd-support-grid" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
                  <div className="cd-support-card">
                    <h3>Contact Information</h3>
                    <form onSubmit={handleSaveProfile}>
                      <div className="cd-form-row">
                        <label className="cd-form-label">Full Name / Organization Contact</label>
                        <input
                          className="cd-form-input"
                          type="text"
                          required
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                        />
                      </div>
                      <div className="cd-form-row">
                        <label className="cd-form-label">Phone Number (with Country Code)</label>
                        <input
                          className="cd-form-input"
                          type="tel"
                          placeholder="+91 9876543210"
                          value={editPhone}
                          onChange={e => setEditPhone(e.target.value)}
                        />
                        <small style={{ color: '#888', fontSize: 11, marginTop: 4, display: 'block' }}>Used for critical milestone WhatsApp alerts and intake briefings.</small>
                      </div>
                      <button
                        type="submit"
                        className="cd-new-btn"
                        disabled={profileSaving}
                        style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
                      >
                        {profileSaving ? 'Saving Changes…' : '💾 Save Profile Updates'}
                      </button>
                    </form>
                  </div>

                  <div className="cd-support-card">
                    <h3>Registered Email &amp; OTP Security</h3>
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Primary Verified Email</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{clientProfile?.email || user?.email}</span>
                        <span style={{ background: '#dcfce7', color: '#166534', fontSize: 11, padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>✓ Verified</span>
                      </div>
                    </div>
                    <p style={{ fontSize: 12.5, color: '#64748b', lineHeight: 1.5, marginBottom: 16 }}>
                      To protect your active milestone funds and deliverables, updating your email address requires 6-digit OTP verification sent directly to the new address.
                    </p>
                    <button
                      type="button"
                      className="cd-btn-secondary"
                      style={{ width: '100%', padding: '10px 16px', fontWeight: 600, border: '1px solid #6366f1', color: '#4f46e5', cursor: 'pointer' }}
                      onClick={() => {
                        setEmailChangeModalOpen(true);
                        setNewEmailInput('');
                        setEmailOtpInput('');
                        setEmailOtpSent(false);
                      }}
                    >
                      🔐 Change Email Address (with OTP)
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ════ SUPPORT ════ */}
            {currentView === 'support' && (
              <>
                <div className="cd-view-header">
                  <div>
                    <h1>💬 Support &amp; Help Desk</h1>
                    <p>Our dedicated account manager responds in under 4 hours on business days.</p>
                  </div>
                </div>
                <div className="cd-support-grid">
                  <div className="cd-support-card">
                    <h3>Open a Support Ticket</h3>
                    <form onSubmit={handleSupportTicketSubmit}>
                      <div className="cd-form-row">
                        <label className="cd-form-label">Subject</label>
                        <select className="cd-form-select" value={supportSubject} onChange={e => setSupportSubject(e.target.value)}>
                          <option>Project-related question</option>
                          <option>Billing / Invoice issue</option>
                          <option>Revision or quality concern</option>
                          <option>Technical issue with portal</option>
                          <option>Other</option>
                        </select>
                      </div>
                      <div className="cd-form-row">
                        <label className="cd-form-label">Related Order (optional)</label>
                        <select className="cd-form-select" value={supportOrderId} onChange={e => setSupportOrderId(e.target.value)}>
                          <option value="">— Select order —</option>
                          {allProjects.map(p => <option key={p.id} value={p.id}>#{p.id.replace('db-', '')} · {p.title}</option>)}
                        </select>
                      </div>
                      <div className="cd-form-row">
                        <label className="cd-form-label">Message</label>
                        <textarea className="cd-form-textarea" required placeholder="Describe your issue in detail…" rows={5} value={supportMessage} onChange={e => setSupportMessage(e.target.value)} />
                      </div>
                      <button type="submit" className="cd-new-btn" style={{ width: '100%', justifyContent: 'center' }}>Send to Support Team →</button>
                    </form>
                  </div>
                  <div className="cd-support-card">
                    <h3>Contact Info</h3>
                    {[['⏱', 'Response Time', 'Under 4 hours (business days)'], ['📞', 'Dedicated Manager', 'Priya Mehta · priya@workonova.com'], ['🕐', 'Working Hours', 'Mon–Sat · 9 AM – 9 PM IST']].map(([icon, title, sub]) => (
                      <div key={title} style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 20 }}>{icon}</span>
                        <div><b style={{ fontSize: 13 }}>{title}</b><small style={{ display: 'block', color: '#888', fontSize: 12, marginTop: 2 }}>{sub}</small></div>
                      </div>
                    ))}
                    <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid #ebebeb' }} />
                    <h3 style={{ marginBottom: 12 }}>Leave a Review</h3>
                    <form onSubmit={handleTestimonialSubmit}>
                      <div className="cd-form-row">
                        <label className="cd-form-label">Rating</label>
                        <select className="cd-form-select" value={testimonialStars} onChange={e => setTestimonialStars(Number(e.target.value))}>
                          <option value={5}>⭐⭐⭐⭐⭐ (5/5)</option>
                          <option value={4}>⭐⭐⭐⭐ (4/5)</option>
                          <option value={3}>⭐⭐⭐ (3/5)</option>
                          <option value={2}>⭐⭐ (2/5)</option>
                          <option value={1}>⭐ (1/5)</option>
                        </select>
                      </div>
                      <div className="cd-form-row">
                        <label className="cd-form-label">Your Review</label>
                        <input className="cd-form-input" type="text" required placeholder="e.g. Workonova delivered our brand in under 48 hours!" value={testimonialQuote} onChange={e => setTestimonialQuote(e.target.value)} />
                      </div>
                      <button type="submit" className="cd-new-btn" style={{ width: '100%', justifyContent: 'center' }}>Submit Testimonial</button>
                    </form>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </main>

      {/* ═══════════ FOOTER ═══════════ */}
      <div className="cd-footer">
        <div className="cd-footer-left">
          <span className="cd-footer-dot" />
          WORKONOVA Client Portal v2.0 · 🛡️ 100% Encrypted &amp; Zero-EXE Security
        </div>
        <div className="cd-footer-right">
          24/7 Dedicated Account Manager · <a href="#support" onClick={() => goView('support')}>Open Support ↗</a>
        </div>
      </div>

      {/* ═══════════ TOAST ═══════════ */}
      {toastVisible && <div className="cd-toast">{toastMessage}</div>}

      {/* ═══════════ MODALS ═══════════ */}

      {/* NEW PROJECT MODAL */}
      {newProjectModalOpen && (
        <div className="cd-modal-overlay" onClick={() => setNewProjectModalOpen(false)}>
          <div className="cd-modal wide" onClick={e => e.stopPropagation()}>
            <div className="cd-modal-header">
              <h2>✦ Start New Project</h2>
              <button className="cd-modal-close" onClick={() => setNewProjectModalOpen(false)}>×</button>
            </div>
            <div className="cd-modal-body">
              <form id="newProjForm" onSubmit={handleCreateOrder}>
                <div className="cd-form-row">
                  <label className="cd-form-label">Service Category</label>
                  <select
                    className="cd-form-select"
                    value={newProjCategory}
                    onChange={e => {
                      const cat = e.target.value;
                      setNewProjCategory(cat);
                      const tiers = getActiveCategoryTiers(cat, dbBundles);
                      const matched = tiers.find(t => t.tag === newProjTier) || tiers[0];
                      if (matched) {
                        setNewProjTier(matched.tag);
                        setNewProjPrice(matched.price);
                      }
                    }}
                  >
                    {serviceCategories.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="cd-form-row">
                  <label className="cd-form-label">Select Package / Pricing Tier (Deliverable Breakdown for {newProjCategory})</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 6 }}>
                    {getActiveCategoryTiers(newProjCategory, dbBundles).map(p => {
                      const isSelected = newProjTier === p.tag;
                      return (
                        <div
                          key={p.tag}
                          onClick={() => handleTierChange(p.tag)}
                          style={{
                            padding: 14,
                            borderRadius: 10,
                            border: isSelected ? '2px solid #56c41a' : '1px solid #e0e0d8',
                            background: isSelected ? '#f2fceb' : '#ffffff',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: isSelected ? '0 4px 12px rgba(86,196,26,0.15)' : 'none',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between'
                          }}
                        >
                          <div>
                            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.5px', background: isSelected ? '#56c41a' : '#eaeaea', color: isSelected ? '#fff' : '#555', padding: '2px 6px', borderRadius: 4, display: 'inline-block', marginBottom: 6 }}>
                              {p.badge}
                            </span>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{p.name}</div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: '#56c41a', marginTop: 4 }}>
                              ₹{p.price.toLocaleString('en-IN')} <span style={{ fontSize: 11, fontWeight: 400, color: '#666' }}>{p.period}</span>
                            </div>
                            <p style={{ fontSize: 11, color: '#555', marginTop: 6, lineHeight: '1.4' }}>{p.desc}</p>
                          </div>
                          <ul style={{ paddingLeft: 14, marginTop: 10, fontSize: 10, color: '#444', borderTop: '1px solid #e8e8e0', paddingTop: 8, margin: '10px 0 0 0', listStyleType: 'none' }}>
                            {p.features.map((f, i) => (
                              <li key={i} style={{ marginBottom: 4, lineHeight: '1.3' }}>✓ {f}</li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="cd-form-row">
                  <label className="cd-form-label">Project Brief</label>
                  <textarea className="cd-form-textarea" required rows={4} placeholder="Detail your requirements, colors, references, and expectations..." value={newProjBrief} onChange={e => setNewProjBrief(e.target.value)} />
                </div>
                <div className="cd-form-row">
                  <label className="cd-form-label">Google Drive or Dropbox Link</label>
                  <input className="cd-form-input" type="url" required placeholder="https://drive.google.com/drive/folders/..." value={newProjLink} onChange={e => setNewProjLink(e.target.value)} />
                  <small style={{ fontSize: 11, color: '#aaa', marginTop: 4, display: 'block' }}>Link must contain brand templates &amp; visual elements.</small>
                </div>

                {/* Timeline & Delivery Deadline */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, margin: '12px 0' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#475569', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    ⏱️ Project Time Limit &amp; Deadline
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label className="cd-form-label" style={{ fontSize: 11 }}>Time Limit (Optional)</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          className="cd-form-input"
                          type="number"
                          min="1"
                          placeholder="e.g. 7"
                          value={newProjDurationValue}
                          onChange={e => {
                            const val = e.target.value === '' ? '' : Number(e.target.value);
                            setNewProjDurationValue(val);
                            if (typeof val === 'number' && val > 0) {
                              const now = new Date();
                              if (newProjDurationUnit === 'months') now.setMonth(now.getMonth() + val);
                              else if (newProjDurationUnit === 'hours') now.setHours(now.getHours() + val);
                              else now.setDate(now.getDate() + val);
                              setNewProjDeadline(now.toISOString().slice(0, 16));
                            }
                          }}
                          style={{ width: '50%' }}
                        />
                        <select
                          className="cd-form-select"
                          value={newProjDurationUnit}
                          onChange={e => setNewProjDurationUnit(e.target.value)}
                          style={{ width: '50%' }}
                        >
                          <option value="days">Days</option>
                          <option value="months">Months</option>
                          <option value="hours">Hours</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="cd-form-label" style={{ fontSize: 11 }}>Expected End Date &amp; Time (Optional)</label>
                      <input
                        className="cd-form-input"
                        type="datetime-local"
                        value={newProjDeadline}
                        onChange={e => setNewProjDeadline(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="cd-form-row">
                  <label className="cd-form-label">Client Notice &amp; Milestone Guidelines (Optional)</label>
                  <textarea
                    className="cd-form-textarea"
                    rows={2}
                    placeholder="Specific guidelines, delivery format, or review requirements for the specialist..."
                    value={newProjNotice}
                    onChange={e => setNewProjNotice(e.target.value)}
                  />
                </div>
              </form>
            </div>
            <div className="cd-modal-footer">
              <button className="cd-btn-secondary" onClick={() => setNewProjectModalOpen(false)} disabled={paymentProcessing}>Cancel</button>
              <button className="cd-btn-primary" form="newProjForm" type="submit" disabled={paymentProcessing} style={{ minWidth: 200 }}>
                {paymentProcessing ? 'Processing... ⏳' : `Pay ₹${newProjPrice.toLocaleString('en-IN')} with Razorpay 💳`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ CUSTOM ON-DEMAND ORDER MODAL (₹100 ADVANCE) ═══════════ */}
      {customOrderModalOpen && (
        <div className="cd-modal-overlay" onClick={() => !customSubmitting && setCustomOrderModalOpen(false)}>
          <div className="cd-modal" style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()}>
            <div className="cd-modal-header" style={{ borderBottom: '1px solid #e2e8f0' }}>
              <div>
                <h2 style={{ fontSize: 19, margin: 0 }}>⚡ Request Custom Project / On-Demand Scope</h2>
                <small style={{ color: '#64748b' }}>₹100 Consultation &amp; Scoping Advance</small>
              </div>
              <button className="cd-modal-close" onClick={() => !customSubmitting && setCustomOrderModalOpen(false)}>×</button>
            </div>
            <div className="cd-modal-body">
              {/* Advance Info Banner */}
              <div style={{
                background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)',
                border: '1px solid #6366f1',
                borderRadius: 10,
                padding: '14px 16px',
                color: '#ffffff',
                marginBottom: 16
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#38bdf8' }}>
                    🛡️ How Custom On-Demand Pricing Works:
                  </span>
                  <span style={{ background: 'rgba(56, 189, 248, 0.2)', border: '1px solid #38bdf8', color: '#38bdf8', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                    ₹100 Advance Token
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: '#cbd5e1', lineHeight: 1.5 }}>
                  1. Pay <b>₹100 advance deposit</b> to submit your bespoke requirements.<br />
                  2. Workonova Leadership will review your brief and issue a customized price quote with standard 3-stage milestone escrow.<br />
                  3. Approve the quote and pay the 50% Kickoff Milestone to start production!
                </p>
              </div>

              <form id="customProjForm" onSubmit={handleCreateCustomOrder}>
                <div className="cd-form-row">
                  <label className="cd-form-label">Service Domain / Category *</label>
                  <select
                    className="cd-form-select"
                    value={customCategory}
                    onChange={e => setCustomCategory(e.target.value)}
                  >
                    {serviceCategories.map(c => <option key={c}>{c}</option>)}
                    <option value="Custom Software / Full Stack">Custom Software / Full Stack</option>
                    <option value="AI Agent / LLM Integration">AI Agent / LLM Integration</option>
                    <option value="3D VFX / High-End Video Commercial">3D VFX / High-End Video Commercial</option>
                    <option value="Enterprise Design System">Enterprise Design System</option>
                    <option value="Other Custom Project">Other Custom Project</option>
                  </select>
                </div>

                <div className="cd-form-row">
                  <label className="cd-form-label">Detailed Project Requirements &amp; Scope Brief *</label>
                  <textarea
                    className="cd-form-textarea"
                    required
                    rows={4}
                    placeholder="Describe everything you need built: target audience, key features, reference links, specific technologies, design style..."
                    value={customBrief}
                    onChange={e => setCustomBrief(e.target.value)}
                  />
                </div>

                <div className="cd-form-row">
                  <label className="cd-form-label">Google Drive, Dropbox or Figma Assets Link (Optional)</label>
                  <input
                    className="cd-form-input"
                    type="url"
                    placeholder="https://drive.google.com/drive/folders/... or https://dropbox.com/..."
                    value={customLink}
                    onChange={e => setCustomLink(e.target.value)}
                  />
                  <small style={{ fontSize: 11, color: '#64748b', marginTop: 4, display: 'block' }}>
                    Share wireframes, PRD documents, or raw brand assets.
                  </small>
                </div>

                <div className="cd-form-row">
                  <label className="cd-form-label">Estimated Budget or Preferred Timeline (Optional)</label>
                  <input
                    className="cd-form-input"
                    type="text"
                    placeholder="e.g. Budget ~₹40,000 / Need delivery within 2 weeks"
                    value={customBudget}
                    onChange={e => setCustomBudget(e.target.value)}
                  />
                </div>

                {/* Timeline & Delivery Deadline */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, margin: '12px 0' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#475569', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    ⏱️ Preferred Time Limit &amp; Deadline
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label className="cd-form-label" style={{ fontSize: 11 }}>Time Limit (Optional)</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          className="cd-form-input"
                          type="number"
                          min="1"
                          placeholder="e.g. 14"
                          value={customDurationValue}
                          onChange={e => {
                            const val = e.target.value === '' ? '' : Number(e.target.value);
                            setCustomDurationValue(val);
                            if (typeof val === 'number' && val > 0) {
                              const now = new Date();
                              if (customDurationUnit === 'months') now.setMonth(now.getMonth() + val);
                              else if (customDurationUnit === 'hours') now.setHours(now.getHours() + val);
                              else now.setDate(now.getDate() + val);
                              setCustomDeadline(now.toISOString().slice(0, 16));
                            }
                          }}
                          style={{ width: '50%' }}
                        />
                        <select
                          className="cd-form-select"
                          value={customDurationUnit}
                          onChange={e => setCustomDurationUnit(e.target.value)}
                          style={{ width: '50%' }}
                        >
                          <option value="days">Days</option>
                          <option value="months">Months</option>
                          <option value="hours">Hours</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="cd-form-label" style={{ fontSize: 11 }}>Deadline Date &amp; Time (Optional)</label>
                      <input
                        className="cd-form-input"
                        type="datetime-local"
                        value={customDeadline}
                        onChange={e => setCustomDeadline(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="cd-form-row">
                  <label className="cd-form-label">Client Notice &amp; Scope Guidelines (Optional)</label>
                  <textarea
                    className="cd-form-textarea"
                    rows={2}
                    placeholder="Specific milestones, staging review guidelines, or SLA expectations..."
                    value={customNotice}
                    onChange={e => setCustomNotice(e.target.value)}
                  />
                </div>
              </form>
            </div>
            <div className="cd-modal-footer">
              <button className="cd-btn-secondary" onClick={() => setCustomOrderModalOpen(false)} disabled={customSubmitting}>
                Cancel
              </button>
              <button
                className="cd-btn-primary"
                form="customProjForm"
                type="submit"
                disabled={customSubmitting}
                style={{ minWidth: 220, background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
              >
                {customSubmitting ? 'Processing Payment... ⏳' : 'Pay ₹100 Advance via Razorpay 💳'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REVISION MODAL */}
      {revisionModalOpen && activeProjectForModal && (
        <div className="cd-modal-overlay" onClick={() => setRevisionModalOpen(false)}>
          <div className="cd-modal wide" onClick={e => e.stopPropagation()}>
            <div className="cd-modal-header">
              <h2>🔄 Request Revision — #{activeProjectForModal.id.replace('db-', '')}</h2>
              <button className="cd-modal-close" onClick={() => setRevisionModalOpen(false)}>×</button>
            </div>
            <div className="cd-modal-body">
              <p style={{ fontSize: 13, color: '#888', marginBottom: 14 }}>Modifications sent to {activeProjectForModal.freelancer}. {activeProjectForModal.revisionsLeft} revisions remaining.</p>
              <form id="revForm" onSubmit={triggerRevisionRequest}>
                {activeProjectForModal.category === 'web' && (
                  <>
                    <div className="cd-form-row"><label className="cd-form-label">URL / Page with Issue</label><input className="cd-form-input" type="url" required placeholder="https://staging.example.com/checkout" value={revWebUrl} onChange={e => setRevWebUrl(e.target.value)} /></div>
                    <div className="cd-form-row">
                      <label className="cd-form-label">Issue Type</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {['bug', 'ui'].map(t => <button key={t} type="button" style={{ padding: '7px 14px', borderRadius: 6, border: revWebIssueType === t ? '2px solid #56c41a' : '1px solid #e8e7e0', background: revWebIssueType === t ? '#f0fce8' : 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }} onClick={() => setRevWebIssueType(t)}>{t === 'bug' ? '🐛 Bug / Error' : '🎨 UI Glitch'}</button>)}
                      </div>
                    </div>
                    <div className="cd-form-row"><label className="cd-form-label">Describe the Fix Needed</label><textarea className="cd-form-textarea" required placeholder="Explain in detail…" value={revWebDesc} onChange={e => setRevWebDesc(e.target.value)} /></div>
                  </>
                )}
                {activeProjectForModal.category === 'video' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                      <div className="cd-form-row"><label className="cd-form-label">Timecode (MM:SS)</label><input className="cd-form-input" type="text" required placeholder="0:15" value={revVidTime} onChange={e => setRevVidTime(e.target.value)} /></div>
                      <div className="cd-form-row"><label className="cd-form-label">Change Needed</label><input className="cd-form-input" type="text" required placeholder="Cut / caption change…" value={revVidDesc} onChange={e => setRevVidDesc(e.target.value)} /></div>
                    </div>
                    <div className="cd-form-row"><label className="cd-form-label">Notes / References</label><textarea className="cd-form-textarea" placeholder="Additional instructions…" value={revVidNotes} onChange={e => setRevVidNotes(e.target.value)} /></div>
                  </>
                )}
                {activeProjectForModal.category !== 'web' && activeProjectForModal.category !== 'video' && (
                  <>
                    <div className="cd-form-row"><label className="cd-form-label">Asset / Item</label><select className="cd-form-select" value={revDesignItem} onChange={e => setRevDesignItem(e.target.value)}><option>Ad Creative #1 (Facebook Feed)</option><option>Ad Creative #2 (Instagram Reel)</option><option>Banner Ads (1200x628)</option></select></div>
                    <div className="cd-form-row"><label className="cd-form-label">Revision Details</label><textarea className="cd-form-textarea" required placeholder="E.g. Change headline font size…" value={revDesignDesc} onChange={e => setRevDesignDesc(e.target.value)} /></div>
                  </>
                )}
              </form>
            </div>
            <div className="cd-modal-footer">
              <button className="cd-btn-secondary" onClick={() => setRevisionModalOpen(false)}>Cancel</button>
              <button className="cd-btn-primary" form="revForm" type="submit">Send Revision Request 🔄</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD-ON MODAL */}
      {addonModalOpen && activeProjectForModal && (
        <div className="cd-modal-overlay" onClick={() => setAddonModalOpen(false)}>
          <div className="cd-modal" onClick={e => e.stopPropagation()}>
            <div className="cd-modal-header">
              <h2>➕ Scope Add-on — #{activeProjectForModal.id.replace('db-', '')}</h2>
              <button className="cd-modal-close" onClick={() => setAddonModalOpen(false)}>×</button>
            </div>
            <div className="cd-modal-body">
              <form id="addonForm" onSubmit={triggerAddonPurchase}>
                {(ADDON_CATALOG[activeProjectForModal.category] || []).map((opt, i) => (
                  <div key={i} onClick={() => setSelectedAddonIndex(i)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', marginBottom: 8, borderRadius: 8, border: selectedAddonIndex === i ? '2px solid #56c41a' : '1px solid #e8e7e0', background: selectedAddonIndex === i ? '#f0fce8' : '#fafaf8', cursor: 'pointer' }}>
                    <div><b style={{ fontSize: 13 }}>{opt.label}</b><small style={{ display: 'block', color: '#888', marginTop: 2 }}>{opt.desc}</small></div>
                    <b style={{ fontSize: 14, color: '#111', flexShrink: 0, marginLeft: 12 }}>₹{opt.cost.toLocaleString('en-IN')}</b>
                  </div>
                ))}
                {(ADDON_CATALOG[activeProjectForModal.category] || []).length === 0 && <p style={{ textAlign: 'center', color: '#aaa', padding: '20px 0' }}>No add-ons available for this category.</p>}
              </form>
            </div>
            <div className="cd-modal-footer">
              <button className="cd-btn-secondary" onClick={() => setAddonModalOpen(false)}>Cancel</button>
              {selectedAddonIndex !== null && <button className="cd-btn-primary" form="addonForm" type="submit">Pay &amp; Add to Project →</button>}
              <button className="cd-btn-secondary" onClick={() => { setAddonModalOpen(false); triggerToast('✉️ Quote request sent to support.'); }}>Request Quote</button>
            </div>
          </div>
        </div>
      )}

      {/* THREAD MODAL */}
      {threadModalOpen && activeProjectForModal && (
        <div className="cd-modal-overlay" onClick={() => setThreadModalOpen(false)}>
          <div className="cd-modal wide" onClick={e => e.stopPropagation()}>
            <div className="cd-modal-header">
              <h2>💬 Discussion — #{activeProjectForModal.id.replace('db-', '')}</h2>
              <button className="cd-modal-close" onClick={() => setThreadModalOpen(false)}>×</button>
            </div>
            <div className="cd-modal-body">
              <div className="cd-chat-list">
                {chatMessages.length === 0 && activeProjectForModal.discussion.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#aaa', padding: '20px 0', fontSize: 13 }}>No messages yet. Send a query below.</p>
                ) : (
                  <>
                    {activeProjectForModal.discussion.map((msg, i) => (
                      <div key={`m-${i}`} className={`cd-chat-msg${msg.type === 'client' ? ' client' : ''}`}>
                        <div className={`cd-chat-av${msg.type === 'client' ? ' client' : ''}`}>{msg.type === 'client' ? initials : msg.sender[0]}</div>
                        <div>
                          <div className="cd-chat-bubble">{msg.text}</div>
                          <div className="cd-chat-time">{msg.sender} · {msg.time}</div>
                        </div>
                      </div>
                    ))}
                    {chatMessages.map(msg => {
                      const isClient = msg.senderRole === 'client';
                      return (
                        <div key={msg.id} className={`cd-chat-msg${isClient ? ' client' : ''}`}>
                          <div className={`cd-chat-av${isClient ? ' client' : ''}`}>{isClient ? initials : 'W'}</div>
                          <div>
                            <div className="cd-chat-bubble">{msg.messageText}</div>
                            <div className="cd-chat-time">{isClient ? 'You' : 'Workonova'} · {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={chatMessagesEndRef} />
                  </>
                )}
              </div>
              <form onSubmit={handleSendChatMessage}>
                <div className="cd-chat-input-row">
                  <input className="cd-chat-input" required placeholder="Ask a question or leave feedback…" value={newMessageText} onChange={e => setNewMessageText(e.target.value)} />
                  <button type="submit" className="cd-chat-send">Send 💬</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* APPROVE MODAL (MIDPOINT, FINAL & CUSTOM QUOTE) */}
      {approveModalOpen && activeProjectForModal && (
        <div className="cd-modal-overlay" onClick={() => setApproveModalOpen(false)}>
          <div className="cd-modal" onClick={e => e.stopPropagation()}>
            <div className="cd-modal-header">
              <h2>
                {activeProjectForModal.rawStatus === 'quote_provided'
                  ? '📋 Review Custom Quote & Pay Kickoff'
                  : activeProjectForModal.rawStatus === 'midpoint_submitted'
                  ? '✅ Review & Approve 50% Midpoint Deliverable'
                  : '✅ Approve Final Deliverables & Settle Milestone'}
              </h2>
              <button className="cd-modal-close" onClick={() => setApproveModalOpen(false)}>×</button>
            </div>
            <div className="cd-modal-body">
              {activeProjectForModal.rawStatus === 'quote_provided' ? (
                <div>
                  <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, padding: 14, marginBottom: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#065f46', marginBottom: 4 }}>
                      🎉 Custom Project Scope Quoted
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#047857' }}>
                      ₹{activeProjectForModal.amount.toLocaleString('en-IN')}
                    </div>
                    <p style={{ margin: '6px 0 0 0', fontSize: 12, color: '#065f46', lineHeight: 1.4 }}>
                      Workonova Leadership has evaluated your custom project brief and established the milestone schedule.
                    </p>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 12.5, color: '#334155' }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>💰 Milestone 1 Kickoff (50%):</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                      ₹{Math.round(activeProjectForModal.amount * 0.5).toLocaleString('en-IN')}
                    </div>
                    <small style={{ color: '#64748b', display: 'block', marginTop: 4 }}>
                      Paying 50% activates production and matches a verified lead specialist.
                    </small>
                  </div>

                  <button
                    type="button"
                    className="cd-btn-primary"
                    style={{ width: '100%', padding: '12px', fontSize: 14, background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                    disabled={paymentProcessing}
                    onClick={() => handlePayMilestone(activeProjectForModal, 1)}
                  >
                    {paymentProcessing ? 'Processing… ⏳' : `💳 Pay 50% Kickoff (₹${Math.round(activeProjectForModal.amount * 0.5).toLocaleString('en-IN')}) & Start Production →`}
                  </button>
                </div>
              ) : activeProjectForModal.rawStatus === 'midpoint_submitted' ? (
                <div>
                  <p style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>
                    Your specialist has submitted the 50% midpoint deliverables. Review the preview link below:
                  </p>
                  {activeProjectForModal.midpointSubmissionLink && (
                    <div style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 8, padding: 12, marginBottom: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>50% Deliverable Folder:</div>
                      <a href={activeProjectForModal.midpointSubmissionLink} target="_blank" rel="noreferrer" style={{ color: '#4f46e5', fontWeight: 600, fontSize: 13, textDecoration: 'underline' }}>
                        📁 Open Specialist 50% Deliverable (Google Drive / Dropbox) ↗
                      </a>
                      {activeProjectForModal.midpointSubmissionNotes && (
                        <p style={{ margin: '8px 0 0 0', fontSize: 12, color: '#334155' }}>
                          <b>Specialist Notes:</b> {activeProjectForModal.midpointSubmissionNotes}
                        </p>
                      )}
                    </div>
                  )}
                  <p style={{ fontSize: 12.5, color: '#64748b', lineHeight: 1.5, marginBottom: 14 }}>
                    Approving the midpoint releases Milestone 2 payment (25% = <b>₹{Math.round((activeProjectForModal.amount || 14999) * 0.25).toLocaleString('en-IN')}</b>) and authorizes your specialist to build the 100% final deliverables.
                  </p>
                  <button
                    type="button"
                    className="cd-btn-primary"
                    style={{ width: '100%', padding: '12px', fontSize: 14 }}
                    disabled={paymentProcessing}
                    onClick={() => handleApproveMidpoint(activeProjectForModal)}
                  >
                    {paymentProcessing ? 'Processing… ⏳' : `✅ Approve 50% Work & Pay Milestone 2 (25% · ₹${Math.round((activeProjectForModal.amount || 14999) * 0.25).toLocaleString('en-IN')}) 💳`}
                  </button>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: 13, color: '#888', marginBottom: 14 }}>
                    Once approved, your project is finalized and the final 25% milestone payment is funded into admin escrow.
                  </p>
                  <div className="cd-checklist">
                    {[{ s: ac1, set: setAc1, text: 'I have reviewed all delivered files' }, { s: ac2, set: setAc2, text: 'All revision requests have been incorporated' }, { s: ac3, set: setAc3, text: 'I am satisfied with the final quality' }].map(({ s, set, text }) => (
                      <label key={text} className="cd-check-item">
                        <input type="checkbox" checked={s} onChange={e => set(e.target.checked)} />
                        <span style={{ fontSize: 13 }}>{text}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="cd-modal-footer">
              <button className="cd-btn-secondary" onClick={() => setApproveModalOpen(false)}>Cancel</button>
              {activeProjectForModal.rawStatus !== 'midpoint_submitted' && (
                <button
                  className="cd-btn-primary"
                  disabled={!(ac1 && ac2 && ac3)}
                  onClick={async () => {
                    if (activeProjectForModal.amountPaid && activeProjectForModal.amountPaid < activeProjectForModal.amount) {
                      await handlePayMilestone(activeProjectForModal, 3);
                    }
                    triggerPayoutFinalize();
                  }}
                  style={!(ac1 && ac2 && ac3) ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                >
                  ✅ Approve &amp; Release Final Milestone 3
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EMAIL CHANGE OTP MODAL */}
      {emailChangeModalOpen && (
        <div className="cd-modal-overlay" onClick={() => setEmailChangeModalOpen(false)}>
          <div className="cd-modal" onClick={e => e.stopPropagation()}>
            <div className="cd-modal-header">
              <h2>🔐 Update Account Email</h2>
              <button className="cd-modal-close" onClick={() => setEmailChangeModalOpen(false)}>×</button>
            </div>
            <div className="cd-modal-body">
              {!emailOtpSent ? (
                <div>
                  <p style={{ fontSize: 13, color: '#64748b', marginBottom: 14 }}>
                    Enter your new email address. We will immediately dispatch a 6-digit security OTP code to verify ownership.
                  </p>
                  <div className="cd-form-row">
                    <label className="cd-form-label">New Email Address</label>
                    <input
                      className="cd-form-input"
                      type="email"
                      required
                      placeholder="newemail@example.com"
                      value={newEmailInput}
                      onChange={e => setNewEmailInput(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="cd-btn-primary"
                    style={{ width: '100%', marginTop: 8 }}
                    disabled={profileSaving}
                    onClick={handleRequestEmailChange}
                  >
                    {profileSaving ? 'Sending OTP… ⏳' : 'Send 6-Digit Verification Code →'}
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ background: '#e0e7ff', color: '#3730a3', padding: '10px 14px', borderRadius: 8, fontSize: 12.5, marginBottom: 16 }}>
                    📧 We sent a 6-digit code to <b>{newEmailInput}</b>. Check your inbox and spam folder.
                  </div>
                  <div className="cd-form-row">
                    <label className="cd-form-label">Enter 6-Digit OTP Code</label>
                    <input
                      className="cd-form-input"
                      type="text"
                      maxLength={6}
                      placeholder="123456"
                      style={{ fontSize: 20, letterSpacing: 6, textAlign: 'center', fontWeight: 'bold' }}
                      value={emailOtpInput}
                      onChange={e => setEmailOtpInput(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="cd-btn-primary"
                    style={{ width: '100%', marginTop: 8 }}
                    disabled={profileSaving}
                    onClick={handleVerifyEmailChange}
                  >
                    {profileSaving ? 'Verifying… ⏳' : '✓ Confirm & Update Email Address'}
                  </button>
                  <div style={{ textAlign: 'center', marginTop: 12 }}>
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => setEmailOtpSent(false)}
                    >
                      ← Change entered email
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* NEW BRAND MODAL */}
      {newBrandModalOpen && (
        <div className="cd-modal-overlay" onClick={() => setNewBrandModalOpen(false)}>
          <div className="cd-modal" onClick={e => e.stopPropagation()}>
            <div className="cd-modal-header">
              <h2>📁 Create Brand Profile</h2>
              <button className="cd-modal-close" onClick={() => setNewBrandModalOpen(false)}>×</button>
            </div>
            <div className="cd-modal-body">
              <form id="brandForm" onSubmit={handleCreateBrand}>
                <div className="cd-form-row"><label className="cd-form-label">Brand Name</label><input className="cd-form-input" type="text" required placeholder="e.g. FitPeak…" value={newBrandName} onChange={e => setNewBrandName(e.target.value)} /></div>
                <div className="cd-form-row"><label className="cd-form-label">Industry / Category</label><input className="cd-form-input" type="text" placeholder="e.g. Fitness, SaaS…" value={newBrandIndustry} onChange={e => setNewBrandIndustry(e.target.value)} /></div>
                <div className="cd-form-row"><label className="cd-form-label">Primary Brand Color</label><input type="color" value={newBrandColor} onChange={e => setNewBrandColor(e.target.value)} style={{ height: 40, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} /></div>
                <div className="cd-form-row"><label className="cd-form-label">Google Drive Folder URL</label><input className="cd-form-input" type="url" placeholder="https://drive.google.com/…" value={newBrandFolder} onChange={e => setNewBrandFolder(e.target.value)} /></div>
              </form>
            </div>
            <div className="cd-modal-footer">
              <button className="cd-btn-secondary" onClick={() => setNewBrandModalOpen(false)}>Cancel</button>
              <button className="cd-btn-primary" form="brandForm" type="submit">Create Brand Profile</button>
            </div>
          </div>
        </div>
      )}

      {/* BILLING MODAL */}
      {billingModalOpen && (
        <div className="cd-modal-overlay" onClick={() => setBillingModalOpen(false)}>
          <div className="cd-modal" onClick={e => e.stopPropagation()}>
            <div className="cd-modal-header">
              <h2>🧾 Billing &amp; GST Settings</h2>
              <button className="cd-modal-close" onClick={() => setBillingModalOpen(false)}>×</button>
            </div>
            <div className="cd-modal-body">
              <form id="billingForm" onSubmit={handleBillingSave}>
                <div className="cd-form-row"><label className="cd-form-label">Company Name</label><input className="cd-form-input" type="text" value={billingDetails.companyName} onChange={e => setBillingDetails({ ...billingDetails, companyName: e.target.value })} /></div>
                <div className="cd-form-row"><label className="cd-form-label">GST Number</label><input className="cd-form-input" type="text" value={billingDetails.gstNumber} onChange={e => setBillingDetails({ ...billingDetails, gstNumber: e.target.value })} /></div>
                <div className="cd-form-row"><label className="cd-form-label">Billing Email</label><input className="cd-form-input" type="email" value={billingDetails.billingEmail} onChange={e => setBillingDetails({ ...billingDetails, billingEmail: e.target.value })} /></div>
                <div className="cd-form-row"><label className="cd-form-label">Billing Address</label><textarea className="cd-form-textarea" rows={3} value={billingDetails.billingAddress} onChange={e => setBillingDetails({ ...billingDetails, billingAddress: e.target.value })} /></div>
              </form>
            </div>
            <div className="cd-modal-footer">
              <button className="cd-btn-secondary" onClick={() => setBillingModalOpen(false)}>Cancel</button>
              <button className="cd-btn-primary" form="billingForm" type="submit">Save Billing Info</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ TESTIMONIAL / RATING POPUP MODAL (After Project Approval) ══ */}
      {feedbackModalOpen && (
        <div className="cd-modal-overlay" onClick={() => setFeedbackModalOpen(false)}>
          <div className="cd-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 540, borderRadius: 16, background: '#ffffff', color: '#0f172a' }}>
            <div className="cd-modal-header" style={{ borderBottom: '1px solid #f1f5f9', padding: '20px 24px' }}>
              <div>
                <h2 style={{ fontSize: 20, margin: 0, color: '#0f172a', fontWeight: 800 }}>⭐ Rate Your Project Experience</h2>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>Your feedback helps maintain top-tier execution and quality standards.</p>
              </div>
              <button className="cd-modal-close" onClick={() => setFeedbackModalOpen(false)}>×</button>
            </div>
            <div className="cd-modal-body" style={{ padding: '24px' }}>
              <form id="feedbackForm" onSubmit={handleTestimonialSubmit}>
                {/* Rating Selector */}
                <div style={{ marginBottom: 20, textAlign: 'center', background: '#f8fafc', padding: '16px', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.05em' }}>
                    Overall Rating ({feedbackRating} of 5 Stars)
                  </label>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFeedbackRating(star)}
                        style={{
                          background: 'none',
                          border: 'none',
                          fontSize: 32,
                          cursor: 'pointer',
                          color: star <= feedbackRating ? '#f59e0b' : '#cbd5e1',
                          transition: 'transform 0.15s ease',
                          transform: star <= feedbackRating ? 'scale(1.1)' : 'scale(1)',
                        }}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                <div className="cd-form-row" style={{ marginBottom: 16 }}>
                  <label className="cd-form-label" style={{ fontWeight: 700, color: '#334155' }}>Your Title / Company Name</label>
                  <input
                    className="cd-form-input"
                    type="text"
                    placeholder="e.g. Founder, Nova Studio / Marketing Lead"
                    value={feedbackRole}
                    onChange={e => setFeedbackRole(e.target.value)}
                  />
                </div>

                <div className="cd-form-row" style={{ marginBottom: 8 }}>
                  <label className="cd-form-label" style={{ fontWeight: 700, color: '#334155' }}>Your Review &amp; Feedback *</label>
                  <textarea
                    className="cd-form-textarea"
                    rows={4}
                    required
                    placeholder="Describe your experience with the deliverables, adherence to timeline, and overall quality..."
                    value={feedbackQuote}
                    onChange={e => setFeedbackQuote(e.target.value)}
                  />
                </div>
              </form>
            </div>
            <div className="cd-modal-footer" style={{ borderTop: '1px solid #f1f5f9', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button type="button" className="cd-btn-secondary" onClick={() => setFeedbackModalOpen(false)}>Skip for now</button>
              <button
                className="cd-btn-primary"
                form="feedbackForm"
                type="submit"
                disabled={feedbackSubmitting}
                style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}
              >
                {feedbackSubmitting ? 'Submitting… ⏳' : '⭐ Submit Testimonial'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
