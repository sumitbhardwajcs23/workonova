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
  id: string; // string key (either dbId or template ID)
  dbId?: number; // actual numeric ID if from database
  title: string;
  category: 'web' | 'design' | 'video' | 'ai' | 'content';
  freelancer: string;
  status: 'In Progress' | 'In Review' | 'Delivered' | 'Cancelled' | 'Submitted';
  placedDate: string;
  estDelivery: string;
  amount: number;
  currentStep: number; // 0: Submitted, 1: In Progress, 2: In Review, 3: Delivered
  stepDates: string[];
  assets: Array<{ name: string; url: string }>;
  updates: Array<{ date: string; text: string }>;
  deliverables: {
    title: string;
    links: Array<{ name: string; url: string }>;
  };
  revisionsLeft: number;
  slaHoursRemaining?: number;
  discussion: Array<{
    sender: string;
    text: string;
    time: string;
    type: 'admin' | 'team' | 'client';
  }>;
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
  ai: [
    { label: 'Additional CRM webhook link', cost: 2000, desc: 'Sync data to HubSpot / Salesforce' }
  ],
  video: [
    { label: 'Add-on 1 Additional Edited Reel', cost: 2000, desc: '30s cuts from original footage pool' }
  ],
  design: [
    { label: '2 Extra Carousel Ad Variations', cost: 3500, desc: 'Figma layouts formatted for LinkedIn and Instagram' }
  ]
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
  { name: 'Starter Creative', price: 14999, tag: 'silver' },
  { name: 'Growth Tech & Ads', price: 34999, tag: 'gold' },
  { name: 'Enterprise Premium', price: 79999, tag: 'custom' }
];

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
    {
      id: 'n1',
      title: 'Design Deliverables Ready for Review',
      desc: 'Order #WN-2026-98 · 10 Ad Creatives are ready. Please review within 72 hours.',
      time: 'Just now',
      unread: true
    },
    {
      id: 'n2',
      title: 'Milestone Update · Web Dev',
      desc: 'Order #WN-2026-105 · "Database schema completed, Razorpay webhook being integrated."',
      time: '35 minutes ago',
      unread: true
    },
    {
      id: 'n3',
      title: 'Invoice Generated',
      desc: 'Order #WN-2026-89 · Invoice INV-2026-089 is ready for download.',
      time: '2 days ago',
      unread: false
    }
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
  
  // Modals visibility toggles
  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false);
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);
  const [addonModalOpen, setAddonModalOpen] = useState(false);
  const [threadModalOpen, setThreadModalOpen] = useState(false);
  const [newBrandModalOpen, setNewBrandModalOpen] = useState(false);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [billingModalOpen, setBillingModalOpen] = useState(false);

  // Dynamic fields inside modals
  // Intake request fields
  const [newProjCategory, setNewProjCategory] = useState(serviceCategories[0]);
  const [newProjTier, setNewProjTier] = useState('silver');
  const [newProjPrice, setNewProjPrice] = useState(14999);
  const [newProjBrief, setNewProjBrief] = useState('');
  const [newProjLink, setNewProjLink] = useState('');

  // Revision fields
  const [revWebUrl, setRevWebUrl] = useState('');
  const [revWebIssueType, setRevWebIssueType] = useState('bug');
  const [revWebDesc, setRevWebDesc] = useState('');
  const [revVidTime, setRevVidTime] = useState('');
  const [revVidDesc, setRevVidDesc] = useState('');
  const [revVidNotes, setRevVidNotes] = useState('');
  const [revDesignItem, setRevDesignItem] = useState('Ad Creative #1 (Facebook Feed)');
  const [revDesignDesc, setRevDesignDesc] = useState('');

  // Addon fields
  const [selectedAddonIndex, setSelectedAddonIndex] = useState<number | null>(null);

  // Approve checklists
  const [ac1, setAc1] = useState(false);
  const [ac2, setAc2] = useState(false);
  const [ac3, setAc3] = useState(false);

  // Chat thread inputs
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);

  // New Brand profile input fields
  const [newBrandName, setNewBrandName] = useState('');
  const [newBrandIndustry, setNewBrandIndustry] = useState('');
  const [newBrandColor, setNewBrandColor] = useState('#56c41a');
  const [newBrandFolder, setNewBrandFolder] = useState('');

  // Toast Timer Ref
  const toastTimerRef = useRef<any>(null);

  // ── TOAST TRIGGER ─────────────────────────────────────────────
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastVisible(false);
    }, 3500);
  };

  // ── KEYBOARD SHORTCUTS ────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ── FETCH ORDERS FROM DATABASE ────────────────────────────────
  const fetchOrders = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/client/orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch orders');
      
      const orders = data.data || [];
      mergeOrdersAndTemplates(orders);
    } catch (err: any) {
      triggerToast('❌ Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // ── DYNAMIC DISCUSSION POLLING ────────────────────────────────
  useEffect(() => {
    let interval: any;
    if (threadModalOpen && activeProjectForModal && activeProjectForModal.dbId) {
      fetchChatMessages(activeProjectForModal.dbId);
      interval = setInterval(() => fetchChatMessages(activeProjectForModal.dbId!), 4000);
    }
    return () => clearInterval(interval);
  }, [threadModalOpen, activeProjectForModal]);

  // Scroll to bottom of chat
  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // ── INTEGRATE DATABASE ORDERS AND VISUAL TEMPLATES ────────────
  const mergeOrdersAndTemplates = (orders: Order[]) => {
    // Standard mock templates to populate the UI (so all features are inspectable)
    const initialMockProjects: Project[] = [
      {
        id: 'WN-2026-98',
        title: '10 Social Ad Creatives & Display Banners',
        category: 'design',
        freelancer: 'Priya Mehta',
        status: 'In Review',
        placedDate: 'Aug 10, 2026',
        estDelivery: 'Aug 16, 2026',
        amount: 12000,
        currentStep: 2,
        stepDates: ['Aug 10', 'Aug 12', 'Aug 16 · Under Review', 'Aug 17'],
        assets: [
          { name: 'Figma Workspace', url: 'https://figma.com' },
          { name: 'Ad_Copy_Brief.docx', url: '#' }
        ],
        updates: [
          { date: 'Aug 16', text: 'Delivered initial drafts for review' },
          { date: 'Aug 13', text: 'Approved custom graphics assets' }
        ],
        deliverables: {
          title: 'High-Res PNGs & Figma Files Ready for Inspection',
          links: [
            { name: '🖼️ Download High-Res PNGs', url: 'https://drive.google.com' },
            { name: '🎨 Open Figma Draft ↗', url: 'https://figma.com' }
          ]
        },
        revisionsLeft: 1,
        slaHoursRemaining: 72,
        discussion: [
          { sender: 'Priya Mehta', text: 'Hi Rohit, I have completed all 10 creatives. Let me know if you need any adjustments!', time: 'Aug 16 · 11:00 AM', type: 'team' }
        ]
      },
      {
        id: 'WN-2026-89',
        title: 'Short-Form Reels Post-Production Bundle',
        category: 'video',
        freelancer: 'Alex Sharma',
        status: 'Delivered',
        placedDate: 'Jul 28, 2026',
        estDelivery: 'Aug 04, 2026',
        amount: 9999,
        currentStep: 3,
        stepDates: ['Jul 28', 'Jul 29', 'Aug 02', 'Aug 04 · Finalized'],
        assets: [
          { name: 'Footage Folder (Drive)', url: 'https://drive.google.com' }
        ],
        updates: [
          { date: 'Aug 04', text: 'Client approved deliverables, payment released.' }
        ],
        deliverables: {
          title: 'Approved finals delivery',
          links: [
            { name: '🎥 Download Final Reels', url: 'https://drive.google.com' }
          ]
        },
        revisionsLeft: 0,
        discussion: []
      }
    ];

    // Map database orders
    const mappedDbProjects: Project[] = orders.map((o) => {
      // Map category
      let category: 'web' | 'design' | 'video' | 'ai' | 'content' = 'web';
      const cat = o.serviceCategory.toLowerCase();
      if (cat.includes('design') || cat.includes('logo') || cat.includes('brand') || cat.includes('graphic')) {
        category = 'design';
      } else if (cat.includes('video') || cat.includes('edit') || cat.includes('motion') || cat.includes('vfx') || cat.includes('anim')) {
        category = 'video';
      } else if (cat.includes('ai') || cat.includes('automation') || cat.includes('chatbot')) {
        category = 'ai';
      } else if (cat.includes('content') || cat.includes('marketing') || cat.includes('copy')) {
        category = 'content';
      }

      // Map status & stepper steps
      let status: 'Submitted' | 'In Progress' | 'In Review' | 'Delivered' | 'Cancelled' = 'In Progress';
      let currentStep = 1;
      if (o.status === 'pending_payment') {
        status = 'Submitted';
        currentStep = 0;
      } else if (o.status === 'paid' || o.status === 'assigned') {
        status = 'In Progress';
        currentStep = 1;
      } else if (o.status === 'submitted' || o.status === 'qa_approved') {
        status = 'In Review';
        currentStep = 2;
      } else if (o.status === 'delivered') {
        status = 'Delivered';
        currentStep = 3;
      } else if (o.status === 'cancelled') {
        status = 'Cancelled';
        currentStep = 0;
      }

      // Format times
      const createdDate = new Date(o.createdAt || Date.now());
      const estDate = new Date(createdDate.getTime() + 4 * 24 * 60 * 60 * 1000);
      const formattedCreated = createdDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
      const formattedEst = estDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });

      // Deliverable downloads
      const deliverableLinks = [];
      if (o.qaApprovedLink) {
        deliverableLinks.push({ name: '🖼️ Download QA Assets', url: o.qaApprovedLink });
      }

      const updates = [
        { date: createdDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }), text: 'Intake brief successfully submitted.' }
      ];

      if (o.adminRevisionComments) {
        updates.unshift({
          date: new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
          text: `Revision requested: "${o.adminRevisionComments}"`
        });
      }

      return {
        id: `db-${o.id}`,
        dbId: o.id,
        title: `${o.serviceCategory} - Intake Setup`,
        category,
        freelancer: o.status === 'pending_payment' ? 'Not Assigned' : 'Workonova Specialist',
        status,
        placedDate: formattedCreated,
        estDelivery: formattedEst,
        amount: o.price,
        currentStep,
        stepDates: [
          createdDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
          o.status !== 'pending_payment' ? 'In Progress' : 'Pending Intake',
          (o.status === 'submitted' || o.status === 'qa_approved' || o.status === 'delivered') ? 'Under Review' : 'Est. ' + formattedEst,
          o.status === 'delivered' ? 'Finalized' : 'Handoff'
        ],
        assets: [
          { name: 'Project Brief Link', url: o.submissionLink || '#' }
        ],
        updates,
        deliverables: {
          title: o.qaApprovedLink ? 'QA approved finals are ready' : 'Final assets in QA validation pipeline',
          links: deliverableLinks
        },
        revisionsLeft: 2,
        slaHoursRemaining: status === 'In Review' ? 72 : undefined,
        discussion: []
      };
    });

    // Make sure we remove mock duplicates if database already contains them
    const combined = [...mappedDbProjects, ...initialMockProjects.filter(mock => !orders.some(o => o.id === parseInt(mock.id.replace('db-', ''))))];
    setAllProjects(combined);
  };

  // ── INTAKE PROCESS & ORDER SUBMISSIONS ────────────────────────
  const handleTierChange = (tierTag: string) => {
    setNewProjTier(tierTag);
    const selected = pricingTiers.find(p => p.tag === tierTag);
    if (selected) setNewProjPrice(selected.price);
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newProjBrief || !newProjLink) {
      triggerToast('⚠️ Please provide both brief description and assets folder link.');
      return;
    }

    const drivePattern = /^(https?:\/\/)?(drive\.google\.com|dropbox\.com|.*\.dropbox\.com)\/.+$/;
    if (!drivePattern.test(newProjLink)) {
      triggerToast('⚠️ Link must be a valid Google Drive or Dropbox URL.');
      return;
    }

    try {
      // Step 1: Create Order
      const res1 = await fetch(`${API_BASE}/api/client/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          serviceCategory: newProjCategory,
          tier: newProjTier,
          price: newProjPrice,
          description: newProjBrief
        })
      });
      const data1 = await res1.json();
      if (!res1.ok) throw new Error(data1.error || 'Failed to initialize order');

      const createdOrder = data1.data;

      // Step 2: Submit Intake Brief
      const res2 = await fetch(`${API_BASE}/api/client/orders/${createdOrder.id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          description: newProjBrief,
          submissionLink: newProjLink
        })
      });
      const data2 = await res2.json();
      if (!res2.ok) throw new Error(data2.error || 'Failed to submit details');

      triggerToast('🎉 Project order placed and briefly submitted successfully!');
      setNewProjBrief('');
      setNewProjLink('');
      setNewProjectModalOpen(false);
      fetchOrders();
    } catch (err: any) {
      triggerToast('❌ ' + err.message);
    }
  };

  // ── SUPPORT DISCUSSION CHAT LOGS ──────────────────────────────
  const fetchChatMessages = async (orderId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/client/orders/${orderId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setChatMessages(data.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendChatMessage = async (e: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const textToSend = customText || newMessageText.trim();
    if (!textToSend || !activeProjectForModal || !activeProjectForModal.dbId) return;

    try {
      const res = await fetch(`${API_BASE}/api/client/orders/${activeProjectForModal.dbId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ messageText: textToSend })
      });
      if (res.ok) {
        if (!customText) setNewMessageText('');
        fetchChatMessages(activeProjectForModal.dbId);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ── TESTIMONIALS / FEEDBACK ──────────────────────────────────
  const [testimonialQuote, setTestimonialQuote] = useState('');
  const [testimonialStars, setTestimonialStars] = useState(5);

  const handleTestimonialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testimonialQuote) return;

    try {
      const res = await fetch(`${API_BASE}/api/client/testimonials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ quote: testimonialQuote, stars: testimonialStars })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Testimonial failed to submit');

      triggerToast('✅ Testimonial submitted to admin approval queue!');
      setTestimonialQuote('');
    } catch (err: any) {
      triggerToast('❌ ' + err.message);
    }
  };

  // ── SUPPORT REQUEST TICKET ────────────────────────────────────
  const handleSupportTicketSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportMessage) return;
    
    // Simulate support ticket opening
    triggerToast('📩 Support ticket opened successfully! Priya Mehta will reply within 4 hours.');
    setSupportMessage('');
  };

  // ── REVISIONS LOGS & PAYOUT SUBMISSIONS ────────────────────────
  const triggerRevisionRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProjectForModal) return;

    let details = '';
    if (activeProjectForModal.category === 'web') {
      details = `Bug / UI Fix on page (${revWebUrl}): ${revWebDesc}`;
    } else if (activeProjectForModal.category === 'video') {
      details = `Cut adjust at timecode ${revVidTime}: ${revVidDesc}. Notes: ${revVidNotes}`;
    } else {
      details = `Design modification for ${revDesignItem}: ${revDesignDesc}`;
    }

    // Client-side simulate
    setAllProjects(prev => prev.map(p => {
      if (p.id === activeProjectForModal.id) {
        return {
          ...p,
          status: 'In Progress',
          currentStep: 1,
          slaHoursRemaining: undefined,
          revisionsLeft: p.revisionsLeft - 1,
          updates: [
            { date: 'Today', text: `Revision requested: "${details.slice(0, 50)}..."` },
            ...p.updates
          ]
        };
      }
      return p;
    }));

    // Send support chat message relay so database captures this activity
    if (activeProjectForModal.dbId) {
      handleSendChatMessage(e, `🔄 [SYSTEM RELAY] Client requested a revision round: "${details}"`);
    }

    setRevisionModalOpen(false);
    triggerToast('🔄 Revision details sent to developer! Project returned to In Progress.');
  };

  const triggerPayoutFinalize = () => {
    if (!activeProjectForModal) return;

    setAllProjects(prev => prev.map(p => {
      if (p.id === activeProjectForModal.id) {
        return {
          ...p,
          status: 'Delivered',
          currentStep: 3,
          slaHoursRemaining: undefined,
          updates: [
            { date: 'Today', text: 'Project finalized and payout released!' },
            ...p.updates
          ]
        };
      }
      return p;
    }));

    // Send support chat message relay
    if (activeProjectForModal.dbId) {
      handleSendChatMessage(null as any, '✅ [SYSTEM RELAY] Client approved files and finalized payout. Releasing funds.');
    }

    setApproveModalOpen(false);
    triggerToast('✅ Project marked complete! Freelancer payment successfully released.');
  };

  const triggerAddonPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProjectForModal || selectedAddonIndex === null) return;

    const catalog = ADDON_CATALOG[activeProjectForModal.category] || [];
    const item = catalog[selectedAddonIndex];
    if (!item) return;

    setAllProjects(prev => prev.map(p => {
      if (p.id === activeProjectForModal.id) {
        return {
          ...p,
          amount: p.amount + item.cost,
          updates: [
            { date: 'Today', text: `Add-on purchased: "${item.label}" (+₹${item.cost})` },
            ...p.updates
          ]
        };
      }
      return p;
    }));

    // Send support chat message relay
    if (activeProjectForModal.dbId) {
      handleSendChatMessage(e, `➕ [SYSTEM RELAY] Client purchased Scope Add-on: "${item.label}" (+₹${item.cost})`);
    }

    setAddonModalOpen(false);
    triggerToast(`💳 Scope add-on "${item.label}" purchased successfully!`);
  };

  // ── BRAND PROFILE SETUP ───────────────────────────────────────
  const handleCreateBrand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandName) return;

    const key = newBrandName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const newProfile: BrandProfile = {
      name: newBrandName,
      logo: '🖼️ Logo_Draft_Vault.png',
      colors: [newBrandColor, '#222222', '#f9f9f9'],
      font: 'Inter / Outfit',
      driveLink: newBrandFolder || 'https://drive.google.com',
      briefs: []
    };

    setBrandProfiles(prev => ({
      ...prev,
      [key]: newProfile
    }));

    setSelectedBrandKey(key);
    setNewBrandModalOpen(false);
    setNewBrandName('');
    setNewBrandFolder('');
    triggerToast('📁 New brand profile added successfully!');
  };

  // ── BILLING SETUP ─────────────────────────────────────────────
  const handleBillingSave = (e: React.FormEvent) => {
    e.preventDefault();
    setBillingModalOpen(false);
    triggerToast('✅ Billing settings saved successfully!');
  };

  // ── HELPERS & COUNTS ──────────────────────────────────────────
  const liveCount = allProjects.filter(p => p.status === 'In Progress' || p.status === 'In Review').length;
  const actionCount = allProjects.filter(p => p.status === 'In Review').length;
  const totalSpent = allProjects.filter(p => p.status !== 'Cancelled').reduce((sum, p) => sum + p.amount, 0);

  const initials = getInitials(user?.name || 'Rohit Sharma');

  function getInitials(nameString: string) {
    const parts = nameString.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }

  // Filter project cards according to active view & search query
  const filteredProjects = allProjects.filter(p => {
    // View filtering
    if (currentView === 'live') {
      if (p.status !== 'In Progress' && p.status !== 'In Review') return false;
    } else if (currentView === 'action-required') {
      if (p.status !== 'In Review') return false;
    } else if (currentView.startsWith('cat-')) {
      const catFilter = currentView.replace('cat-', '');
      if (p.category !== catFilter) return false;
    }

    // Search query filtering
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchTitle = p.title.toLowerCase().includes(query);
      const matchFreelancer = p.freelancer.toLowerCase().includes(query);
      const matchId = p.id.toLowerCase().includes(query);
      return matchTitle || matchFreelancer || matchId;
    }

    return true;
  });

  return (
    <div className="client-dashboard-root">
      <WelcomePopup role="client" />
      
      {/* ═══════════════════════════════════════════════════════════
           TOP NAVBAR
      ═══════════════════════════════════════════════════════════ */}
      <header className="topnav" id="topnav">
        <div className="topnav-left">
          <button 
            className="mobile-burger" 
            id="mobileBurger" 
            aria-label="Menu"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <span></span>
            <span style={{ margin: '4px 0' }}></span>
            <span></span>
          </button>
          <a className="brand" href="/">
            <img src="/assets/workonova-logo.webp" alt="WORKONOVA" />
          </a>
        </div>

        <div className="topnav-center">
          <div className="global-search" id="globalSearch">
            <span className="search-icon">⌕</span>
            <input 
              ref={searchInputRef}
              type="search" 
              id="searchInput" 
              placeholder="Search Projects, Orders, Invoices… (Ctrl+K)" 
              autoComplete="off"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <kbd>Ctrl K</kbd>
          </div>
        </div>

        <div className="topnav-right">
          <button 
            className="notif-btn" 
            id="notifBtn" 
            aria-label="Notifications"
            onClick={() => {
              setNotifPanelOpen(!notifPanelOpen);
              setProfileDropdownOpen(false);
              // Auto-clear notification badge after opening panel
              setTimeout(() => {
                setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
              }, 1800);
            }}
          >
            🔔
            {notifications.some(n => n.unread) && (
              <span className="notif-badge" id="notifBadge">
                {notifications.filter(n => n.unread).length}
              </span>
            )}
          </button>

          <button className="vault-nav-btn" id="vaultNavBtn" onClick={() => setCurrentView('brand-vault')}>
            📁 Brand Vault
          </button>

          <div className="profile-wrap" id="profileWrap">
            <button 
              className="profile-trigger" 
              id="profileTrigger"
              onClick={() => {
                setProfileDropdownOpen(!profileDropdownOpen);
                setNotifPanelOpen(false);
              }}
            >
              <span className="av">{initials}</span>
              <div className="profile-meta">
                <b>{user?.name || 'Rohit Sharma'}</b>
                <small>NorthStar Agency · Gold Client</small>
              </div>
              <span className="chevron">▾</span>
            </button>
            
            <div className={`profile-dropdown ${profileDropdownOpen ? 'open' : ''}`} id="profileDropdown">
              <div className="dd-header">
                <span className="av lg">{initials}</span>
                <div>
                  <b>{user?.name || 'Rohit Sharma'}</b>
                  <small>{user?.email || 'rohit@northstar.in'}</small>
                </div>
              </div>
              <hr className="dd-hr" />
              <button 
                className="dd-item" 
                id="ddBilling"
                onClick={() => {
                  setProfileDropdownOpen(false);
                  setBillingModalOpen(true);
                }}
              >
                🧾 Billing & GST Settings
              </button>
              <button 
                className="dd-item" 
                id="ddNotifSettings"
                onClick={() => {
                  setProfileDropdownOpen(false);
                  triggerToast('🔔 Notification preferences updated!');
                }}
              >
                🔔 Notification Preferences
              </button>
              <hr className="dd-hr" />
              <button className="dd-item" onClick={logout}>↪ Logout</button>
            </div>
          </div>
        </div>
      </header>

      {/* Notification Panel Overlay */}
      {notifPanelOpen && (
        <>
          <div className="notif-panel open" id="notifPanel">
            <div className="notif-hdr">
              <h3>Notifications</h3>
              <button id="notifClose" onClick={() => setNotifPanelOpen(false)}>×</button>
            </div>
            <div className="notif-list">
              {notifications.map(n => (
                <div key={n.id} className={`notif-item ${n.unread ? 'unread' : ''}`}>
                  <span className={`notif-dot ${!n.unread ? 'read' : ''}`}></span>
                  <div>
                    <b>{n.title}</b>
                    <p>{n.desc}</p>
                    <time>{n.time}</time>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="notif-backdrop open" id="notifBackdrop" onClick={() => setNotifPanelOpen(false)}></div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════
           SHELL: Sidebar + Workspace
      ═══════════════════════════════════════════════════════════ */}
      <div className="shell" id="shell">

        {/* ── LEFT SIDEBAR ──────────────────────────────────────── */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} id="sidebar">
          <nav className="sidebar-nav">
            <p className="nav-label">MAIN WORKSPACE</p>
            
            <button 
              className={`nav-item ${currentView === 'overview' ? 'active' : ''}`}
              onClick={() => { setCurrentView('overview'); setSidebarOpen(false); }}
            >
              <span className="nav-icon">📊</span><span>Dashboard Overview</span>
            </button>
            
            <button 
              className={`nav-item ${currentView === 'live' ? 'active' : ''}`}
              onClick={() => { setCurrentView('live'); setSidebarOpen(false); }}
            >
              <span className="nav-icon">⚡</span><span>Live Projects</span>
              <b className="nav-badge live-badge">{liveCount}</b>
            </button>
            
            <button 
              className={`nav-item ${currentView === 'all-projects' ? 'active' : ''}`}
              onClick={() => { setCurrentView('all-projects'); setSidebarOpen(false); }}
            >
              <span className="nav-icon">📂</span><span>All My Projects</span>
              <b className="nav-badge">{allProjects.length}</b>
            </button>
            
            <button 
              className={`nav-item ${currentView === 'action-required' ? 'active' : ''}`}
              onClick={() => { setCurrentView('action-required'); setSidebarOpen(false); }}
            >
              <span className="nav-icon">⚠️</span><span>Action Required</span>
              {actionCount > 0 && <b className="nav-badge urgent">{actionCount}</b>}
            </button>

            <p className="nav-label" style={{ marginTop: '18px' }}>FILTER BY SERVICE</p>

            <button 
              className={`nav-item cat-item ${currentView === 'cat-video' ? 'active' : ''}`}
              onClick={() => { setCurrentView('cat-video'); setSidebarOpen(false); }}
            >
              <span className="nav-icon">🎬</span><span>Video & Motion</span>
            </button>
            <div className={`nav-sub ${currentView === 'cat-video' ? 'open' : ''}`} id="sub-video">
              <span>Short-Form Reels / Shorts</span>
              <span>YouTube Long-Form</span>
              <span>2D/3D Motion Graphics</span>
            </div>

            <button 
              className={`nav-item cat-item ${currentView === 'cat-design' ? 'active' : ''}`}
              onClick={() => { setCurrentView('cat-design'); setSidebarOpen(false); }}
            >
              <span className="nav-icon">🎨</span><span>Graphic & Brand Design</span>
            </button>
            <div className={`nav-sub ${currentView === 'cat-design' ? 'open' : ''}`} id="sub-design">
              <span>UI/UX Design (Figma)</span>
              <span>Graphic Design & Ads</span>
              <span>Brand Identity & Logos</span>
            </div>

            <button 
              className={`nav-item cat-item ${currentView === 'cat-web' ? 'active' : ''}`}
              onClick={() => { setCurrentView('cat-web'); setSidebarOpen(false); }}
            >
              <span className="nav-icon">🌐</span><span>Web & Software Dev</span>
            </button>
            <div className={`nav-sub ${currentView === 'cat-web' ? 'open' : ''}`} id="sub-web">
              <span>Web Development</span>
              <span>E-Commerce & Custom CMS</span>
            </div>

            <button 
              className={`nav-item cat-item ${currentView === 'cat-ai' ? 'active' : ''}`}
              onClick={() => { setCurrentView('cat-ai'); setSidebarOpen(false); }}
            >
              <span className="nav-icon">⚡</span><span>AI & Automation</span>
            </button>
            <div className={`nav-sub ${currentView === 'cat-ai' ? 'open' : ''}`} id="sub-ai">
              <span>AI Agents & Chatbots</span>
              <span>Workflow Automation</span>
            </div>

            <button 
              className={`nav-item cat-item ${currentView === 'cat-content' ? 'active' : ''}`}
              onClick={() => { setCurrentView('cat-content'); setSidebarOpen(false); }}
            >
              <span className="nav-icon">✍️</span><span>Content & Marketing</span>
            </button>

            <p className="nav-label" style={{ marginTop: '18px' }}>ASSETS & BILLING</p>
            
            <button 
              className={`nav-item ${currentView === 'brand-vault' ? 'active' : ''}`}
              onClick={() => { setCurrentView('brand-vault'); setSidebarOpen(false); }}
            >
              <span className="nav-icon">📁</span><span>My Brand Vault</span>
            </button>
            
            <button 
              className={`nav-item ${currentView === 'invoices' ? 'active' : ''}`}
              onClick={() => { setCurrentView('invoices'); setSidebarOpen(false); }}
            >
              <span className="nav-icon">📄</span><span>Invoices & GST Receipts</span>
            </button>
            
            <button 
              className={`nav-item ${currentView === 'support' ? 'active' : ''}`}
              onClick={() => { setCurrentView('support'); setSidebarOpen(false); }}
            >
              <span className="nav-icon">💬</span><span>Support & Help Desk</span>
            </button>
          </nav>
        </aside>

        {/* ── MAIN WORKSPACE ──────────────────────────────────────── */}
        <main className="workspace" id="workspace">
          {loading ? (
            <div className="view active" style={{ display: 'block', padding: '60px 20px', textAlign: 'center' }}>
              <div className="empty-state">
                <span style={{ fontSize: '40px', display: 'block', marginBottom: '14px' }}>⏳</span>
                <h2>Loading Workspace...</h2>
                <p>Please wait while we synchronize your projects and creative files.</p>
              </div>
            </div>
          ) : (
            <>

          {/* ════ OVERVIEW VIEW ════ */}
          <section className={`view ${currentView === 'overview' ? 'active' : ''}`} id="view-overview">
            <div className="view-header">
              <div>
                <p className="eyebrow">CLIENT WORKSPACE</p>
                <h1>Welcome back, {user?.name || 'Rohit'}! 👋</h1>
                <p className="view-sub">Here's your full production command centre.</p>
              </div>
              <button className="btn-primary" onClick={() => setNewProjectModalOpen(true)}>
                + Start New Project
              </button>
            </div>

            {/* KPI Cards */}
            <div className="kpi-grid">
              <div className="kpi-card" onClick={() => setCurrentView('live')}>
                <div className="kpi-icon live">⚡</div>
                <div>
                  <b>{liveCount}</b>
                  <small>Live Projects</small>
                </div>
              </div>
              <div className="kpi-card" onClick={() => setCurrentView('action-required')}>
                <div className="kpi-icon urgent">⚠️</div>
                <div>
                  <b>{actionCount}</b>
                  <small>Action Required</small>
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-icon done">✓</div>
                <div>
                  <b>{allProjects.filter(p => p.status === 'Delivered').length}</b>
                  <small>Completed Projects</small>
                </div>
              </div>
              <div className="kpi-card" onClick={() => setCurrentView('invoices')}>
                <div className="kpi-icon money">₹</div>
                <div>
                  <b>₹{totalSpent.toLocaleString('en-IN')}</b>
                  <small>Total Invested</small>
                </div>
              </div>
            </div>

            {/* Quick live cards */}
            <p className="section-title">⚡ Live Projects at a Glance</p>
            <div className="project-cards-grid">
              {filteredProjects.filter(p => p.status === 'In Progress' || p.status === 'In Review').map(p => (
                <ProjectCard 
                  key={p.id} 
                  project={p}
                  onOpenRevision={() => { setActiveProjectForModal(p); setRevisionModalOpen(true); }}
                  onOpenApprove={() => { setActiveProjectForModal(p); setApproveModalOpen(true); }}
                  onOpenAddon={() => { setActiveProjectForModal(p); setAddonModalOpen(true); }}
                  onOpenThread={() => { setActiveProjectForModal(p); setChatMessages([]); setThreadModalOpen(true); if (p.dbId) fetchChatMessages(p.dbId); }}
                  triggerToast={triggerToast}
                />
              ))}
              {allProjects.filter(p => p.status === 'In Progress' || p.status === 'In Review').length === 0 && (
                <div className="empty-state">
                  <span>⚡</span>
                  <h2>No Live Projects</h2>
                  <p>Start a new project from our creative/tech bundles catalogue.</p>
                </div>
              )}
            </div>

            {/* Recent orders mini table */}
            <p className="section-title" style={{ marginTop: '32px' }}>📋 Recent Orders</p>
            <div className="table-card">
              <table>
                <thead>
                  <tr><th>Order ID</th><th>Service</th><th>Placed Date</th><th>Amount</th><th>Status</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {allProjects.slice(0, 4).map(p => (
                    <tr key={p.id}>
                      <td><b>#{p.id.replace('db-', '')}</b></td>
                      <td>{p.title}</td>
                      <td>{p.placedDate}</td>
                      <td>₹{p.amount.toLocaleString('en-IN')}</td>
                      <td>
                        <span className={`status-pill ${p.status.toLowerCase().replace(' ', '-')}`}>
                          {p.status}
                        </span>
                      </td>
                      <td>
                        <button 
                          className="table-link" 
                          onClick={() => {
                            setActiveProjectForModal(p);
                            setChatMessages([]);
                            setThreadModalOpen(true);
                            if (p.dbId) fetchChatMessages(p.dbId);
                          }}
                        >
                          Chat & Details ↗
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ════ LIVE PROJECTS VIEW ════ */}
          <section className={`view ${currentView === 'live' ? 'active' : ''}`} id="view-live">
            <div className="view-header">
              <div>
                <p className="eyebrow">LIVE PROJECTS</p>
                <h1>Active Work in Production</h1>
              </div>
              <button className="btn-primary" onClick={() => setNewProjectModalOpen(true)}>
                + Start New Project
              </button>
            </div>
            
            <div className="project-cards-grid">
              {filteredProjects.map(p => (
                <ProjectCard 
                  key={p.id} 
                  project={p}
                  onOpenRevision={() => { setActiveProjectForModal(p); setRevisionModalOpen(true); }}
                  onOpenApprove={() => { setActiveProjectForModal(p); setApproveModalOpen(true); }}
                  onOpenAddon={() => { setActiveProjectForModal(p); setAddonModalOpen(true); }}
                  onOpenThread={() => { setActiveProjectForModal(p); setChatMessages([]); setThreadModalOpen(true); if (p.dbId) fetchChatMessages(p.dbId); }}
                  triggerToast={triggerToast}
                />
              ))}
              {filteredProjects.length === 0 && (
                <div className="empty-state">
                  <span>⚡</span>
                  <h2>No Active Projects</h2>
                  <p>You do not have any active creative design or software engineering orders currently in production.</p>
                </div>
              )}
            </div>

            <div className="new-project-cta" onClick={() => setNewProjectModalOpen(true)} style={{ cursor: 'pointer' }}>
              <span>💡 Need another service?</span>
              <button className="btn-primary">+ Start New Project</button>
            </div>
          </section>

          {/* ════ ALL PROJECTS VIEW ════ */}
          <section className={`view ${currentView === 'all-projects' ? 'active' : ''}`} id="view-all-projects">
            <div className="view-header">
              <div>
                <p className="eyebrow">ALL MY PROJECTS</p>
                <h1>Project History</h1>
              </div>
            </div>
            <div className="table-card">
              <table>
                <thead>
                  <tr><th>Order ID</th><th>Service</th><th>Placed Date</th><th>Amount</th><th>Freelancer</th><th>Status</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {filteredProjects.map(p => (
                    <tr key={p.id}>
                      <td><b>#{p.id.replace('db-', '')}</b></td>
                      <td>{p.title}</td>
                      <td>{p.placedDate}</td>
                      <td>₹{p.amount.toLocaleString('en-IN')}</td>
                      <td>{p.freelancer}</td>
                      <td>
                        <span className={`status-pill ${p.status.toLowerCase().replace(' ', '-')}`}>
                          {p.status}
                        </span>
                      </td>
                      <td>
                        <button 
                          className="table-link" 
                          onClick={() => {
                            setActiveProjectForModal(p);
                            setChatMessages([]);
                            setThreadModalOpen(true);
                            if (p.dbId) fetchChatMessages(p.dbId);
                          }}
                        >
                          Chat & Details ↗
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredProjects.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '30px' }}>
                        No projects found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* ════ ACTION REQUIRED VIEW ════ */}
          <section className={`view ${currentView === 'action-required' ? 'active' : ''}`} id="view-action-required">
            <div className="view-header">
              <div>
                <p className="eyebrow">⚠️ ACTION REQUIRED</p>
                <h1>Your Input Needed</h1>
                <p className="view-sub">These projects are waiting on you to review, approve, or provide revision requirements.</p>
              </div>
            </div>
            
            <div className="project-cards-grid">
              {filteredProjects.map(p => (
                <ProjectCard 
                  key={p.id} 
                  project={p}
                  onOpenRevision={() => { setActiveProjectForModal(p); setRevisionModalOpen(true); }}
                  onOpenApprove={() => { setActiveProjectForModal(p); setApproveModalOpen(true); }}
                  onOpenAddon={() => { setActiveProjectForModal(p); setAddonModalOpen(true); }}
                  onOpenThread={() => { setActiveProjectForModal(p); setChatMessages([]); setThreadModalOpen(true); if (p.dbId) fetchChatMessages(p.dbId); }}
                  triggerToast={triggerToast}
                />
              ))}
              {filteredProjects.length === 0 && (
                <div className="empty-state">
                  <span>✓</span>
                  <h2>All Clear!</h2>
                  <p>No actions are required from your side at the moment. All projects are in active progress.</p>
                </div>
              )}
            </div>
          </section>

          {/* ════ CATEGORY FILTER VIEWS ════ */}
          <section className={`view ${currentView.startsWith('cat-') ? 'active' : ''}`}>
            <div className="view-header">
              <div>
                <p className="eyebrow">FILTER BY SERVICE CATEGORY</p>
                <h1 style={{ textTransform: 'capitalize' }}>
                  {currentView.replace('cat-', '')} Projects
                </h1>
              </div>
            </div>

            <div className="project-cards-grid">
              {filteredProjects.map(p => (
                <ProjectCard 
                  key={p.id} 
                  project={p}
                  onOpenRevision={() => { setActiveProjectForModal(p); setRevisionModalOpen(true); }}
                  onOpenApprove={() => { setActiveProjectForModal(p); setApproveModalOpen(true); }}
                  onOpenAddon={() => { setActiveProjectForModal(p); setAddonModalOpen(true); }}
                  onOpenThread={() => { setActiveProjectForModal(p); setChatMessages([]); setThreadModalOpen(true); if (p.dbId) fetchChatMessages(p.dbId); }}
                  triggerToast={triggerToast}
                />
              ))}
              {filteredProjects.length === 0 && (
                <div className="empty-state">
                  <span>📂</span>
                  <h2>No Category Projects</h2>
                  <p>You haven't placed any bookings under this specific service filter yet.</p>
                  <button className="btn-primary" onClick={() => setNewProjectModalOpen(true)} style={{ marginTop: '16px' }}>
                    Browse catalogue & Start Project
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* ════ BRAND VAULT ════ */}
          <section className={`view ${currentView === 'brand-vault' ? 'active' : ''}`} id="view-brand-vault">
            <div className="view-header">
              <div>
                <p className="eyebrow">BRAND VAULT</p>
                <h1>📁 My Brand Assets</h1>
                <p className="view-sub">Permanent digital locker — your team never asks for logos and assets twice.</p>
              </div>
              <button className="btn-primary" onClick={() => setNewBrandModalOpen(true)}>
                + New Brand Profile
              </button>
            </div>

            {/* Brand Profile Switcher */}
            <div className="brand-profile-tabs" id="brandProfileTabs">
              {Object.keys(brandProfiles).map(key => (
                <button 
                  key={key}
                  className={`bp-tab ${selectedBrandKey === key ? 'active' : ''}`}
                  onClick={() => setSelectedBrandKey(key)}
                >
                  {brandProfiles[key].name}
                </button>
              ))}
              <button className="bp-tab" onClick={() => setNewBrandModalOpen(true)}>+ Add Brand</button>
            </div>

            {/* Brand Profile Content */}
            <div className="brand-vault-content">
              {brandProfiles[selectedBrandKey] && (
                <>
                  <div className="vault-section">
                    <h3>🎨 Brand Visual Identity</h3>
                    <div className="brand-identity-grid">
                      <div className="brand-id-item">
                        <label>Brand Logo</label>
                        <div style={{ fontWeight: 600, fontSize: '13px' }}>
                          {brandProfiles[selectedBrandKey].logo}
                        </div>
                        <button className="dl-btn" style={{ marginTop: '10px' }} onClick={() => triggerToast('📥 Downloading logo assets...')}>
                          Download
                        </button>
                      </div>
                      <div className="brand-id-item">
                        <label>Color Palette</label>
                        <div className="color-swatch-row" style={{ justifyContent: 'center' }}>
                          {brandProfiles[selectedBrandKey].colors.map(c => (
                            <div className="swatch-item" key={c}>
                              <span className="swatch" style={{ background: c }}></span>
                              <span style={{ fontSize: '10px', fontFamily: 'monospace' }}>{c}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="brand-id-item">
                        <label>Brand Typography</label>
                        <div className="font-preview" style={{ fontFamily: brandProfiles[selectedBrandKey].font.split('/')[0].trim() }}>Aa</div>
                        <div className="font-name">{brandProfiles[selectedBrandKey].font}</div>
                      </div>
                    </div>
                  </div>

                  <div className="vault-section">
                    <h3>📁 Shared Briefs & Identity Documents</h3>
                    <div className="vault-files">
                      {brandProfiles[selectedBrandKey].briefs.map(b => (
                        <div className="vault-file" key={b} onClick={() => triggerToast('📂 Opening file brief...')}>
                          📄 {b}
                        </div>
                      ))}
                      <button className="vault-file-add" onClick={() => triggerToast('📎 Attach file input popup...')}>
                        ➕ Add Document
                      </button>
                    </div>
                  </div>

                  <div className="vault-section">
                    <h3>🔗 Linked Master Cloud Folder</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                      <a className="asset-btn" href={brandProfiles[selectedBrandKey].driveLink} target="_blank" rel="noopener noreferrer">
                        📁 View Google Drive Folder ↗
                      </a>
                      <button className="btn-ghost" onClick={() => triggerToast('🔗 Drive configuration updated')}>
                        Change Link
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* ════ INVOICES ════ */}
          <section className={`view ${currentView === 'invoices' ? 'active' : ''}`} id="view-invoices">
            <div className="view-header">
              <div>
                <p className="eyebrow">BILLING & FINANCE</p>
                <h1>📄 Invoices & GST Receipts</h1>
              </div>
            </div>
            
            <div className="billing-summary">
              <div className="bs-card">
                <small>Total Spent</small>
                <strong>₹{totalSpent.toLocaleString('en-IN')}</strong>
                <span>Across {allProjects.length} projects</span>
              </div>
              <div className="bs-card">
                <small>Pending Payment</small>
                <strong>₹0</strong>
                <span>All settlements cleared</span>
              </div>
              <div className="bs-card">
                <small>GST Claimable (18%)</small>
                <strong>₹{Math.round(totalSpent * 0.18).toLocaleString('en-IN')}</strong>
                <span>Claimable ITR credit</span>
              </div>
            </div>
            
            <div className="table-card">
              <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Invoice History</h2>
              <table>
                <thead>
                  <tr><th>Invoice #</th><th>Order</th><th>Date</th><th>Amount</th><th>GST</th><th>Download</th></tr>
                </thead>
                <tbody>
                  {allProjects.map((p, index) => {
                    const invoiceNum = `INV-2026-${100 + index}`;
                    return (
                      <tr key={p.id}>
                        <td>{invoiceNum}</td>
                        <td>#{p.id.replace('db-', '')}</td>
                        <td>{p.placedDate}</td>
                        <td>₹{p.amount.toLocaleString('en-IN')}</td>
                        <td>₹{Math.round(p.amount * 0.18).toLocaleString('en-IN')}</td>
                        <td>
                          <button className="dl-btn" onClick={() => triggerToast(`📥 Downloading ${invoiceNum}.pdf...`)}>
                            📄 PDF
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* ════ SUPPORT ════ */}
          <section className={`view ${currentView === 'support' ? 'active' : ''}`} id="view-support">
            <div className="view-header">
              <div>
                <p className="eyebrow">HELP DESK</p>
                <h1>💬 Support & Help Desk</h1>
                <p className="view-sub">Our dedicated account manager responds in under 4 hours on business days.</p>
              </div>
            </div>
            
            <div className="support-layout">
              <div className="support-form-card">
                <h2>Open a Support Ticket</h2>
                <form onSubmit={handleSupportTicketSubmit}>
                  <label>Subject
                    <select value={supportSubject} onChange={e => setSupportSubject(e.target.value)}>
                      <option>Project-related question</option>
                      <option>Billing / Invoice issue</option>
                      <option>Revision or quality concern</option>
                      <option>Technical issue with portal</option>
                      <option>Other</option>
                    </select>
                  </label>
                  
                  <label>Related Order (optional)
                    <select value={supportOrderId} onChange={e => setSupportOrderId(e.target.value)}>
                      <option value="">— Select order —</option>
                      {allProjects.map(p => (
                        <option key={p.id} value={p.id}>#{p.id.replace('db-', '')} · {p.title}</option>
                      ))}
                    </select>
                  </label>
                  
                  <label>Message
                    <textarea 
                      required 
                      placeholder="Describe your issue or question in detail…" 
                      rows={5}
                      value={supportMessage}
                      onChange={e => setSupportMessage(e.target.value)}
                    ></textarea>
                  </label>
                  <button type="submit" className="btn-primary" style={{ width: '100%' }}>
                    Send to Support Team →
                  </button>
                </form>
              </div>
              
              <div className="support-info">
                <div className="support-info-card">
                  <span>⏱</span>
                  <div><b>Response Time</b><small>Under 4 hours (business days)</small></div>
                </div>
                <div className="support-info-card">
                  <span>📞</span>
                  <div><b>Dedicated Manager</b><small>Priya Mehta · priya@workonova.com</small></div>
                </div>
                <div className="support-info-card">
                  <span>🕐</span>
                  <div><b>Working Hours</b><small>Mon–Sat · 9 AM – 9 PM IST</small></div>
                </div>
              </div>
            </div>

            {/* Testimonial / Feedback Submission */}
            <div className="support-layout" style={{ marginTop: '28px' }}>
              <div className="support-form-card" style={{ gridColumn: 'span 2' }}>
                <h2>Share Your Feedback</h2>
                <p className="modal-sub">Submit your reviews, suggestions, or testimonial quotes for approved projects.</p>
                <form onSubmit={handleTestimonialSubmit}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '14px' }}>
                    <label>Rating
                      <select value={testimonialStars} onChange={e => setTestimonialStars(Number(e.target.value))}>
                        <option value={5}>⭐⭐⭐⭐⭐ (5/5)</option>
                        <option value={4}>⭐⭐⭐⭐ (4/5)</option>
                        <option value={3}>⭐⭐⭐ (3/5)</option>
                        <option value={2}>⭐⭐ (2/5)</option>
                        <option value={1}>⭐ (1/5)</option>
                      </select>
                    </label>
                    <label>Review Quote
                      <input 
                        type="text" 
                        required 
                        placeholder="e.g. Workonova streamlined our brand deliverables! Under 48 hours." 
                        value={testimonialQuote}
                        onChange={e => setTestimonialQuote(e.target.value)}
                      />
                    </label>
                  </div>
                  <button type="submit" className="btn-ghost" style={{ justifySelf: 'end' }}>
                    Submit Testimonial
                  </button>
                </form>
              </div>
            </div>
          </section>

            </>
          )}
        </main>
      </div>

      {/* ═══════════════════════════════════════════════════════════
           FOOTER
      ═══════════════════════════════════════════════════════════ */}
      <footer className="app-footer">
        <div>WORKONOVA Client Portal v2.0 · 🛡️ 100% Encrypted & Zero-EXE Security</div>
        <div>24/7 Dedicated Account Manager · <button className="footer-link" onClick={() => setCurrentView('support')}>Open Support ↗</button></div>
      </footer>

      {/* ═══════════════════════════════════════════════════════════
           MODALS (React Overlays)
      ═══════════════════════════════════════════════════════════ */}

      {/* ── START NEW PROJECT MODAL ── */}
      {newProjectModalOpen && (
        <div className="custom-modal-backdrop" onClick={() => setNewProjectModalOpen(false)}>
          <div className="custom-modal-window" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setNewProjectModalOpen(false)}>×</button>
            <p className="eyebrow">✦ START NEW REQUEST</p>
            <h2>Configure Order Details</h2>
            <p className="modal-sub">Create your brand request brief, select tiers, and submit files links.</p>
            
            <form onSubmit={handleCreateOrder}>
              <label>Service Category
                <select value={newProjCategory} onChange={e => setNewProjCategory(e.target.value)}>
                  {serviceCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>

              <label>Select Pricing Tier
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '4px' }}>
                  {pricingTiers.map(p => (
                    <button
                      key={p.tag}
                      type="button"
                      style={{
                        padding: '12px 8px',
                        borderRadius: 'var(--r8)',
                        border: newProjTier === p.tag ? '2px solid var(--lime)' : '1px solid var(--line)',
                        background: newProjTier === p.tag ? 'var(--lime-pale)' : 'var(--surface)',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                      onClick={() => handleTierChange(p.tag)}
                    >
                      <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{p.name}</div>
                      <div style={{ fontSize: '13px', marginTop: '3px' }}>₹{p.price.toLocaleString()}</div>
                    </button>
                  ))}
                </div>
              </label>

              <label>Project Brief Description
                <textarea
                  required
                  rows={4}
                  placeholder="Detail your requirements, colors, references, and expectations..."
                  value={newProjBrief}
                  onChange={e => setNewProjBrief(e.target.value)}
                />
              </label>

              <label>Google Drive or Dropbox Share Link
                <input 
                  type="url"
                  required
                  placeholder="https://drive.google.com/drive/folders/..."
                  value={newProjLink}
                  onChange={e => setNewProjLink(e.target.value)}
                />
                <small style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '3px' }}>
                  Link must contain brand templates & visual elements.
                </small>
              </label>

              <div className="modal-actions" style={{ marginTop: '10px' }}>
                <button type="button" className="btn-ghost" onClick={() => setNewProjectModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Pay & Submit Brief →</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DYNAMIC REVISION MODAL ── */}
      {revisionModalOpen && activeProjectForModal && (
        <div className="custom-modal-backdrop" onClick={() => setRevisionModalOpen(false)}>
          <div className="custom-modal-window" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setRevisionModalOpen(false)}>×</button>
            <p className="eyebrow">🔄 REQUEST REVISION</p>
            <h2>Request Revision for #{activeProjectForModal.id.replace('db-', '')}</h2>
            <p className="modal-sub">
              Your modifications will be sent directly to {activeProjectForModal.freelancer}. 
              You have {activeProjectForModal.revisionsLeft} revisions remaining.
            </p>
            
            <form onSubmit={triggerRevisionRequest}>
              <div className="revision-field-group">
                {activeProjectForModal.category === 'web' && (
                  <>
                    <label>URL / Page with Issue
                      <input 
                        type="url" 
                        required 
                        placeholder="e.g. https://staging.workonova.com/checkout"
                        value={revWebUrl}
                        onChange={e => setRevWebUrl(e.target.value)}
                      />
                    </label>
                    <label>Issue Type
                      <div className="issue-type-grid">
                        <label className={`issue-chip ${revWebIssueType === 'bug' ? 'selected' : ''}`} onClick={() => setRevWebIssueType('bug')}>
                          <span>🐛 Bug / Error</span>
                        </label>
                        <label className={`issue-chip ${revWebIssueType === 'ui' ? 'selected' : ''}`} onClick={() => setRevWebIssueType('ui')}>
                          <span>🎨 UI / Visual Glitch</span>
                        </label>
                      </div>
                    </label>
                    <label>Describe the change/fix needed
                      <textarea 
                        required 
                        placeholder="Explain in detail what needs to be fixed…"
                        value={revWebDesc}
                        onChange={e => setRevWebDesc(e.target.value)}
                      />
                    </label>
                  </>
                )}

                {activeProjectForModal.category === 'video' && (
                  <>
                    <div className="timecode-row">
                      <label>Timecode (MM:SS)
                        <input 
                          type="text" 
                          required 
                          placeholder="e.g. 0:15"
                          value={revVidTime}
                          onChange={e => setRevVidTime(e.target.value)}
                        />
                      </label>
                      <label>Change Needed
                        <input 
                          type="text" 
                          required 
                          placeholder="e.g. Cut video / change caption overlays"
                          value={revVidDesc}
                          onChange={e => setRevVidDesc(e.target.value)}
                        />
                      </label>
                    </div>
                    <label>Details / Reference Links
                      <textarea 
                        placeholder="Any additional instructions or references..."
                        value={revVidNotes}
                        onChange={e => setRevVidNotes(e.target.value)}
                      />
                    </label>
                  </>
                )}

                {activeProjectForModal.category !== 'web' && activeProjectForModal.category !== 'video' && (
                  <>
                    <label>Select Item / Asset
                      <select value={revDesignItem} onChange={e => setRevDesignItem(e.target.value)}>
                        <option>Ad Creative #1 (Facebook Feed)</option>
                        <option>Ad Creative #2 (Instagram Reel)</option>
                        <option>Banner Ads (1200x628)</option>
                      </select>
                    </label>
                    <label>Revision Details
                      <textarea 
                        required 
                        placeholder="E.g. Change the main headline font size, move logo to bottom-right…"
                        value={revDesignDesc}
                        onChange={e => setRevDesignDesc(e.target.value)}
                      />
                    </label>
                  </>
                )}

                <label>Upload Reference Screenshot (Optional)
                  <div className="upload-zone" onClick={() => triggerToast('📎 Reference file attached')}>
                    <p>📸 Drag & drop files or click to upload</p>
                  </div>
                </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setRevisionModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Send Revision Request 🔄</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── SCOPE ADD-ON MODAL ── */}
      {addonModalOpen && activeProjectForModal && (
        <div className="custom-modal-backdrop" onClick={() => setAddonModalOpen(false)}>
          <div className="custom-modal-window" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setAddonModalOpen(false)}>×</button>
            <p className="eyebrow">➕ SCOPE ADD-ON REQUEST</p>
            <h2>Add Extra Work to #{activeProjectForModal.id.replace('db-', '')}</h2>
            <p className="modal-sub">Add a small extra task to your existing project and pay instantly.</p>
            
            <form onSubmit={triggerAddonPurchase}>
              <div className="addon-options">
                {(ADDON_CATALOG[activeProjectForModal.category] || []).map((opt, i) => (
                  <label 
                    key={i}
                    className={`addon-option ${selectedAddonIndex === i ? 'selected' : ''}`}
                    onClick={() => setSelectedAddonIndex(i)}
                  >
                    <span className="addon-desc">
                      <b>{opt.label}</b>
                      <small>{opt.desc}</small>
                    </span>
                    <span className="addon-cost">₹{opt.cost.toLocaleString('en-IN')}</span>
                  </label>
                ))}
                {(ADDON_CATALOG[activeProjectForModal.category] || []).length === 0 && (
                  <p style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center', margin: '20px 0' }}>
                    No active add-ons catalog available for this service category.
                  </p>
                )}
              </div>

              <label>Or describe custom requirements
                <textarea placeholder="e.g. Add a Thank You page with email capture form…" rows={3} />
              </label>

              {selectedAddonIndex !== null && (
                <div className="addon-price-box">
                  <div className="addon-price-row">
                    <span>Add-on Price</span>
                    <b>₹{(ADDON_CATALOG[activeProjectForModal.category] || [])[selectedAddonIndex]?.cost.toLocaleString()}</b>
                  </div>
                  <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '10px' }}>
                    Pay & Add to Project →
                  </button>
                </div>
              )}

              <div className="modal-actions" style={{ marginTop: '16px' }}>
                <button type="button" className="btn-ghost" onClick={() => setAddonModalOpen(false)}>Cancel</button>
                <button 
                  type="button" 
                  className="btn-primary"
                  onClick={() => {
                    setAddonModalOpen(false);
                    triggerToast('✉️ Quote request sent to support admin.');
                  }}
                >
                  Request Quote from Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── PROJECT DISCUSSION THREAD MODAL ── */}
      {threadModalOpen && activeProjectForModal && (
        <div className="custom-modal-backdrop" onClick={() => setThreadModalOpen(false)}>
          <div className="custom-modal-window thread-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setThreadModalOpen(false)}>×</button>
            <p className="eyebrow">💬 PROJECT DISCUSSION</p>
            <h2>Clarification Discussion: #{activeProjectForModal.id.replace('db-', '')}</h2>
            <p className="modal-sub">Ask questions directly. Assigned freelancer & support admin can reply here.</p>
            
            <div className="thread-list">
              {chatMessages.length === 0 && activeProjectForModal.discussion.length === 0 ? (
                <p style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center', padding: '20px' }}>
                  No messages yet. Send a query below to start the support discussion.
                </p>
              ) : (
                <>
                  {/* Render template message files */}
                  {activeProjectForModal.discussion.map((msg, i) => (
                    <div key={`mock-${i}`} className={`thread-msg ${msg.type}`}>
                      <span className="thread-sender">{msg.sender}</span>
                      <span className="thread-text">{msg.text}</span>
                      <span className="thread-time">{msg.time}</span>
                    </div>
                  ))}
                  
                  {/* Render database live messages */}
                  {chatMessages.map(msg => {
                    const isClient = msg.senderRole === 'client';
                    const isSystem = msg.senderId === 0;
                    return (
                      <div key={msg.id} className={`thread-msg ${isClient ? 'client' : isSystem ? 'admin' : 'team'}`}>
                        <span className="thread-sender">
                          {isClient ? 'You' : isSystem ? 'SYSTEM LOG' : 'Workonova Team'}
                        </span>
                        <span className="thread-text">{msg.messageText}</span>
                        <span className="thread-time">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })}
                </>
              )}
              <div ref={chatMessagesEndRef} />
            </div>

            <form onSubmit={handleSendChatMessage}>
              <textarea 
                required 
                placeholder="Ask a question or leave a feedback instruction..." 
                rows={3}
                value={newMessageText}
                onChange={e => setNewMessageText(e.target.value)}
              />
              <div className="modal-actions" style={{ marginTop: '10px' }}>
                <button type="submit" className="btn-primary">Post Comment 💬</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ADD BRAND PROFILE MODAL ── */}
      {newBrandModalOpen && (
        <div className="custom-modal-backdrop" onClick={() => setNewBrandModalOpen(false)}>
          <div className="custom-modal-window" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setNewBrandModalOpen(false)}>×</button>
            <p className="eyebrow">📁 NEW BRAND PROFILE</p>
            <h2>Create Brand Profile</h2>
            
            <form onSubmit={handleCreateBrand}>
              <label>Brand Name
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. FitPeak, NovaSaaS…"
                  value={newBrandName}
                  onChange={e => setNewBrandName(e.target.value)}
                />
              </label>

              <label>Industry / Category
                <input 
                  type="text" 
                  placeholder="e.g. Fitness, SaaS, Fashion…"
                  value={newBrandIndustry}
                  onChange={e => setNewBrandIndustry(e.target.value)}
                />
              </label>

              <label>Primary Brand Color (Hex)
                <input 
                  type="color" 
                  value={newBrandColor}
                  onChange={e => setNewBrandColor(e.target.value)}
                  style={{ height: '40px', padding: '0px' }}
                />
              </label>

              <label>Google Drive Brand Folder URL
                <input 
                  type="url" 
                  placeholder="https://drive.google.com/drive/..."
                  value={newBrandFolder}
                  onChange={e => setNewBrandFolder(e.target.value)}
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setNewBrandModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Create Brand Profile</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── APPROVE CONFIRM MODAL ── */}
      {approveModalOpen && activeProjectForModal && (
        <div className="custom-modal-backdrop" onClick={() => setApproveModalOpen(false)}>
          <div className="custom-modal-window" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setApproveModalOpen(false)}>×</button>
            <p className="eyebrow">✅ APPROVE & FINALIZE</p>
            <h2>Confirm Final Approval</h2>
            <p className="modal-sub">Once approved, the freelancer receives their payment and the project is marked Delivered. This action is <b>final</b>.</p>
            
            <div className="approve-checklist">
              <label className="approve-check">
                <input type="checkbox" checked={ac1} onChange={e => setAc1(e.target.checked)} />
                <span>I have reviewed all delivered files</span>
              </label>
              <label className="approve-check">
                <input type="checkbox" checked={ac2} onChange={e => setAc2(e.target.checked)} />
                <span>All revision requests have been incorporated</span>
              </label>
              <label className="approve-check">
                <input type="checkbox" checked={ac3} onChange={e => setAc3(e.target.checked)} />
                <span>I am satisfied with the final quality</span>
              </label>
            </div>

            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button className="btn-ghost" onClick={() => setApproveModalOpen(false)}>Cancel</button>
              <button 
                className="btn-approve" 
                disabled={!(ac1 && ac2 && ac3)}
                onClick={triggerPayoutFinalize}
              >
                ✅ Approve & Release Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BILLING & GST MODAL ── */}
      {billingModalOpen && (
        <div className="custom-modal-backdrop" onClick={() => setBillingModalOpen(false)}>
          <div className="custom-modal-window" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setBillingModalOpen(false)}>×</button>
            <p className="eyebrow">🧾 BILLING & GST</p>
            <h2>Configure Invoice Settings</h2>
            
            <form onSubmit={handleBillingSave}>
              <label>Company Name
                <input 
                  type="text" 
                  value={billingDetails.companyName}
                  onChange={e => setBillingDetails({ ...billingDetails, companyName: e.target.value })}
                />
              </label>
              <label>GST Number
                <input 
                  type="text" 
                  value={billingDetails.gstNumber}
                  onChange={e => setBillingDetails({ ...billingDetails, gstNumber: e.target.value })}
                />
              </label>
              <label>Billing Email
                <input 
                  type="email" 
                  value={billingDetails.billingEmail}
                  onChange={e => setBillingDetails({ ...billingDetails, billingEmail: e.target.value })}
                />
              </label>
              <label>Billing Address
                <textarea 
                  rows={3}
                  value={billingDetails.billingAddress}
                  onChange={e => setBillingDetails({ ...billingDetails, billingAddress: e.target.value })}
                />
              </label>
              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setBillingModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Save Billing Info</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── TOAST NOTIFICATION ── */}
      <div className="toast" id="toast" hidden={!toastVisible}>
        <span id="toastMsg">{toastMessage}</span>
      </div>

    </div>
  );
}

// ── SUB COMPONENT: PROJECT CARD ──────────────────────────────
function ProjectCard({ 
  project, 
  onOpenRevision, 
  onOpenApprove, 
  onOpenAddon, 
  onOpenThread,
  triggerToast 
}: { 
  project: Project; 
  onOpenRevision: () => void;
  onOpenApprove: () => void;
  onOpenAddon: () => void;
  onOpenThread: () => void;
  triggerToast: (msg: string) => void;
}) {
  const stepLabels = ['Submitted', 'In Progress', 'In Review', 'Delivered'];
  
  // Render step timeline
  const renderSteps = () => {
    const steps = [];
    for (let i = 0; i < 4; i++) {
      let stateClass = '';
      let marker = '○';
      if (i < project.currentStep) {
        stateClass = 'done';
        marker = '✓';
      } else if (i === project.currentStep) {
        stateClass = 'now';
        marker = '●';
      }
      steps.push(
        <div key={i} className={`track-stage ${stateClass}`}>
          <i>{marker}</i>
          <b>{stepLabels[i]}</b>
          <small>{project.stepDates[i] || ''}</small>
        </div>
      );
      if (i < 3) {
        steps.push(
          <span 
            key={`line-${i}`} 
            className={`track-line ${i < project.currentStep ? 'done' : ''}`}
          />
        );
      }
    }
    return steps;
  };

  const percentSla = project.slaHoursRemaining ? Math.round((project.slaHoursRemaining / 72) * 100) : 0;

  return (
    <article className={`project-card card-${project.category}`}>
      <div className="pc-header">
        <div className="pc-left">
          <span className={`cat-chip ${project.category}`}>{project.category.toUpperCase()}</span>
          <span className="order-tag">ORDER #{project.id.replace('db-', '')}</span>
        </div>
        <div className="pc-right">
          <span className={`stage-chip ${project.status.toLowerCase().replace(' ', '-')}`}>{project.status}</span>
          <span className="freelancer-chip">Assigned: <b>{project.freelancer}</b></span>
        </div>
      </div>

      <h2 className="pc-title">{project.title}</h2>
      <p className="pc-meta">Placed: {project.placedDate} &nbsp;•&nbsp; Est. Delivery: <b>{project.estDelivery}</b></p>

      {/* 4-Stage Stepper Tracker */}
      <div className="tracker">{renderSteps()}</div>

      {/* SLA Countdown Progress bar */}
      {project.status === 'In Review' && project.slaHoursRemaining !== undefined && (
        <div className="sla-bar">
          <div className="sla-bar-inner">
            <div className="sla-bar-label">⏰ Review SLA (Auto-Approves in {project.slaHoursRemaining} Hours)</div>
            <div className="sla-progress-track">
              <div className="sla-progress-fill" style={{ width: `${percentSla}%` }} />
            </div>
            <div className="sla-note">Payment releases automatically if no revisions are requested within the countdown window.</div>
          </div>
          <div className="sla-timer">{String(project.slaHoursRemaining).padStart(2, '0')}:00:00</div>
        </div>
      )}

      {/* Milestones log feed */}
      <div className="milestone-log">
        <div className="milestone-log-title">⚡ Production Milestones</div>
        <div className="milestone-feed">
          {project.updates.map((u, i) => (
            <div className="milestone-entry" key={i}>
              <span className="ms-date">{u.date}</span>
              <span className="ms-dot" />
              <span className="ms-text">{u.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Asset downloads and briefs links */}
      <div className="milestone-log">
        <div className="milestone-log-title">📁 Project Assets & Files</div>
        <div className="assets-strip">
          {project.assets.map((a, i) => (
            <a 
              className="asset-btn" 
              href={a.url} 
              target="_blank" 
              rel="noopener noreferrer" 
              key={i}
            >
              📄 {a.name}
            </a>
          ))}
          <button className="asset-btn" onClick={() => triggerToast('✏️ Opening asset upload editor...')}>
            ✎ Update Assets
          </button>
        </div>
      </div>

      {/* Deliverable link block */}
      <div className="deliverables-box">
        <div className="deliv-title">🚀 Deliverables</div>
        <div className="deliv-status">{project.deliverables.title}</div>
        <div className="deliv-links">
          {project.status === 'In Review' || project.status === 'Delivered' ? (
            <>
              {project.deliverables.links.map((l, i) => (
                <a 
                  className="deliv-link" 
                  href={l.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  key={i}
                >
                  {l.name}
                </a>
              ))}
              {project.deliverables.links.length === 0 && (
                <span className="deliv-link disabled">⚠️ Waiting for asset links from QA</span>
              )}
            </>
          ) : (
            <span className="deliv-link disabled">⇩ Downloads unlock when review is ready</span>
          )}
        </div>
      </div>

      {/* Action buttons footer */}
      <div className="action-row">
        {project.status === 'In Review' && (
          <>
            <button className="btn-ghost" onClick={onOpenRevision}>
              🔄 Request Revision <span className="revision-count">({project.revisionsLeft} left)</span>
            </button>
            <button className="btn-primary" onClick={onOpenApprove}>
              ✅ Approve & Finalize
            </button>
          </>
        )}
        {project.status === 'In Progress' && (
          <button className="btn-addon" onClick={onOpenAddon}>
            ➕ Request Scope Add-on
          </button>
        )}
        <button className="btn-thread" onClick={onOpenThread}>
          💬 Project Discussion Thread ({project.discussion.length})
        </button>
      </div>

    </article>
  );
}
