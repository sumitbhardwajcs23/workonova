import { useState, useEffect, useRef } from 'react';
import { getUser, getToken, logout } from '../utils/auth.js';
import WelcomePopup from '../components/WelcomePopup.tsx';
import { API_BASE } from '../config.js';
import './ClientDashboard.css';

// ── TYPES & INTERFACES ────────────────────────────────────────
interface Order {
  id: number;
  serviceCategory: string;
  tier: string;
  price: number;
  status: string;
  description: string;
  submissionLink: string;
  qaApprovedLink: string;
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
  status: 'In Progress' | 'In Review' | 'Delivered' | 'Cancelled' | 'Submitted';
  placedDate: string;
  estDelivery: string;
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

const INITIAL_BRAND_PROFILES: Record<string, BrandProfile> = {
  northstar: {
    name: 'NorthStar Agency',
    logo: '🖼️ NorthStar_Main_Logo.svg',
    colors: ['#0f1a0d', '#56c41a', '#eef9e6'],
    font: 'Outfit / Inter',
    driveLink: 'https://drive.google.com',
    briefs: ['Website_CreativeBrief.pdf', 'Q3_Campaign_Deck.pptx']
  },
  fitpeak: {
    name: 'FitPeak (Fitness Brand)',
    logo: '🖼️ FitPeak_Orange_Monk.png',
    colors: ['#ff5722', '#212121', '#fafafa'],
    font: 'Syne / Syne Bold',
    driveLink: 'https://drive.google.com',
    briefs: ['Reels_Editing_Styleguide.docx']
  }
};

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

const CAT_META: Record<string, { icon: string; label: string; subs: string[] }> = {
  video:   { icon: '🎬', label: 'Video & Motion',          subs: ['Short-Form Reels / Shorts', 'YouTube Long-Form', '2D/3D Motion Graphics'] },
  design:  { icon: '🎨', label: 'Graphic & Brand Design',  subs: ['UI/UX Design (Figma)', 'Graphic Design & Ads', 'Brand Identity & Logos'] },
  web:     { icon: '🌐', label: 'Web & Software Dev',      subs: ['Web Development', 'E-Commerce & Custom CMS'] },
  ai:      { icon: '⚡', label: 'AI & Automation',         subs: ['AI Agents & Chatbots', 'Workflow Automation'] },
  content: { icon: '✍️', label: 'Content & Marketing',     subs: [] }
};

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
  project, onOpenRevision, onOpenApprove, onOpenAddon, onOpenThread, triggerToast
}: {
  project: Project;
  onOpenRevision: () => void;
  onOpenApprove: () => void;
  onOpenAddon: () => void;
  onOpenThread: () => void;
  triggerToast: (msg: string) => void;
}) {
  const stepLabels = ['Submitted', 'In Progress', 'In Review', 'Delivered'];
  const percentSla = project.slaHoursRemaining ? Math.round((project.slaHoursRemaining / 72) * 100) : 0;

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
        <p className="cd-project-meta">Placed: {project.placedDate} &nbsp;•&nbsp; Est. Delivery: <b>{project.estDelivery}</b></p>

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

        {/* SLA Countdown */}
        {project.status === 'In Review' && project.slaHoursRemaining !== undefined && (
          <div className="cd-sla-bar">
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
      <div className="cd-card-actions">
        {project.status === 'In Review' && (
          <>
            <button className="cd-action-btn" onClick={onOpenRevision}>
              🔄 Request Revision <span style={{ opacity: 0.7 }}>({project.revisionsLeft} left)</span>
            </button>
            <button className="cd-action-btn primary-action" onClick={onOpenApprove}>
              ✅ Approve &amp; Finalize
            </button>
          </>
        )}
        {project.status === 'In Progress' && (
          <button className="cd-action-btn" onClick={onOpenAddon}>
            ➕ Request Scope Add-on
          </button>
        )}
        <button className="cd-action-btn" onClick={onOpenThread}>
          💬 Project Discussion Thread ({project.discussion.length})
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

  const [notifications, setNotifications] = useState<Notification[]>([
    { id: 'n1', title: 'Design Deliverables Ready for Review', desc: 'Order #WN-2026-98 · 10 Ad Creatives are ready. Please review within 72 hours.', time: 'Just now', unread: true },
    { id: 'n2', title: 'Milestone Update · Web Dev', desc: 'Order #WN-2026-105 · "Database schema completed, Razorpay webhook being integrated."', time: '35 minutes ago', unread: true },
    { id: 'n3', title: 'Invoice Generated', desc: 'Order #WN-2026-89 · Invoice INV-2026-089 is ready for download.', time: '2 days ago', unread: false }
  ]);

  // ── BRAND VAULT STATE ─────────────────────────────────────────
  const [brandProfiles, setBrandProfiles] = useState<Record<string, BrandProfile>>(INITIAL_BRAND_PROFILES);
  const [selectedBrandKey, setSelectedBrandKey] = useState('northstar');

  // ── BILLING & GST STATE ───────────────────────────────────────
  const [billingDetails, setBillingDetails] = useState({
    companyName: 'NorthStar Agency Pvt. Ltd.',
    gstNumber: '27AABCN1234A1Z5',
    billingEmail: 'accounts@northstar.in',
    billingAddress: 'C-101, Andheri East, Mumbai, Maharashtra – 400069'
  });

  // ── SUPPORT STATE ─────────────────────────────────────────────
  const [supportSubject, setSupportSubject] = useState('Project-related question');
  const [supportOrderId, setSupportOrderId] = useState('');
  const [supportMessage, setSupportMessage] = useState('');

  // ── MODAL STATES ──────────────────────────────────────────────
  const [activeProjectForModal, setActiveProjectForModal] = useState<Project | null>(null);
  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false);
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);
  const [addonModalOpen, setAddonModalOpen] = useState(false);
  const [threadModalOpen, setThreadModalOpen] = useState(false);
  const [newBrandModalOpen, setNewBrandModalOpen] = useState(false);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [billingModalOpen, setBillingModalOpen] = useState(false);

  // Modal fields
  const [newProjCategory, setNewProjCategory] = useState(serviceCategories[0]);
  const [newProjTier, setNewProjTier] = useState('silver');
  const [newProjPrice, setNewProjPrice] = useState(14999);
  const [newProjBrief, setNewProjBrief] = useState('');
  const [newProjLink, setNewProjLink] = useState('');

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

  // ── FETCH ORDERS ──────────────────────────────────────────────
  const fetchOrders = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/client/orders`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch orders');
      mergeOrdersAndTemplates(data.data || []);
    } catch (err: any) {
      triggerToast('❌ Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  // ── CHAT POLLING ──────────────────────────────────────────────
  useEffect(() => {
    let interval: any;
    if (threadModalOpen && activeProjectForModal?.dbId) {
      fetchChatMessages(activeProjectForModal.dbId);
      interval = setInterval(() => fetchChatMessages(activeProjectForModal.dbId!), 4000);
    }
    return () => clearInterval(interval);
  }, [threadModalOpen, activeProjectForModal]);

  useEffect(() => { chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  // ── MERGE ORDERS + TEMPLATES ──────────────────────────────────
  const mergeOrdersAndTemplates = (orders: Order[]) => {
    const mockProjects: Project[] = [
      {
        id: 'WN-2026-105', title: 'Landing Page + Razorpay Integration', category: 'web',
        freelancer: 'Sumit Bhardwaj', status: 'In Progress', placedDate: 'Aug 14, 2026', estDelivery: 'Aug 18, 2026',
        amount: 34999, currentStep: 1,
        stepDates: ['Aug 14', 'Aug 14 · Current', 'Est. Aug 17', 'Aug 18'],
        assets: [{ name: 'Figma UI Link', url: 'https://figma.com' }, { name: 'API_Specs.pdf', url: '#' }, { name: 'Drive Assets ↗', url: 'https://drive.google.com' }],
        updates: [
          { date: 'Aug 15', text: 'Database schema completed, integrating Razorpay payment webhook' },
          { date: 'Aug 14', text: 'Client brief analyzed, initial project scaffold setup' }
        ],
        deliverables: { title: 'Staging preview and repository ready soon.', links: [] },
        revisionsLeft: 2, discussion: [{ sender: 'Sumit Bhardwaj', text: 'Brief analyzed, scaffold is ready!', time: 'Aug 14 · 10:00 AM', type: 'team' }]
      },
      {
        id: 'WN-2026-98', title: '10 Social Ad Creatives & Display Banners', category: 'design',
        freelancer: 'Priya Mehta', status: 'In Review', placedDate: 'Aug 10, 2026', estDelivery: 'Aug 16, 2026 (Today)',
        amount: 12000, currentStep: 2,
        stepDates: ['Aug 10', 'Aug 12', 'Aug 16 · Under Review', 'Aug 17'],
        assets: [{ name: 'Figma Workspace', url: 'https://figma.com' }, { name: 'Ad_Copy_Brief.docx', url: '#' }],
        updates: [
          { date: 'Aug 16', text: 'Delivered initial drafts for review' },
          { date: 'Aug 13', text: 'Approved custom graphics assets' }
        ],
        deliverables: {
          title: 'High-Res PNGs & Figma Files Ready for Inspection',
          links: [{ name: '🖼️ Download High-Res PNGs', url: 'https://drive.google.com' }, { name: '🎨 Open Figma Draft ↗', url: 'https://figma.com' }]
        },
        revisionsLeft: 1, slaHoursRemaining: 72,
        discussion: [{ sender: 'Priya Mehta', text: 'Hi! All 10 creatives are done. Let me know if you need adjustments!', time: 'Aug 16 · 11:00 AM', type: 'team' }]
      },
      {
        id: 'WN-2026-89', title: 'Short-Form Reels Post-Production Bundle', category: 'video',
        freelancer: 'Alex Sharma', status: 'Delivered', placedDate: 'Jul 28, 2026', estDelivery: 'Aug 04, 2026',
        amount: 9999, currentStep: 3,
        stepDates: ['Jul 28', 'Jul 29', 'Aug 02', 'Aug 04 · Finalized'],
        assets: [{ name: 'Footage Folder (Drive)', url: 'https://drive.google.com' }],
        updates: [{ date: 'Aug 04', text: 'Client approved deliverables, payment released.' }],
        deliverables: { title: 'Approved finals delivery', links: [{ name: '🎥 Download Final Reels', url: 'https://drive.google.com' }] },
        revisionsLeft: 0, discussion: []
      }
    ];

    const mappedDbProjects: Project[] = orders.map((o) => {
      let category: 'web' | 'design' | 'video' | 'ai' | 'content' = 'web';
      const cat = o.serviceCategory.toLowerCase();
      if (cat.includes('design') || cat.includes('logo') || cat.includes('brand') || cat.includes('graphic')) category = 'design';
      else if (cat.includes('video') || cat.includes('edit') || cat.includes('motion') || cat.includes('vfx') || cat.includes('anim')) category = 'video';
      else if (cat.includes('ai') || cat.includes('automation') || cat.includes('chatbot')) category = 'ai';
      else if (cat.includes('content') || cat.includes('marketing') || cat.includes('copy')) category = 'content';

      let status: 'Submitted' | 'In Progress' | 'In Review' | 'Delivered' | 'Cancelled' = 'In Progress';
      let currentStep = 1;
      if (o.status === 'pending_payment') { status = 'Submitted'; currentStep = 0; }
      else if (o.status === 'paid' || o.status === 'assigned') { status = 'In Progress'; currentStep = 1; }
      else if (o.status === 'submitted' || o.status === 'qa_approved') { status = 'In Review'; currentStep = 2; }
      else if (o.status === 'delivered') { status = 'Delivered'; currentStep = 3; }
      else if (o.status === 'cancelled') { status = 'Cancelled'; currentStep = 0; }

      const createdDate = new Date(o.createdAt || Date.now());
      const estDate = new Date(createdDate.getTime() + 4 * 24 * 60 * 60 * 1000);
      const formattedCreated = createdDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
      const formattedEst = estDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      const deliverableLinks = o.qaApprovedLink ? [{ name: '🖼️ Download QA Assets', url: o.qaApprovedLink }] : [];
      const updates = [{ date: createdDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }), text: 'Intake brief successfully submitted.' }];
      if (o.adminRevisionComments) updates.unshift({ date: new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }), text: `Revision requested: "${o.adminRevisionComments}"` });

      return {
        id: `db-${o.id}`, dbId: o.id, title: `${o.serviceCategory} - Intake Setup`, category,
        freelancer: o.status === 'pending_payment' ? 'Not Assigned' : 'Workonova Specialist',
        status, placedDate: formattedCreated, estDelivery: formattedEst, amount: o.price, currentStep,
        stepDates: [createdDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }), o.status !== 'pending_payment' ? 'In Progress' : 'Pending Intake', (o.status === 'submitted' || o.status === 'qa_approved' || o.status === 'delivered') ? 'Under Review' : 'Est. ' + formattedEst, o.status === 'delivered' ? 'Finalized' : 'Handoff'],
        assets: [{ name: 'Project Brief Link', url: o.submissionLink || '#' }],
        updates,
        deliverables: { title: o.qaApprovedLink ? 'QA approved finals are ready' : 'Final assets in QA validation pipeline', links: deliverableLinks },
        revisionsLeft: 2, slaHoursRemaining: status === 'In Review' ? 72 : undefined, discussion: []
      };
    });

    const combined = [...mappedDbProjects, ...mockProjects.filter(mock => !orders.some(o => o.id === parseInt(mock.id.replace('db-', ''))))];
    setAllProjects(combined);
  };

  // ── ORDER CREATION ────────────────────────────────────────────
  const handleTierChange = (tierTag: string) => {
    setNewProjTier(tierTag);
    const selected = pricingTiers.find(p => p.tag === tierTag);
    if (selected) setNewProjPrice(selected.price);
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjBrief || !newProjLink) { triggerToast('⚠️ Please provide both brief description and assets folder link.'); return; }
    const drivePattern = /^(https?:\/\/)?(drive\.google\.com|dropbox\.com|.*\.dropbox\.com)\/.+$/;
    if (!drivePattern.test(newProjLink)) { triggerToast('⚠️ Link must be a valid Google Drive or Dropbox URL.'); return; }
    try {
      const res1 = await fetch(`${API_BASE}/api/client/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ serviceCategory: newProjCategory, tier: newProjTier, price: newProjPrice, description: newProjBrief }) });
      const data1 = await res1.json();
      if (!res1.ok) throw new Error(data1.error || 'Failed to initialize order');
      const res2 = await fetch(`${API_BASE}/api/client/orders/${data1.data.id}/submit`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ description: newProjBrief, submissionLink: newProjLink }) });
      const data2 = await res2.json();
      if (!res2.ok) throw new Error(data2.error || 'Failed to submit details');
      triggerToast('🎉 Project order placed and briefly submitted successfully!');
      setNewProjBrief(''); setNewProjLink(''); setNewProjectModalOpen(false); fetchOrders();
    } catch (err: any) { triggerToast('❌ ' + err.message); }
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
    try {
      const res = await fetch(`${API_BASE}/api/client/orders/${activeProjectForModal.dbId}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ messageText: textToSend }) });
      if (res.ok) { if (!customText) setNewMessageText(''); fetchChatMessages(activeProjectForModal.dbId); }
    } catch (e) { console.error(e); }
  };

  // ── TESTIMONIAL ───────────────────────────────────────────────
  const handleTestimonialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testimonialQuote) return;
    try {
      const res = await fetch(`${API_BASE}/api/client/testimonials`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ quote: testimonialQuote, stars: testimonialStars }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      triggerToast('✅ Testimonial submitted to admin approval queue!');
      setTestimonialQuote('');
    } catch (err: any) { triggerToast('❌ ' + err.message); }
  };

  // ── SUPPORT TICKET ────────────────────────────────────────────
  const handleSupportTicketSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportMessage) return;
    triggerToast('📩 Support ticket opened! Priya Mehta will reply within 4 hours.');
    setSupportMessage('');
  };

  // ── REVISION ─────────────────────────────────────────────────
  const triggerRevisionRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProjectForModal) return;
    let details = '';
    if (activeProjectForModal.category === 'web') details = `Bug on (${revWebUrl}): ${revWebDesc}`;
    else if (activeProjectForModal.category === 'video') details = `Cut at ${revVidTime}: ${revVidDesc}. Notes: ${revVidNotes}`;
    else details = `Design mod for ${revDesignItem}: ${revDesignDesc}`;
    setAllProjects(prev => prev.map(p => p.id === activeProjectForModal.id ? { ...p, status: 'In Progress', currentStep: 1, slaHoursRemaining: undefined, revisionsLeft: p.revisionsLeft - 1, updates: [{ date: 'Today', text: `Revision requested: "${details.slice(0, 50)}..."` }, ...p.updates] } : p));
    if (activeProjectForModal.dbId) handleSendChatMessage(e, `🔄 [SYSTEM RELAY] Client requested revision: "${details}"`);
    setRevisionModalOpen(false);
    triggerToast('🔄 Revision sent to developer! Project returned to In Progress.');
  };

  // ── APPROVE ───────────────────────────────────────────────────
  const triggerPayoutFinalize = () => {
    if (!activeProjectForModal) return;
    setAllProjects(prev => prev.map(p => p.id === activeProjectForModal.id ? { ...p, status: 'Delivered', currentStep: 3, slaHoursRemaining: undefined, updates: [{ date: 'Today', text: 'Project finalized and payout released!' }, ...p.updates] } : p));
    if (activeProjectForModal.dbId) handleSendChatMessage(null as any, '✅ [SYSTEM RELAY] Client approved files. Releasing funds.');
    setApproveModalOpen(false);
    triggerToast('✅ Project marked complete! Freelancer payment released.');
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
          <button className="cd-notif-btn" onClick={() => { setNotifPanelOpen(!notifPanelOpen); setProfileDropdownOpen(false); setTimeout(() => setNotifications(prev => prev.map(n => ({ ...n, unread: false }))), 1800); }} aria-label="Notifications">
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
                <button className="cd-dd-item" onClick={() => { setProfileDropdownOpen(false); setBillingModalOpen(true); }}>🧾 Billing &amp; GST Settings</button>
                <button className="cd-dd-item" onClick={() => { setProfileDropdownOpen(false); triggerToast('🔔 Notification preferences updated!'); }}>🔔 Notification Preferences</button>
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
                  <button className="cd-new-btn" onClick={() => setNewProjectModalOpen(true)}>+ Start New Project</button>
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
                          <td><button className="cd-table-link" onClick={() => openProject(p)}>Chat &amp; Details ↗</button></td>
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
                        const inv = `INV-2026-${100 + i}`;
                        return (
                          <tr key={p.id}>
                            <td>{inv}</td>
                            <td>#{p.id.replace('db-', '')}</td>
                            <td>{p.placedDate}</td>
                            <td>₹{p.amount.toLocaleString('en-IN')}</td>
                            <td>₹{Math.round(p.amount * 0.18).toLocaleString('en-IN')}</td>
                            <td><button className="cd-table-link" onClick={() => triggerToast(`📥 Downloading ${inv}.pdf…`)}>📄 PDF</button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
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
                  <select className="cd-form-select" value={newProjCategory} onChange={e => setNewProjCategory(e.target.value)}>
                    {serviceCategories.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="cd-form-row">
                  <label className="cd-form-label">Select Package / Pricing Tier</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 6 }}>
                    {pricingTiers.map(p => {
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
                            {p.features.slice(0, 3).map((f, i) => (
                              <li key={i} style={{ marginBottom: 3 }}>✓ {f}</li>
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
              </form>
            </div>
            <div className="cd-modal-footer">
              <button className="cd-btn-secondary" onClick={() => setNewProjectModalOpen(false)}>Cancel</button>
              <button className="cd-btn-primary" form="newProjForm" type="submit">Pay &amp; Submit Brief →</button>
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

      {/* APPROVE MODAL */}
      {approveModalOpen && activeProjectForModal && (
        <div className="cd-modal-overlay" onClick={() => setApproveModalOpen(false)}>
          <div className="cd-modal" onClick={e => e.stopPropagation()}>
            <div className="cd-modal-header">
              <h2>✅ Approve &amp; Finalize</h2>
              <button className="cd-modal-close" onClick={() => setApproveModalOpen(false)}>×</button>
            </div>
            <div className="cd-modal-body">
              <p style={{ fontSize: 13, color: '#888', marginBottom: 14 }}>Once approved, the freelancer receives payment and the project is marked Delivered. This action is <b>final</b>.</p>
              <div className="cd-checklist">
                {[{ s: ac1, set: setAc1, text: 'I have reviewed all delivered files' }, { s: ac2, set: setAc2, text: 'All revision requests have been incorporated' }, { s: ac3, set: setAc3, text: 'I am satisfied with the final quality' }].map(({ s, set, text }) => (
                  <label key={text} className="cd-check-item">
                    <input type="checkbox" checked={s} onChange={e => set(e.target.checked)} />
                    <span style={{ fontSize: 13 }}>{text}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="cd-modal-footer">
              <button className="cd-btn-secondary" onClick={() => setApproveModalOpen(false)}>Cancel</button>
              <button className="cd-btn-primary" disabled={!(ac1 && ac2 && ac3)} onClick={triggerPayoutFinalize} style={!(ac1 && ac2 && ac3) ? { opacity: 0.5, cursor: 'not-allowed' } : {}}>✅ Approve &amp; Release Payment</button>
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
    </div>
  );
}
