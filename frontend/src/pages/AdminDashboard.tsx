import { useState, useEffect } from 'react';
import { getUser, getToken, logout } from '../utils/auth.js';
import { downloadClientInvoicePDF } from '../utils/pdfInvoice.js';
import { API_BASE } from '../config.js';
import { formatImageUrl, fetchDirectImageUrl } from '../utils/imageResolver.js';
import './AdminDashboard.css';

interface Order {
  id: number;
  clientId: number;
  serviceCategory: string;
  tier: string;
  price: number;
  status: string;
  assignmentStatus?: string; // 'pending_acceptance' | 'accepted' | 'declined'
  declineReason?: string;
  declinedBy?: string;
  declinedAt?: string;
  acceptedAt?: string;
  milestoneStage?: number;
  amountPaid?: number;
  description: string;
  submissionLink: string;
  midpointSubmissionLink?: string;
  midpointSubmissionNotes?: string;
  midpointApprovedAt?: string;
  qaApprovedLink: string;
  freelancerId?: number;
  assignedFreelancerIds?: string;
  assignedFreelancers?: Array<{ id: number; name: string; email: string; services?: string[]; phone?: string }>;
  deadline?: string;
  durationValue?: number;
  durationUnit?: string;
  projectNotice?: string;
  freelancerPayoutAmount?: number;
  payoutStatus?: string;
  payoutReleasedAt?: string;
  adminRevisionComments?: string;
  assignedAt?: string;
  createdAt: string;
  updatedAt?: string;
  client?: { name: string; email: string; phone?: string; status?: string; createdAt?: string; };
  freelancer?: { name: string; email: string; phone?: string; services?: string[]; portfolioLink?: string; bankDetails?: any; status?: string; createdAt?: string; };
}

interface Freelancer {
  id: number;
  name: string;
  email: string;
  services: string[];
  phone?: string;
  portfolioLink?: string;
  bankDetails?: any;
  status?: string;
  createdAt?: string;
}

export interface ClientRow {
  id: number;
  name: string;
  email: string;
  phone: string;
  totalOrders: number;
  activeTasks: number;
  completedTasks: number;
  ltv: number;
  status: 'Active' | 'Dormant' | 'Suspended';
  createdAt?: string;
}

export interface FreelancerRow {
  id: number;
  name: string;
  email: string;
  phone: string;
  services: string[];
  portfolioLink?: string;
  bankDetails?: any;
  status: string;
  totalTasks: number;
  activeTasks: number;
  completedTasks: number;
  totalEarnings: number;
  pendingPayout: number;
  createdAt?: string;
}

interface Testimonial {
  id: number;
  name: string;
  role: string;
  quote: string;
  stars: number;
  status: string;
}

interface Message {
  id: number;
  orderId: number;
  senderId: number;
  senderRole: string;
  targetAudience?: string; // 'all' | 'client_only' | 'freelancer_only' | 'internal'
  messageText: string;
  createdAt: string;
}

export default function AdminDashboard() {
  const user = getUser();
  const token = getToken();
  const isMaster = user?.role === 'admin';
  const initials = getInitials(user?.name || 'Admin');

  // ── CORE DATA STATES ──────────────────────────────────────────
  const [orders, setOrders] = useState<Order[]>([]);
  const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
  const [dbClients, setDbClients] = useState<any[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [financials, setFinancials] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ── NAVIGATION & TAB STATES ───────────────────────────────────
  // Views: overview, pipeline, assign, qc, disputes, clients, freelancers, payouts, invoices, testimonials, security, audit
  const [currentView, setCurrentView] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Clients Directory Grid Filters
  const [clientSearch, setClientSearch] = useState('');
  const [clientSort, setClientSort] = useState('ltv-high');

  // Freelancer Roster Grid Filters & Modal
  const [flSearch, setFlSearch] = useState('');
  const [flFilterSkill, setFlFilterSkill] = useState('all');
  const [flSort, setFlSort] = useState('earnings-high');
  const [selectedFreelancerModal, setSelectedFreelancerModal] = useState<FreelancerRow | null>(null);

  // ── MODALS & SUBMIT CONTROLS ──────────────────────────────────
  const [assignDeskTab, setAssignDeskTab] = useState<'pending' | 'assigned'>('pending');
  const [assigningOrder, setAssigningOrder] = useState<Order | null>(null);
  const [selectedFreelancerIds, setSelectedFreelancerIds] = useState<number[]>([]);
  const [assignDeadline, setAssignDeadline] = useState<string>('');
  const [assignDurationValue, setAssignDurationValue] = useState<number | ''>('');
  const [assignDurationUnit, setAssignDurationUnit] = useState<string>('days');
  const [assignNotice, setAssignNotice] = useState<string>('');
  const [payoutAmount, setPayoutAmount] = useState<number>(0);
  const [isAssigning, setIsAssigning] = useState(false);

  // ── ON-DEMAND / CUSTOM QUOTING STATES ──────────────────────────
  const [onDemandTab, setOnDemandTab] = useState<'pending' | 'quoted' | 'all'>('pending');
  const [quoteOrder, setQuoteOrder] = useState<Order | null>(null);
  const [quotePriceInput, setQuotePriceInput] = useState<number>(0);
  const [quoteNotesInput, setQuoteNotesInput] = useState<string>('');
  const [quoteTierInput, setQuoteTierInput] = useState<string>('custom');
  const [quoteCategoryInput, setQuoteCategoryInput] = useState<string>('');
  const [isQuoting, setIsQuoting] = useState<boolean>(false);

  // ── CLIENT DOSSIER POPUP MODAL ────────────────────────────────
  const [selectedClientModal, setSelectedClientModal] = useState<ClientRow | null>(null);

  const [qaOrder, setQaOrder] = useState<Order | null>(null);
  const [qaAction, setQaAction] = useState<'approve' | 'revision' | 'reject'>('approve');
  const [qaComments, setQaComments] = useState('');
  const [qaApprovedLinkInput, setQaApprovedLinkInput] = useState('');

  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [newFreelancerForm, setNewFreelancerForm] = useState({
    name: '', email: '', password: '', services: [] as string[], portfolioLink: '',
  });

  const [relayOrder, setRelayOrder] = useState<Order | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [relayText, setRelayText] = useState('');
  const [chatAudience, setChatAudience] = useState<'all' | 'client_only' | 'freelancer_only' | 'internal'>('all');
  const [chatChannelFilter, setChatChannelFilter] = useState<'all' | 'client' | 'freelancer' | 'internal'>('all');

  // ── EDIT PRICE & TIMELINE STATE ───────────────────────────────
  const [editPriceOrder, setEditPriceOrder] = useState<Order | null>(null);
  const [editPriceInput, setEditPriceInput] = useState<number>(0);
  const [editTierInput, setEditTierInput] = useState<string>('silver');
  const [editCategoryInput, setEditCategoryInput] = useState<string>('');
  const [editDurationValue, setEditDurationValue] = useState<number | ''>('');
  const [editDurationUnit, setEditDurationUnit] = useState<string>('days');
  const [editDeadline, setEditDeadline] = useState<string>('');
  const [editNotice, setEditNotice] = useState<string>('');

  // ── CMS (BLOGS & BUNDLES) MANAGEMENT STATES ────────────────────
  const [blogsList, setBlogsList] = useState<any[]>([]);
  const [bundlesList, setBundlesList] = useState<any[]>([]);

  // Blogs Management
  const [editingBlog, setEditingBlog] = useState<any | null>(null);
  const [blogForm, setBlogForm] = useState({ title: '', author: '', content: '', publishedAt: '' });
  const [blogModalOpen, setBlogModalOpen] = useState(false);

  // Bundles Management
  const [editingBundle, setEditingBundle] = useState<any | null>(null);
  const [bundleForm, setBundleForm] = useState({ category: 'Website Development', tag: '', name: '', description: '', price: '', period: '', features: [] as string[], popular: false });
  const [bundleModalOpen, setBundleModalOpen] = useState(false);
  const [featureInput, setFeatureInput] = useState('');
  const [selectedClientBundleCat, setSelectedClientBundleCat] = useState('Website Development');

  // Team Management
  const [teamList, setTeamList] = useState<any[]>([]);
  const [editingTeam, setEditingTeam] = useState<any | null>(null);
  const [teamForm, setTeamForm] = useState({ name: '', role: '', subtitle: '', description: '', bio: '', uniqueFact: '', image: '', orderIndex: 0 });
  const [teamModalOpen, setTeamModalOpen] = useState(false);

  // Gallery / Portfolio Management
  const [galleryList, setGalleryList] = useState<any[]>([]);
  const [editingGallery, setEditingGallery] = useState<any | null>(null);
  const [galleryForm, setGalleryForm] = useState({
    title: '',
    category: 'Website Development',
    mediaType: 'image',
    mediaUrl: '',
    thumbnailUrl: '',
    description: '',
    clientName: '',
    featured: true,
    orderIndex: 0
  });
  const [galleryModalOpen, setGalleryModalOpen] = useState(false);

  const fetchDashboardData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const resOrders = await fetch(`${API_BASE}/api/admin/orders`, { headers: { Authorization: `Bearer ${token}` } });
      const dataOrders = await resOrders.json();
      if (!resOrders.ok) throw new Error(dataOrders.error || 'Failed to fetch admin orders');

      const resClients = await fetch(`${API_BASE}/api/admin/clients`, { headers: { Authorization: `Bearer ${token}` } });
      const dataClients = await resClients.json();
      
      const resFl = await fetch(`${API_BASE}/api/admin/freelancers`, { headers: { Authorization: `Bearer ${token}` } });
      const dataFl = await resFl.json();

      const resT = await fetch(`${API_BASE}/api/admin/testimonials`, { headers: { Authorization: `Bearer ${token}` } });
      const dataT = await resT.json();

      const resB = await fetch(`${API_BASE}/api/admin/blogs`, { headers: { Authorization: `Bearer ${token}` } });
      const dataB = await resB.json();

      const resBu = await fetch(`${API_BASE}/api/admin/bundles`, { headers: { Authorization: `Bearer ${token}` } });
      const dataBu = await resBu.json();

      const resTeam = await fetch(`${API_BASE}/api/admin/team`, { headers: { Authorization: `Bearer ${token}` } });
      const dataTeam = await resTeam.json();

      const resGal = await fetch(`${API_BASE}/api/admin/gallery`, { headers: { Authorization: `Bearer ${token}` } });
      const dataGal = await resGal.json();

      let dataFin: any = null;
      if (isMaster) {
        const resFin = await fetch(`${API_BASE}/api/admin/financials`, { headers: { Authorization: `Bearer ${token}` } });
        if (resFin.ok) {
          dataFin = await resFin.json();
          setFinancials(dataFin);
        }
      }

      const sortedOrders = (dataOrders.data || []).sort((a: Order, b: Order) => {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        return timeB - timeA || b.id - a.id;
      });
      setOrders(sortedOrders);
      if (resClients.ok) setDbClients(dataClients.data || []);
      if (resFl.ok) setFreelancers(dataFl.data || []);
      if (resT.ok) setTestimonials(dataT.data || []);
      if (resB.ok) setBlogsList(dataB.data || []);
      if (resBu.ok) setBundlesList(dataBu.data || []);
      if (resTeam.ok) setTeamList(dataTeam.data || []);
      if (resGal.ok) setGalleryList(dataGal.data || []);
    } catch (err: any) {
      if (!silent) setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Fast real-time synchronization (every 2s when tab is active)
    const syncInterval = setInterval(() => {
      if (!document.hidden) {
        fetchDashboardData(true);
      }
    }, 2000);

    const handleVisibilitySync = () => {
      if (!document.hidden) {
        fetchDashboardData(true);
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

  // ── RELAY CHAT POLLING (Real-time 1.2s sync) ─────────────────────
  useEffect(() => {
    let interval: any;
    if (relayOrder) {
      fetchMessages(relayOrder.id);
      interval = setInterval(() => {
        if (!document.hidden) {
          fetchMessages(relayOrder.id);
        }
      }, 1200);
    }
    return () => clearInterval(interval);
  }, [relayOrder]);


  // ── OPEN ASSIGN MODAL (MULTI-FREELANCER & TIMELINE CONTROLS) ──
  const syncDeadlineFromDuration = (val: number, unit: string) => {
    if (!val || val <= 0) return;
    const now = new Date();
    if (unit === 'months') now.setMonth(now.getMonth() + val);
    else if (unit === 'hours') now.setHours(now.getHours() + val);
    else now.setDate(now.getDate() + val);
    setAssignDeadline(now.toISOString().slice(0, 16));
  };

  const openAssignModal = (o: Order) => {
    setAssigningOrder(o);
    setPayoutAmount(o.freelancerPayoutAmount || Math.floor(o.price * 0.7));

    // Parse existing candidates
    let initialIds: number[] = [];
    if (o.assignedFreelancerIds) {
      try {
        const parsed = JSON.parse(o.assignedFreelancerIds);
        if (Array.isArray(parsed)) initialIds = parsed.map(Number).filter(n => !isNaN(n) && n > 0);
      } catch {}
    }
    if (initialIds.length === 0 && o.freelancerId) {
      initialIds = [o.freelancerId];
    }
    if (initialIds.length === 0) {
      const cat = o.serviceCategory || '';
      const matched = freelancers.filter(f =>
        (f.services || []).some(s =>
          s.toLowerCase().includes(cat.toLowerCase()) ||
          cat.toLowerCase().includes(s.toLowerCase())
        )
      );
      if (matched.length > 0) {
        initialIds = matched.map(f => f.id);
      }
    }
    setSelectedFreelancerIds(initialIds);

    // Deadline & duration defaults
    if (o.deadline) {
      try {
        const d = new Date(o.deadline);
        setAssignDeadline(d.toISOString().slice(0, 16));
      } catch {
        setAssignDeadline(o.deadline);
      }
    } else if (o.durationValue) {
      const now = new Date();
      const unit = o.durationUnit || 'days';
      if (unit === 'months') now.setMonth(now.getMonth() + o.durationValue);
      else if (unit === 'hours') now.setHours(now.getHours() + o.durationValue);
      else now.setDate(now.getDate() + o.durationValue);
      setAssignDeadline(now.toISOString().slice(0, 16));
    } else {
      const now = new Date();
      now.setDate(now.getDate() + 7);
      setAssignDeadline(now.toISOString().slice(0, 16));
    }

    setAssignDurationValue(o.durationValue || 7);
    setAssignDurationUnit(o.durationUnit || 'days');
    setAssignNotice(o.projectNotice || '');
  };

  const handleAssignOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningOrder) return;
    if (selectedFreelancerIds.length === 0) {
      setError('Please select at least one freelancer specialist to assign.');
      return;
    }
    setError(''); setSuccess('');
    setIsAssigning(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/orders/${assigningOrder.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          freelancerIds: selectedFreelancerIds,
          payoutAmount: Number(payoutAmount) || 0,
          deadline: assignDeadline || undefined,
          durationValue: assignDurationValue !== '' ? Number(assignDurationValue) : undefined,
          durationUnit: assignDurationUnit,
          projectNotice: assignNotice || undefined,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Assignment failed');
      const isMulti = selectedFreelancerIds.length > 1;
      setSuccess(isMulti
        ? `⚡ Task #WN-${assigningOrder.id} offered to ${selectedFreelancerIds.length} specialists on First-Come First-Serve basis!`
        : `🎯 Task #WN-${assigningOrder.id} assigned successfully to specialist!`
      );
      setAssigningOrder(null); setSelectedFreelancerIds([]); setPayoutAmount(0);
      setAssignDeadline(''); setAssignDurationValue(''); setAssignNotice('');
      await fetchDashboardData(true);
    } catch (err: any) { 
      setError(err.message || 'Failed to assign task.'); 
    } finally {
      setIsAssigning(false);
    }
  };

  const handleQaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qaOrder) return;
    setError(''); setSuccess('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/orders/${qaOrder.id}/qa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: qaAction, comments: qaComments, qaApprovedLink: qaApprovedLinkInput || undefined })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'QA Action failed');
      setSuccess(`QA action '${qaAction.toUpperCase()}' completed successfully!`);
      setQaOrder(null); setQaComments(''); setQaApprovedLinkInput('');
      fetchDashboardData();
    } catch (err: any) { setError(err.message); }
  };

  const handleSaveOrderPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPriceOrder) return;
    setError(''); setSuccess('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/orders/${editPriceOrder.id}/price`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          price: editPriceInput,
          tier: editTierInput,
          serviceCategory: editCategoryInput,
          deadline: editDeadline || undefined,
          durationValue: editDurationValue !== '' ? Number(editDurationValue) : undefined,
          durationUnit: editDurationUnit,
          projectNotice: editNotice || undefined,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update order price/timeline');
      setSuccess(`Order #${editPriceOrder.id} price and timeline updated!`);
      setEditPriceOrder(null);
      fetchDashboardData();
    } catch (err: any) { setError(err.message); }
  };

  const handleQuoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteOrder) return;
    if (quotePriceInput <= 0) {
      setError('Please enter a valid project quote price greater than 0.');
      return;
    }
    setError(''); setSuccess('');
    setIsQuoting(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/orders/${quoteOrder.id}/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          price: Number(quotePriceInput),
          quoteNotes: quoteNotesInput,
          tier: quoteTierInput || 'custom',
          serviceCategory: quoteCategoryInput || quoteOrder.serviceCategory,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit quote');
      setSuccess(`⚡ Quote of ₹${Number(quotePriceInput).toLocaleString('en-IN')} sent to Client for Order #WN-${quoteOrder.id}! 50% Kickoff milestone demand active.`);
      setQuoteOrder(null); setQuotePriceInput(0); setQuoteNotesInput('');
      await fetchDashboardData(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send quote.');
    } finally {
      setIsQuoting(false);
    }
  };

  const handleToggleClientStatus = async (clientId: number, currentStatus: string) => {
    const nextStatus = currentStatus === 'Active' ? 'suspended' : 'active';
    setError(''); setSuccess('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${clientId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: 'client', status: nextStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update client status');
      setSuccess(`Client status successfully updated to ${nextStatus.toUpperCase()}!`);
      if (selectedClientModal) {
        setSelectedClientModal({
          ...selectedClientModal,
          status: nextStatus === 'active' ? 'Active' : 'Suspended'
        });
      }
      await fetchDashboardData(true);
    } catch (err: any) {
      setError(err.message || 'Failed to change client status.');
    }
  };

  const handleCreateFreelancer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: newFreelancerForm.name,
          email: newFreelancerForm.email,
          password: newFreelancerForm.password,
          role: 'freelancer',
          services: newFreelancerForm.services,
          portfolioLink: newFreelancerForm.portfolioLink,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to onboard freelancer');
      setSuccess(`Freelancer '${newFreelancerForm.name}' onboarded successfully!`);
      setOnboardingOpen(false);
      setNewFreelancerForm({ name: '', email: '', password: '', services: [], portfolioLink: '' });
      fetchDashboardData();
    } catch (err: any) { setError(err.message); }
  };

  const handleToggleFreelancerStatus = async (freelancerId: number, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' || currentStatus === 'Active' ? 'suspended' : 'active';
    setError(''); setSuccess('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${freelancerId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: 'freelancer', status: nextStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update specialist status');
      setSuccess(`Specialist status successfully updated to ${nextStatus.toUpperCase()}!`);
      if (selectedFreelancerModal) {
        setSelectedFreelancerModal({
          ...selectedFreelancerModal,
          status: nextStatus === 'active' ? 'Active' : 'Suspended'
        });
      }
      await fetchDashboardData(true);
    } catch (err: any) {
      setError(err.message || 'Failed to change specialist status.');
    }
  };

  const handleUpdatePayoutAmount = async (orderId: number, newAmount: number) => {
    if (!isMaster) return;
    if (isNaN(newAmount) || newAmount < 0) {
      setError('Please enter a valid non-negative payout amount.');
      return;
    }
    setError(''); setSuccess('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/orders/${orderId}/payout-amount`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ payoutAmount: newAmount, amount: newAmount })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update payout amount');
      
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, freelancerPayoutAmount: newAmount } : o));
      setSuccess(`✅ Regulated payout amount for Order #WN-${orderId} updated to ₹${newAmount.toLocaleString('en-IN')}`);
      fetchDashboardData(true);
    } catch (err: any) { setError(err.message); }
  };

  const handleApprovePayout = async (orderId: number) => {
    if (!isMaster) return;
    setError(''); setSuccess('');
    const inputEl = document.getElementById(`payout-input-${orderId}`) as HTMLInputElement | null;
    const currentInputAmount = inputEl ? Number(inputEl.value) : undefined;
    const validAmount = currentInputAmount !== undefined && !isNaN(currentInputAmount) && currentInputAmount >= 0 ? currentInputAmount : undefined;

    try {
      const res = await fetch(`${API_BASE}/api/admin/orders/${orderId}/approve-payout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ payoutAmount: validAmount, amount: validAmount })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to approve payout');

      const approvedAmount = data.data?.freelancerPayoutAmount ?? validAmount;
      setOrders(prev => prev.map(o => o.id === orderId ? {
        ...o,
        payoutStatus: 'payout_approved',
        ...(approvedAmount !== undefined ? { freelancerPayoutAmount: approvedAmount } : {})
      } : o));

      setSuccess(`🛡️ Payout for Order #WN-${orderId} (₹${(approvedAmount || 0).toLocaleString('en-IN')}) approved by Admin! Ready for final disbursement.`);
      fetchDashboardData(true);
    } catch (err: any) { setError(err.message); }
  };

  const handlePayoutRelease = async (orderId: number) => {
    if (!isMaster) return;
    setError(''); setSuccess('');
    const inputEl = document.getElementById(`payout-input-${orderId}`) as HTMLInputElement | null;
    const currentInputAmount = inputEl ? Number(inputEl.value) : undefined;
    const validAmount = currentInputAmount !== undefined && !isNaN(currentInputAmount) && currentInputAmount >= 0 ? currentInputAmount : undefined;

    try {
      const res = await fetch(`${API_BASE}/api/admin/orders/${orderId}/release-payout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ payoutAmount: validAmount, amount: validAmount })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payout release failed');

      const releasedAmount = data.data?.freelancerPayoutAmount ?? validAmount;
      setOrders(prev => prev.map(o => o.id === orderId ? {
        ...o,
        status: 'completed',
        payoutStatus: 'payout_released',
        ...(releasedAmount !== undefined ? { freelancerPayoutAmount: releasedAmount } : {})
      } : o));

      setSuccess(data.message || `🎉 Payout of ₹${(releasedAmount || 0).toLocaleString('en-IN')} released to specialist. Order delivered!`);
      fetchDashboardData(true);
    } catch (err: any) { setError(err.message); }
  };

  const handleRevokeOrder = async (orderId: number) => {
    if (!isMaster) return;
    if (!window.confirm('Are you sure you want to revoke this task and reset freelancer payout to zero?')) return;
    setError(''); setSuccess('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/orders/${orderId}/revoke`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Revoke task failed');
      setSuccess('Task revoked from freelancer. Payout zeroed. Re-assignment ready.');
      fetchDashboardData();
    } catch (err: any) { setError(err.message); }
  };

  const handleCancelOrder = async (orderId: number) => {
    if (!isMaster) return;
    if (!window.confirm('Are you sure you want to cancel this order and process a refund?')) return;
    setError(''); setSuccess('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cancel order failed');
      setSuccess('Order cancelled successfully. Refund initiated.');
      fetchDashboardData();
    } catch (err: any) { setError(err.message); }
  };

  const handleTestimonialApprove = async (id: number, approved: boolean) => {
    setError(''); setSuccess('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/testimonials/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ approved })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Testimonial approval failed');
      setSuccess(`Testimonial review updated successfully!`);
      fetchDashboardData();
    } catch (err: any) { setError(err.message); }
  };

  const fetchMessages = async (orderId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/orders/${orderId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setChatMessages(data.data || []);
    } catch (e) { console.error(e); }
  };

  const handleSendRelayMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!relayText || !relayOrder) return;
    const textToSend = relayText.trim();
    if (!textToSend) return;

    // Optimistic UI update: render message immediately with 0ms latency
    const optimisticMsg: Message = {
      id: Date.now(),
      orderId: relayOrder.id,
      senderId: user?.id || 0,
      senderRole: 'admin',
      targetAudience: chatAudience,
      messageText: textToSend,
      createdAt: new Date().toISOString(),
    };
    setChatMessages(prev => [...prev, optimisticMsg]);
    setRelayText('');

    try {
      const res = await fetch(`${API_BASE}/api/admin/orders/${relayOrder.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messageText: textToSend, targetAudience: chatAudience })
      });
      if (res.ok) {
        fetchMessages(relayOrder.id);
      }
    } catch (e) { console.error(e); }
  };

  const handleBlogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    const url = editingBlog ? `${API_BASE}/api/admin/blogs/${editingBlog.id}` : `${API_BASE}/api/admin/blogs`;
    const method = editingBlog ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(blogForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save blog post');
      setSuccess(`Blog post '${blogForm.title}' saved successfully!`);
      setBlogModalOpen(false);
      setEditingBlog(null);
      setBlogForm({ title: '', author: '', content: '', publishedAt: '' });
      fetchDashboardData();
    } catch (err: any) { setError(err.message); }
  };

  const handleBlogDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this blog post?')) return;
    setError(''); setSuccess('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/blogs/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete blog post');
      setSuccess('Blog post deleted successfully.');
      fetchDashboardData();
    } catch (err: any) { setError(err.message); }
  };

  const handleBundleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    const url = editingBundle ? `${API_BASE}/api/admin/bundles/${editingBundle.id}` : `${API_BASE}/api/admin/bundles`;
    const method = editingBundle ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(bundleForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save pricing bundle');
      setSuccess(`Pricing bundle '${bundleForm.name}' saved successfully!`);
      setBundleModalOpen(false);
      setEditingBundle(null);
      setBundleForm({ category: 'Website Development', tag: '', name: '', description: '', price: '', period: '', features: [], popular: false });
      fetchDashboardData();
    } catch (err: any) { setError(err.message); }
  };

  const handleBundleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this pricing bundle?')) return;
    setError(''); setSuccess('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/bundles/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete pricing bundle');
      setSuccess('Pricing bundle deleted successfully.');
      fetchDashboardData();
    } catch (err: any) { setError(err.message); }
  };

  const handleTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    const url = editingTeam ? `${API_BASE}/api/admin/team/${editingTeam.id}` : `${API_BASE}/api/admin/team`;
    const method = editingTeam ? 'PUT' : 'POST';

    try {
      const resolvedImage = await fetchDirectImageUrl(teamForm.image);
      const payload = { ...teamForm, image: resolvedImage || teamForm.image };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save team member');
      setSuccess(`Team member '${teamForm.name}' saved successfully!`);
      setTeamModalOpen(false);
      setEditingTeam(null);
      setTeamForm({ name: '', role: '', subtitle: '', description: '', bio: '', uniqueFact: '', image: '', orderIndex: 0 });
      fetchDashboardData();
    } catch (err: any) { setError(err.message); }
  };

  const handleTeamDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to remove this team member?')) return;
    setError(''); setSuccess('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/team/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove team member');
      setSuccess('Team member removed successfully.');
      fetchDashboardData();
    } catch (err: any) { setError(err.message); }
  };

  const handleGallerySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    const url = editingGallery ? `${API_BASE}/api/admin/gallery/${editingGallery.id}` : `${API_BASE}/api/admin/gallery`;
    const method = editingGallery ? 'PUT' : 'POST';

    try {
      const resolvedMediaUrl = galleryForm.mediaType === 'image' ? await fetchDirectImageUrl(galleryForm.mediaUrl) : galleryForm.mediaUrl;
      const resolvedThumbnailUrl = galleryForm.thumbnailUrl ? await fetchDirectImageUrl(galleryForm.thumbnailUrl) : (galleryForm.mediaType === 'image' ? resolvedMediaUrl : '');
      const payload = { ...galleryForm, mediaUrl: resolvedMediaUrl || galleryForm.mediaUrl, thumbnailUrl: resolvedThumbnailUrl };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save portfolio item');
      setSuccess(`Portfolio item '${galleryForm.title}' saved successfully!`);
      setGalleryModalOpen(false);
      setEditingGallery(null);
      setGalleryForm({ title: '', category: 'Website Development', mediaType: 'image', mediaUrl: '', thumbnailUrl: '', description: '', clientName: '', featured: true, orderIndex: 0 });
      fetchDashboardData();
    } catch (err: any) { setError(err.message); }
  };

  const handleGalleryDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to remove this item from the gallery?')) return;
    setError(''); setSuccess('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/gallery/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete portfolio item');
      setSuccess('Portfolio item deleted.');
      fetchDashboardData();
    } catch (err: any) { setError(err.message); }
  };

  const handleGalleryToggleFeatured = async (item: any) => {
    setError(''); setSuccess('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/gallery/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ featured: item.featured === 1 ? false : true })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update visibility');
      setSuccess(`Updated '${item.title}' visibility.`);
      fetchDashboardData();
    } catch (err: any) { setError(err.message); }
  };

  // ── EXPORT FREELANCERS ROSTER TO EXCEL (.CSV) ─────────────────
  const exportFreelancersToExcel = () => {
    if (freelancerRows.length === 0) {
      setError('No freelancers available to export.');
      return;
    }
    const headers = [
      'Specialist Name',
      'Email Address',
      'Phone Number',
      'Vetted Services',
      'Account Status',
      'Total Tasks Assigned',
      'Active Tasks',
      'Completed Tasks',
      'Lifetime Settled Earnings (INR)',
      'Pending Payout (INR)',
      'Portfolio Link',
      'Export Date'
    ];
    const rows = freelancerRows.map(f => [
      `"${(f.name || '').replace(/"/g, '""')}"`,
      `"${(f.email || '').replace(/"/g, '""')}"`,
      `"${(f.phone || '').replace(/"/g, '""')}"`,
      `"${(f.services || []).join('; ').replace(/"/g, '""')}"`,
      `"${f.status}"`,
      f.totalTasks,
      f.activeTasks,
      f.completedTasks,
      `"${f.totalEarnings}"`,
      `"${f.pendingPayout}"`,
      `"${(f.portfolioLink || '').replace(/"/g, '""')}"`,
      `"${new Date().toLocaleDateString('en-IN')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Workonova_Freelancer_Roster_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setSuccess('📥 Downloaded full specialist roster spreadsheet (Excel compatible .CSV)!');
  };

  // ── EXPORT CLIENTS DATABASE TO EXCEL (.CSV) ───────────────────
  const exportClientsToExcel = () => {
    if (clientRows.length === 0) {
      setError('No clients available to export.');
      return;
    }
    const headers = ['Client Name', 'Email Address', 'Phone Number', 'Account Status', 'Total Orders Placed', 'Active Tasks', 'Lifetime Spend (INR)', 'Export Date'];
    const rows = clientRows.map(c => [
      `"${(c.name || '').replace(/"/g, '""')}"`,
      `"${(c.email || '').replace(/"/g, '""')}"`,
      `"${(c.phone || '').replace(/"/g, '""')}"`,
      `"${c.status}"`,
      c.totalOrders,
      c.activeTasks,
      `"${c.ltv}"`,
      `"${new Date().toLocaleDateString('en-IN')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Workonova_Clients_Database_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setSuccess('📥 Downloaded full clients database spreadsheet (Excel compatible .CSV)!');
  };

  // ── EXPORT FINANCIAL & ORDERS LEDGER TO EXCEL (.CSV) ─────────
  const exportFinancialsToExcel = () => {
    if (orders.length === 0) {
      setError('No orders/transactions available to export.');
      return;
    }
    const headers = [
      'Order ID',
      'Client Name',
      'Client Email',
      'Service Category',
      'Tier',
      'Total Project Value (INR)',
      'Amount Paid (INR)',
      'Milestone Stage',
      'Order Status',
      'Assigned Freelancer Name',
      'Freelancer Payout (INR)',
      'Workonova Commission (INR)',
      'Payout Escrow Status',
      'Razorpay Order ID',
      'Razorpay Payment ID',
      'Created Date'
    ];

    const rows = orders.map(o => {
      const clientName = o.client?.name || 'Client';
      const clientEmail = o.client?.email || '';
      const flName = o.freelancer?.name || 'Unassigned';
      const margin = (o.price || 0) - (o.freelancerPayoutAmount || 0);
      return [
        `"ORD-${o.id}"`,
        `"${clientName.replace(/"/g, '""')}"`,
        `"${clientEmail.replace(/"/g, '""')}"`,
        `"${(o.serviceCategory || '').replace(/"/g, '""')}"`,
        `"${(o.tier || '').toUpperCase()}"`,
        o.price || 0,
        o.amountPaid || 0,
        `"Stage ${o.milestoneStage || 1}"`,
        `"${(o.status || '').toUpperCase()}"`,
        `"${flName.replace(/"/g, '""')}"`,
        o.freelancerPayoutAmount || 0,
        margin,
        `"${(o.payoutStatus || 'pending').toUpperCase()}"`,
        `"${((o as any).razorpayOrderId || '').replace(/"/g, '""')}"`,
        `"${((o as any).paymentId || '').replace(/"/g, '""')}"`,
        `"${o.createdAt ? new Date(o.createdAt).toLocaleString('en-IN') : ''}"`
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Workonova_Financial_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setSuccess('📥 Downloaded financial & transaction ledger spreadsheet (Excel compatible .CSV)!');
  };

  // ── STATISTICS & AGGREGATIONS ────────────────────────────────
  const monthlyInflow = orders.filter(o => o.status !== 'cancelled').reduce((acc, o) => acc + o.price, 0);
  const activeCount = orders.filter(o => ['paid', 'paid_50', 'assigned', 'midpoint_submitted', 'midpoint_approved', 'paid_75', 'submitted', 'qa_approved', 'revision_requested'].includes(o.status)).length;
  const qcGateCount = orders.filter(o => o.status === 'submitted').length;
  const payoutDue = orders.filter(o => o.status === 'qa_approved').reduce((acc, o) => acc + (o.freelancerPayoutAmount || 0), 0);

  const assignDeskCount = orders.filter(o => !o.freelancerId && ['paid', 'paid_50', 'paid_75', 'pending_payment'].includes(o.status)).length;
  const disputeDeskCount = orders.filter(o => o.status === 'revision_requested').length;
  const testimonialCount = testimonials.filter(t => t.status === 'pending').length;

  // On-Demand / Custom Quote counters
  const onDemandOrders = orders.filter(o => o.tier === 'custom' || ['on_demand_review', 'pending_advance', 'quote_provided'].includes(o.status));
  const onDemandCount = onDemandOrders.length;
  const pendingQuoteCount = orders.filter(o => ['on_demand_review', 'pending_advance'].includes(o.status)).length;

  // Group orders by client to compute Client Intelligence Grid
  interface ClientRow {
    id: number;
    name: string;
    email: string;
    phone: string;
    totalOrders: number;
    activeTasks: number;
    completedTasks: number;
    ltv: number;
    status: 'Active' | 'Dormant' | 'Suspended';
    createdAt?: string;
  }

  const clientMap: Record<string, ClientRow> = {};

  // 1. Initialize from all registered dbClients
  dbClients.forEach(cl => {
    const key = (cl.email || '').toLowerCase();
    if (!key) return;
    clientMap[key] = {
      id: cl.id,
      name: cl.name,
      email: cl.email,
      phone: cl.phone || '—',
      totalOrders: 0,
      activeTasks: 0,
      completedTasks: 0,
      ltv: 0,
      status: cl.status === 'suspended' ? 'Suspended' : 'Active',
      createdAt: cl.createdAt
    };
  });

  // 2. Enrich with orders placed
  orders.forEach(o => {
    if (!o.client) return;
    const key = o.client.email.toLowerCase();
    if (!clientMap[key]) {
      clientMap[key] = {
        id: o.clientId,
        name: o.client.name,
        email: o.client.email,
        phone: o.client.phone || '—',
        totalOrders: 0,
        activeTasks: 0,
        completedTasks: 0,
        ltv: 0,
        status: (o.client as any).status === 'suspended' ? 'Suspended' : 'Dormant',
        createdAt: o.createdAt
      };
    } else {
      if (o.client.phone && clientMap[key].phone === '—') {
        clientMap[key].phone = o.client.phone;
      }
    }
    clientMap[key].totalOrders += 1;
    clientMap[key].ltv += (o.amountPaid || o.price || 0);
    if (['paid', 'paid_50', 'assigned', 'midpoint_submitted', 'midpoint_approved', 'paid_75', 'submitted', 'revision_requested'].includes(o.status)) {
      clientMap[key].activeTasks += 1;
      if (clientMap[key].status !== 'Suspended') clientMap[key].status = 'Active';
    } else if (['client_approved', 'completed', 'delivered'].includes(o.status)) {
      clientMap[key].completedTasks += 1;
    }
  });

  const clientRows = Object.values(clientMap);
  const filteredClientRows = clientRows.filter(c => {
    if (clientSearch.trim()) {
      const q = clientSearch.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q);
    }
    return true;
  }).sort((a, b) => {
    if (clientSort === 'ltv-high') return b.ltv - a.ltv;
    if (clientSort === 'orders-high') return b.totalOrders - a.totalOrders;
    return 0;
  });

  // Build Freelancer Directory Rows
  const freelancerRows: FreelancerRow[] = freelancers.map(f => {
    const fOrders = orders.filter(o => o.freelancerId === f.id || (o.freelancer?.email && o.freelancer.email.toLowerCase() === f.email.toLowerCase()));
    const activeTasks = fOrders.filter(o => ['assigned', 'midpoint_submitted', 'midpoint_approved', 'submitted', 'qa_approved', 'revision_requested'].includes(o.status)).length;
    const completedTasks = fOrders.filter(o => ['completed', 'delivered', 'client_approved'].includes(o.status)).length;
    const totalEarnings = fOrders
      .filter(o => o.payoutStatus === 'payout_released' || ['completed', 'delivered'].includes(o.status))
      .reduce((sum, o) => sum + (o.freelancerPayoutAmount || 0), 0);
    const pendingPayout = fOrders
      .filter(o => o.payoutStatus === 'payout_approved' || ['qa_approved', 'client_approved'].includes(o.status))
      .reduce((sum, o) => sum + (o.freelancerPayoutAmount || 0), 0);

    return {
      id: f.id,
      name: f.name,
      email: f.email,
      phone: f.phone || '—',
      services: f.services || [],
      portfolioLink: f.portfolioLink,
      bankDetails: f.bankDetails,
      status: f.status === 'suspended' ? 'Suspended' : f.status === 'active' ? 'Active' : 'Active',
      totalTasks: fOrders.length,
      activeTasks,
      completedTasks,
      totalEarnings,
      pendingPayout,
      createdAt: f.createdAt,
    };
  });

  const filteredFreelancers = freelancerRows.filter(f => {
    if (flSearch.trim()) {
      const q = flSearch.toLowerCase();
      return (
        f.name.toLowerCase().includes(q) ||
        f.email.toLowerCase().includes(q) ||
        f.phone.toLowerCase().includes(q) ||
        f.services.some(s => s.toLowerCase().includes(q))
      );
    }
    if (flFilterSkill !== 'all') {
      return f.services.some(s => s.toLowerCase().includes(flFilterSkill.toLowerCase()));
    }
    return true;
  }).sort((a, b) => {
    if (flSort === 'earnings-high') return b.totalEarnings - a.totalEarnings;
    if (flSort === 'tasks-high') return b.totalTasks - a.totalTasks;
    if (flSort === 'active-high') return b.activeTasks - a.activeTasks;
    return 0;
  });

  const goView = (view: string) => { setCurrentView(view); setSidebarOpen(false); };

  // ══════════════════════════════════════════════════════════════
  // JSX RENDER
  // ══════════════════════════════════════════════════════════════
  return (
    <div className="ad-root">
      
      {/* ═══════════ SIDEBAR ═══════════ */}
      <aside className={`ad-sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="ad-logo-block">
          <img src="/assets/workonova-logo.webp" alt="WN" />
          <span className="ad-title">WORKONOVA Admin OS</span>
        </div>

        <div className="ad-sidebar-nav">
          <p className="ad-nav-label">Core Operations</p>
          <button className={`ad-nav-item${currentView === 'overview' ? ' active' : ''}`} onClick={() => goView('overview')}>
            <span className="ad-nav-icon">📊</span><span>Master Overview</span>
          </button>
          <button className={`ad-nav-item${currentView === 'pipeline' ? ' active' : ''}`} onClick={() => goView('pipeline')}>
            <span className="ad-nav-icon">📥</span><span>Order Pipeline</span>
            {orders.length > 0 && <span className="ad-nav-badge">{orders.length}</span>}
          </button>
          <button className={`ad-nav-item${currentView === 'ondemand' ? ' active' : ''}`} onClick={() => goView('ondemand')}>
            <span className="ad-nav-icon">⚡</span><span>On-Demand Desk</span>
            {pendingQuoteCount > 0 ? (
              <span className="ad-nav-badge urgent">{pendingQuoteCount}</span>
            ) : onDemandCount > 0 ? (
              <span className="ad-nav-badge">{onDemandCount}</span>
            ) : null}
          </button>
          <button className={`ad-nav-item${currentView === 'assign' ? ' active' : ''}`} onClick={() => goView('assign')}>
            <span className="ad-nav-icon">🎯</span><span>Assign Desk</span>
            {assignDeskCount > 0 && <span className="ad-nav-badge urgent">{assignDeskCount}</span>}
          </button>
          <button className={`ad-nav-item${currentView === 'qc' ? ' active' : ''}`} onClick={() => goView('qc')}>
            <span className="ad-nav-icon">🛡️</span><span>Internal QC Gate</span>
            {qcGateCount > 0 && <span className="ad-nav-badge">{qcGateCount}</span>}
          </button>
          <button className={`ad-nav-item${currentView === 'disputes' ? ' active' : ''}`} onClick={() => goView('disputes')}>
            <span className="ad-nav-icon">🔄</span><span>Dispute / Revision Desk</span>
            {disputeDeskCount > 0 && <span className="ad-nav-badge urgent">{disputeDeskCount}</span>}
          </button>

          <p className="ad-nav-label">Spreadsheet Grids (CRM)</p>
          <button className={`ad-nav-item${currentView === 'clients' ? ' active' : ''}`} onClick={() => goView('clients')}>
            <span className="ad-nav-icon">👥</span><span>Clients Directory</span>
          </button>
          <button className={`ad-nav-item${currentView === 'freelancers' ? ' active' : ''}`} onClick={() => goView('freelancers')}>
            <span className="ad-nav-icon">👨‍💻</span><span>Freelancer Roster</span>
          </button>

          <p className="ad-nav-label">Finance &amp; Razorpay</p>
          <button className={`ad-nav-item${currentView === 'financials' ? ' active' : ''}`} onClick={() => goView('financials')}>
            <span className="ad-nav-icon">💳</span><span>Razorpay &amp; Financials</span>
            {financials?.summary?.totalTransactions > 0 && <span className="ad-nav-badge">{financials.summary.totalTransactions}</span>}
          </button>
          <button className={`ad-nav-item${currentView === 'payouts' ? ' active' : ''}`} onClick={() => goView('payouts')}>
            <span className="ad-nav-icon">💸</span><span>Batch Payouts</span>
            {payoutDue > 0 && <span className="ad-nav-badge">₹{Math.round(payoutDue / 1000)}K</span>}
          </button>
          <button className={`ad-nav-item${currentView === 'invoices' ? ' active' : ''}`} onClick={() => goView('invoices')}>
            <span className="ad-nav-icon">🧾</span><span>GST Invoices</span>
          </button>

          <p className="ad-nav-label">CMS &amp; Web Controls</p>
          <button className={`ad-nav-item${currentView === 'gallery' ? ' active' : ''}`} onClick={() => goView('gallery')}>
            <span className="ad-nav-icon">🖼️</span><span>Portfolio Gallery Manager</span>
            {galleryList.length > 0 && <span className="ad-nav-badge">{galleryList.length}</span>}
          </button>
          <button className={`ad-nav-item${currentView === 'testimonials' ? ' active' : ''}`} onClick={() => goView('testimonials')}>
            <span className="ad-nav-icon">⭐</span><span>Testimonials Queue</span>
            {testimonialCount > 0 && <span className="ad-nav-badge">{testimonialCount}</span>}
          </button>
          <button className={`ad-nav-item${currentView === 'blogs' ? ' active' : ''}`} onClick={() => goView('blogs')}>
            <span className="ad-nav-icon">📝</span><span>Landing Page Blogs</span>
          </button>
          <button className={`ad-nav-item${currentView === 'bundles' ? ' active' : ''}`} onClick={() => goView('bundles')}>
            <span className="ad-nav-icon">💎</span><span>Pricing Bundles</span>
          </button>
          <button className={`ad-nav-item${currentView === 'client_bundles' ? ' active' : ''}`} onClick={() => goView('client_bundles')}>
            <span className="ad-nav-icon">🎯</span><span>Client Modal Bundles &amp; Services</span>
          </button>
          <button className={`ad-nav-item${currentView === 'team' ? ' active' : ''}`} onClick={() => goView('team')}>
            <span className="ad-nav-icon">👥</span><span>Team Members Desk</span>
          </button>

          <p className="ad-nav-label">System &amp; Security</p>
          <button className={`ad-nav-item${currentView === 'security' ? ' active' : ''}`} onClick={() => goView('security')}>
            <span className="ad-nav-icon">🚫</span><span>Blocked EXE Logs</span>
          </button>
          <button className={`ad-nav-item${currentView === 'audit' ? ' active' : ''}`} onClick={() => goView('audit')}>
            <span className="ad-nav-icon">🔐</span><span>Audit Trail</span>
          </button>
        </div>
      </aside>

      {/* ═══════════ HEADER ═══════════ */}
      <div className="ad-header">
        <button className="cd-hamburger" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Menu">
          <span /><span /><span />
        </button>

        <div className="ad-os-badge">
          ⚡ WORKONOVA Admin OS
        </div>
        <div className="ad-status-pill">
          <span className="ad-status-dot" />
          SLA: 99.9%
        </div>

        {/* Global search */}
        <div className="ad-search">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
          <input
            type="search"
            placeholder="Universal Search (Ctrl+K)..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentView('pipeline'); }}
          />
        </div>

        {/* Right status info */}
        <div className="ad-header-right">
          <span className="ad-revenue-chip">Net Revenue: ₹{(monthlyInflow / 100000).toFixed(2)}L</span>
          <button className="ad-notif-btn" onClick={() => goView('qc')}>
            🔔{qcGateCount > 0 && <span className="ad-notif-badge">{qcGateCount}</span>}
          </button>
          <div className="ad-user-pill" onClick={() => goView('audit')}>
            <div className="ad-avatar">{initials}</div>
            <span style={{ fontSize: 12, fontWeight: 700 }}>{isMaster ? 'Super Admin' : 'QA Team'}</span>
          </div>
          <button className="ad-logout-btn" onClick={logout}>Logout</button>
        </div>
      </div>

      {/* ═══════════ MAIN CONTENT ═══════════ */}
      <div className="ad-main">
        {error && <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}
        {success && <div style={{ background: '#dcfce7', border: '1px solid #86efac', color: '#166534', padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{success}</div>}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>Loading platform control room…</div>
        ) : (
          <>
            {/* ════ VIEW: OVERVIEW ════ */}
            {currentView === 'overview' && (
              <>
                <div className="ad-view-header">
                  <p>System Overview</p>
                  <h1>Master KPI Snapshot</h1>
                </div>

                <div className="ad-kpi-grid">
                  <div className="ad-kpi-card" onClick={() => goView('invoices')}>
                    <small>Monthly Inflow</small>
                    <strong>₹{monthlyInflow.toLocaleString('en-IN')}</strong>
                  </div>
                  <div className="ad-kpi-card" onClick={() => goView('pipeline')}>
                    <small>Active Projects</small>
                    <strong>{activeCount} Running</strong>
                  </div>
                  <div className="ad-kpi-card" onClick={() => goView('qc')}>
                    <small>In QC Gate</small>
                    <strong>{qcGateCount} Action Needed</strong>
                  </div>
                  <div className="ad-kpi-card" onClick={() => goView('payouts')}>
                    <small>Freelancer Payout</small>
                    <strong>₹{payoutDue.toLocaleString('en-IN')} Due</strong>
                  </div>
                </div>

                {/* Real-time escalations */}
                <div className="ad-escalations">
                  <h3>🚨 Real-Time Escalation Alerts</h3>
                  <div className="ad-escalation-item">
                    <span>⏳ <b>72h Auto-Approval Timer:</b> Order #WN-102 (Client: Rohit S.) has 11h remaining before funds release.</span>
                    <button className="ad-intervene-btn" onClick={() => goView('qc')}>Intervene</button>
                  </div>
                  <div className="ad-escalation-item">
                    <span>⚠️ <b>Stalled Task:</b> Order #WN-098 (Dev: Priya) - No milestone update in last 26 hours.</span>
                    <button className="ad-intervene-btn" onClick={() => { const o = orders.find(x => x.id === 98); if (o) setRelayOrder(o); }}>Intervene</button>
                  </div>
                </div>

                {/* Nest Clients spreadsheet grid by default */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0 10px' }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700 }}>👥 Client Intelligence Directory</h3>
                  <button className="ad-export-btn" onClick={() => goView('clients')}>Full Grid View ↗</button>
                </div>
                
                <div className="ad-table-wrap">
                  <table className="ad-table">
                    <thead>
                      <tr><th>Client &amp; Org</th><th>Contact Info</th><th>Total Orders</th><th>Active Tasks</th><th>LTV</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {clientRows.slice(0, 3).map(c => (
                        <tr key={c.email}>
                          <td><b>🏢 {c.name}</b></td>
                          <td>{c.email} · {c.phone}</td>
                          <td>{c.totalOrders} Orders</td>
                          <td>{c.activeTasks} Active</td>
                          <td>₹{c.ltv.toLocaleString('en-IN')}</td>
                          <td><span className={c.status === 'Active' ? 'ad-status-dot-active' : 'ad-status-dot-dormant'}>{c.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* ════ VIEW: PIPELINE ════ */}
            {currentView === 'pipeline' && (
              <>
                <div className="ad-view-header">
                  <p>Operational Queue</p>
                  <h1>Order Pipeline</h1>
                </div>

                <div className="ad-table-wrap">
                  <table className="ad-table">
                    <thead>
                      <tr><th>Order ID</th><th>Service Category</th><th>Client</th><th>Freelancer</th><th>Paid</th><th>Payout</th><th>Profit Margin</th><th>Status</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {orders.map(o => {
                        const margin = o.price - (o.freelancerPayoutAmount || 0);
                        const isStalled = o.status === 'assigned' && o.id === 98; // simulated stalled project
                        return (
                          <tr key={o.id} style={isStalled ? { background: '#fef2f2' } : {}}>
                            <td><b>#WN-{o.id}</b></td>
                            <td>{o.serviceCategory} ({o.tier})</td>
                            <td>{o.client?.name || 'Unknown'}</td>
                            <td>{o.freelancer?.name || 'Unassigned'}</td>
                            <td>₹{o.price.toLocaleString()}</td>
                            <td>₹{o.freelancerPayoutAmount?.toLocaleString() || 0}</td>
                            <td style={{ color: margin > 0 ? '#166534' : '#991b1b', fontWeight: 600 }}>₹{margin.toLocaleString()}</td>
                            <td><span className={`fd-status-pill ${o.status}`}>{o.status.toUpperCase()}</span></td>
                            <td style={{ display: 'flex', gap: 6 }}>
                              <button className="ad-pag-btn" onClick={() => setRelayOrder(o)}>💬 Chat</button>
                              {(!o.freelancerId || ['paid', 'paid_50', 'paid_75', 'pending_payment'].includes(o.status)) && (
                                <button 
                                  className="ad-pag-btn active" 
                                  title="Assign this task to specialist freelancer(s) on FCFS basis"
                                  onClick={() => openAssignModal(o)}
                                >
                                  🎯 Assign
                                </button>
                              )}
                              <button className="ad-pag-btn" onClick={() => {
                                setEditPriceOrder(o);
                                setEditPriceInput(o.price);
                                setEditTierInput(o.tier || 'silver');
                                setEditCategoryInput(o.serviceCategory);
                                setEditDurationValue(o.durationValue || '');
                                setEditDurationUnit(o.durationUnit || 'days');
                                setEditDeadline(o.deadline ? o.deadline.slice(0, 16) : '');
                                setEditNotice(o.projectNotice || '');
                              }}>✏️ Price &amp; Timeline</button>
                              {o.status === 'submitted' && <button className="ad-pag-btn active" onClick={() => setQaOrder(o)}>🛡️ QA</button>}
                              {isMaster && ['assigned', 'submitted', 'qa_approved', 'revision_requested'].includes(o.status) && (
                                <button className="ad-pag-btn" onClick={() => handleRevokeOrder(o.id)}>Revoke</button>
                              )}
                              {isMaster && o.status !== 'cancelled' && o.status !== 'delivered' && (
                                <button className="ad-pag-btn" onClick={() => handleCancelOrder(o.id)}>Refund</button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* ════ VIEW: ON-DEMAND DESK ════ */}
            {currentView === 'ondemand' && (
              <>
                <div className="ad-view-header">
                  <p>Custom Scoping &amp; Quoting</p>
                  <h1>⚡ On-Demand Project Desk</h1>
                  <p style={{ color: '#888', fontSize: 13, marginTop: 4 }}>
                    Review bespoke client briefs submitted with <b>₹100 advance deposit</b>, evaluate requirements &amp; issue custom milestone quotes.
                  </p>
                </div>

                {(() => {
                  const pendingQuoteOrders = orders.filter(o => ['on_demand_review', 'pending_advance'].includes(o.status) || (o.tier === 'custom' && o.status === 'pending_payment'));
                  const quotedOrders = orders.filter(o => o.status === 'quote_provided' || (o.tier === 'custom' && !['on_demand_review', 'pending_advance'].includes(o.status)));
                  const allCustom = orders.filter(o => o.tier === 'custom' || ['on_demand_review', 'pending_advance', 'quote_provided'].includes(o.status));

                  return (
                    <div>
                      {/* Sub Tabs */}
                      <div className="ad-assign-tabs">
                        <button
                          className={`ad-assign-tab-btn ${onDemandTab === 'pending' ? 'active' : ''}`}
                          onClick={() => setOnDemandTab('pending')}
                        >
                          <span>⚡ Awaiting Price Quote</span>
                          <span className="ad-assign-tab-badge">{pendingQuoteOrders.length}</span>
                        </button>
                        <button
                          className={`ad-assign-tab-btn ${onDemandTab === 'quoted' ? 'active' : ''}`}
                          onClick={() => setOnDemandTab('quoted')}
                        >
                          <span>📋 Quoted &amp; In-Flight Custom Projects</span>
                          <span className="ad-assign-tab-badge">{quotedOrders.length}</span>
                        </button>
                        <button
                          className={`ad-assign-tab-btn ${onDemandTab === 'all' ? 'active' : ''}`}
                          onClick={() => setOnDemandTab('all')}
                        >
                          <span>📁 All Custom Inquiries</span>
                          <span className="ad-assign-tab-badge">{allCustom.length}</span>
                        </button>
                      </div>

                      {/* Display Orders */}
                      {onDemandTab === 'pending' && (
                        <div>
                          {pendingQuoteOrders.length === 0 ? (
                            <div className="ad-assign-empty-card">
                              <div style={{ fontSize: 36, marginBottom: 12 }}>✨</div>
                              <h3 style={{ fontSize: 18, marginBottom: 6 }}>No pending custom requests awaiting quote!</h3>
                              <p style={{ color: '#888', fontSize: 14, maxWidth: 460, margin: '0 auto 16px' }}>
                                All incoming bespoke client requirements have been priced and quoted. New custom orders submitted with ₹100 advance will appear here in real-time.
                              </p>
                            </div>
                          ) : (
                            <div className="ad-qc-grid">
                              {pendingQuoteOrders.map(o => (
                                <div className="ad-qc-card" key={o.id} style={{ borderLeft: '4px solid #f59e0b' }}>
                                  <div className="ad-qc-header">
                                    <div>
                                      <h3 style={{ margin: 0, fontSize: 16 }}>Custom Order #WN-{o.id}</h3>
                                      <small style={{ color: '#888', fontSize: 12 }}>{o.serviceCategory}</small>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                      <span className="ad-ondemand-token-pill">₹100 Advance Paid ✓</span>
                                    </div>
                                  </div>

                                  <div style={{ margin: '14px 0', background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                    <label className="ad-form-label" style={{ marginBottom: 4 }}>Client Project Brief &amp; Scope Requirements</label>
                                    <div style={{ fontSize: 13, color: '#334155', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                                      {o.description || 'No detailed brief text provided.'}
                                    </div>
                                  </div>

                                  {o.submissionLink && (
                                    <div style={{ marginBottom: 14 }}>
                                      <label className="ad-form-label" style={{ marginBottom: 4 }}>Raw Assets &amp; Drive Repository</label>
                                      <a
                                        href={o.submissionLink}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{ color: '#2563eb', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                      >
                                        📁 Open Client Assets Link ↗
                                      </a>
                                    </div>
                                  )}

                                  <div className="ad-assign-order-meta" style={{ marginBottom: 16 }}>
                                    <span>Client: <b>{o.client?.name || `#${o.clientId}`}</b> ({o.client?.email})</span>
                                    <span>Status: <b style={{ color: '#d97706', background: '#fef3c7', padding: '2px 8px', borderRadius: 6 }}>AWAITING QUOTE</b></span>
                                  </div>

                                  <div className="ad-qc-actions" style={{ display: 'flex', gap: 8 }}>
                                    <button
                                      className="ad-btn-primary"
                                      style={{ flex: 1, background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                                      onClick={() => {
                                        setQuoteOrder(o);
                                        setQuotePriceInput(o.price > 100 ? o.price : 15000);
                                        setQuoteCategoryInput(o.serviceCategory);
                                        setQuoteTierInput(o.tier || 'custom');
                                        setQuoteNotesInput(o.adminRevisionComments || '');
                                      }}
                                    >
                                      📋 Set Price &amp; Demand Payment
                                    </button>
                                    <button className="ad-pag-btn" onClick={() => setRelayOrder(o)}>💬 Chat</button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Quoted and active custom tabs */}
                      {(onDemandTab === 'quoted' || onDemandTab === 'all') && (
                        <div>
                          {(onDemandTab === 'quoted' ? quotedOrders : allCustom).length === 0 ? (
                            <div className="ad-assign-empty-card">
                              <p style={{ color: '#888' }}>No custom projects in this view.</p>
                            </div>
                          ) : (
                            <div className="ad-qc-grid">
                              {(onDemandTab === 'quoted' ? quotedOrders : allCustom).map(o => (
                                <div className="ad-qc-card" key={o.id}>
                                  <div className="ad-qc-header">
                                    <div>
                                      <h3 style={{ margin: 0, fontSize: 16 }}>Custom Order #WN-{o.id}</h3>
                                      <small style={{ color: '#888', fontSize: 12 }}>{o.serviceCategory}</small>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                      <b style={{ fontSize: 16, color: '#16a34a' }}>₹{o.price.toLocaleString()}</b>
                                      <div style={{ fontSize: 11, color: '#888' }}>Paid: ₹{(o.amountPaid || 0).toLocaleString()}</div>
                                    </div>
                                  </div>

                                  <p className="ad-qc-brief">{o.description || 'No brief specified.'}</p>
                                  {o.adminRevisionComments && (
                                    <div style={{ fontSize: 12, background: '#f1f5f9', padding: 8, borderRadius: 6, margin: '8px 0', color: '#475569' }}>
                                      <b>Admin Scope Note:</b> {o.adminRevisionComments}
                                    </div>
                                  )}

                                  <div className="ad-assign-order-meta" style={{ marginBottom: 14 }}>
                                    <span>Client: <b>{o.client?.name || `#${o.clientId}`}</b></span>
                                    <span>Status: <b className={`fd-status-pill ${o.status}`}>{o.status.replace('_', ' ').toUpperCase()}</b></span>
                                  </div>

                                  <div className="ad-qc-actions" style={{ display: 'flex', gap: 8 }}>
                                    <button
                                      className="ad-pag-btn"
                                      style={{ flex: 1 }}
                                      onClick={() => {
                                        setQuoteOrder(o);
                                        setQuotePriceInput(o.price);
                                        setQuoteCategoryInput(o.serviceCategory);
                                        setQuoteTierInput(o.tier || 'custom');
                                        setQuoteNotesInput(o.adminRevisionComments || '');
                                      }}
                                    >
                                      ✏️ Update Quote Price
                                    </button>
                                    <button className="ad-pag-btn" onClick={() => setRelayOrder(o)}>💬 Chat</button>
                                    {!o.freelancerId && ['paid', 'paid_50', 'paid_75'].includes(o.status) && (
                                       <button
                                         className="ad-btn-primary"
                                         onClick={() => openAssignModal(o)}
                                       >
                                         🎯 Assign Specialist
                                       </button>
                                     )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}

            {/* ════ VIEW: ASSIGN DESK ════ */}
            {currentView === 'assign' && (
              <>
                <div className="ad-view-header">
                  <p>Production Assignments</p>
                  <h1>Assign Desk</h1>
                  <p style={{ color: '#888', fontSize: 13, marginTop: 4 }}>
                    Assign tasks to a single specialist or broadcast to multiple specialists on a <b>First-Come, First-Served (FCFS)</b> basis with project duration &amp; deadlines.
                  </p>
                </div>

                {(() => {
                  const unassignedOrders = orders.filter(o => !o.freelancerId && ['paid', 'paid_50', 'paid_75', 'pending_payment'].includes(o.status));
                  const assignedOrders = orders.filter(o => Boolean(o.freelancerId) || ['assigned', 'midpoint_submitted', 'midpoint_approved', 'submitted', 'qa_approved', 'revision_requested'].includes(o.status));

                  return (
                    <div>
                      {/* Sub Tabs */}
                      <div className="ad-assign-tabs">
                        <button
                          className={`ad-assign-tab-btn ${assignDeskTab === 'pending' ? 'active' : ''}`}
                          onClick={() => setAssignDeskTab('pending')}
                        >
                          <span>🎯 Awaiting Assignment</span>
                          <span className="ad-assign-tab-badge">{unassignedOrders.length}</span>
                        </button>
                        <button
                          className={`ad-assign-tab-btn ${assignDeskTab === 'assigned' ? 'active' : ''}`}
                          onClick={() => setAssignDeskTab('assigned')}
                        >
                          <span>👥 Active Specialist Tasks</span>
                          <span className="ad-assign-tab-badge">{assignedOrders.length}</span>
                        </button>
                      </div>

                      {/* TAB 1: PENDING ASSIGNMENT */}
                      {assignDeskTab === 'pending' && (
                        <div>
                          {unassignedOrders.length === 0 ? (
                            <div className="ad-assign-empty-card">
                              <div style={{ fontSize: 36, marginBottom: 12 }}>🎉</div>
                              <h3 style={{ fontSize: 18, marginBottom: 6 }}>All active client orders are assigned!</h3>
                              <p style={{ color: '#888', fontSize: 14, maxWidth: 440, margin: '0 auto 16px' }}>
                                There are currently no unassigned paid projects. Switch to the "Active Specialist Tasks" tab to review or reassign ongoing deliverables.
                              </p>
                              <button className="ad-btn-secondary" onClick={() => setAssignDeskTab('assigned')}>
                                View Active Assigned Tasks ({assignedOrders.length})
                              </button>
                            </div>
                          ) : (
                            (() => {
                              // Group unassigned orders by service category
                              const grouped: Record<string, typeof unassignedOrders> = {};
                              unassignedOrders.forEach(o => {
                                const cat = o.serviceCategory || 'Uncategorized';
                                if (!grouped[cat]) grouped[cat] = [];
                                grouped[cat].push(o);
                              });

                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                                  {Object.entries(grouped).map(([category, catOrders]) => {
                                    // Freelancers who have this category in their services
                                    const matchedFreelancers = freelancers.filter(f =>
                                      (f.services || []).some(s =>
                                        s.toLowerCase().includes(category.toLowerCase()) ||
                                        category.toLowerCase().includes(s.toLowerCase())
                                      )
                                    );

                                    return (
                                      <div key={category} className="ad-assign-category-group">
                                        {/* Category header */}
                                        <div className="ad-assign-cat-header">
                                          <div className="ad-assign-cat-title">
                                            <span className="ad-assign-cat-icon">📂</span>
                                            <span>{category}</span>
                                            <span className="ad-assign-cat-badge">{catOrders.length} unassigned order{catOrders.length > 1 ? 's' : ''}</span>
                                          </div>
                                          <div className="ad-assign-cat-meta">
                                            {matchedFreelancers.length > 0 ? (
                                              <span className="ad-assign-match-pill matched">
                                                ✓ {matchedFreelancers.length} matched specialist{matchedFreelancers.length > 1 ? 's' : ''}
                                              </span>
                                            ) : (
                                              <span className="ad-assign-match-pill none">
                                                ⚠ {freelancers.length > 0 ? 'No exact keyword match (all freelancers available in dropdown)' : 'No freelancers registered'}
                                              </span>
                                            )}
                                          </div>
                                        </div>

                                        {/* Matched freelancer chips */}
                                        {matchedFreelancers.length > 0 ? (
                                          <div className="ad-assign-freelancer-chips">
                                            {matchedFreelancers.map(f => (
                                              <div key={f.id} className="ad-assign-freelancer-chip">
                                                <span className="ad-assign-chip-avatar">{f.name.charAt(0).toUpperCase()}</span>
                                                <div>
                                                  <div className="ad-assign-chip-name">{f.name}</div>
                                                  <div className="ad-assign-chip-skills">
                                                    {(f.services || []).slice(0, 3).join(' · ')}
                                                  </div>
                                                </div>
                                                <span className="ad-assign-chip-matched">Expert ✓</span>
                                              </div>
                                            ))}
                                          </div>
                                        ) : freelancers.length === 0 ? (
                                          <div style={{ padding: '12px 18px', background: '#fef2f2', borderBottom: '1px solid #fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <span style={{ fontSize: 13, color: '#991b1b' }}>⚠️ No freelancers found in the system roster.</span>
                                            <button className="ad-btn-primary" style={{ padding: '6px 14px', fontSize: 12 }} onClick={() => setOnboardingOpen(true)}>+ Quick Onboard Freelancer</button>
                                          </div>
                                        ) : null}

                                        {/* Order cards in this category */}
                                        <div className="ad-qc-grid">
                                          {catOrders.map(o => (
                                            <div className="ad-qc-card" key={o.id} style={o.declineReason ? { borderColor: '#fca5a5' } : {}}>
                                              <div className="ad-qc-header">
                                                <div>
                                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <h3 style={{ margin: 0, fontSize: 16 }}>Order #WN-{o.id}</h3>
                                                    {o.declineReason && (
                                                      <span style={{ fontSize: 10, fontWeight: 800, color: '#dc2626', background: '#fee2e2', padding: '2px 6px', borderRadius: 4, border: '1px solid #f87171' }}>
                                                        DECLINED
                                                      </span>
                                                    )}
                                                  </div>
                                                  <small style={{ color: '#888', fontSize: 12 }}>{o.serviceCategory}</small>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                  <b style={{ fontSize: 16, color: '#16a34a' }}>₹{o.price.toLocaleString()}</b>
                                                  <div style={{ fontSize: 11, color: '#888' }}>Tier: {o.tier?.toUpperCase() || 'STANDARD'}</div>
                                                </div>
                                              </div>
                                              <p className="ad-qc-brief">{o.description || 'No brief details provided.'}</p>

                                              {/* Timeline and Deadline badge if set by client or admin */}
                                              {(o.deadline || o.durationValue) && (
                                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0', fontSize: 12 }}>
                                                  {o.durationValue && (
                                                    <span style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>
                                                      ⏱️ Time Limit: {o.durationValue} {o.durationUnit || 'days'}
                                                    </span>
                                                  )}
                                                  {o.deadline && (
                                                    <span style={{ background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>
                                                      📅 End Date: {new Date(o.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                  )}
                                                </div>
                                              )}

                                               <div className="ad-assign-order-meta" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px', fontSize: 11.5, background: '#f8fafc', padding: '8px 10px', borderRadius: 6, margin: '8px 0' }}>
                                                 <div>Client: <b>{o.client?.name || `#${o.clientId}`}</b></div>
                                                 <div>Status: <span className={`fd-status-pill ${o.status}`} style={{ fontSize: 10 }}>{o.status.replace('_', ' ').toUpperCase()}</span></div>
                                                 <div style={{ color: '#475569', gridColumn: 'span 2' }}>
                                                   📅 <b>Order Placed:</b> {o.createdAt ? new Date(o.createdAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                                                 </div>
                                               </div>

                                              {/* Notice text if specified */}
                                              {o.projectNotice && (
                                                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: '#92400e', marginBottom: 8 }}>
                                                  <b>📝 Client Notice:</b> {o.projectNotice}
                                                </div>
                                              )}

                                              {/* Decline Notice Banner if previously rejected */}
                                              {o.declineReason && (
                                                <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '8px 10px', fontSize: 12, color: '#991b1b', margin: '8px 0' }}>
                                                  <b>⚠️ Declined by {o.declinedBy || 'Specialist'}:</b> "{o.declineReason}"
                                                  {o.declinedAt && <div style={{ fontSize: 10.5, color: '#b91c1c', marginTop: 2 }}>Declined on: {new Date(o.declinedAt).toLocaleString()}</div>}
                                                </div>
                                              )}
                                              <div className="ad-qc-actions">
                                                <button
                                                  className="ad-btn-primary"
                                                  onClick={() => openAssignModal(o)}
                                                >
                                                  {o.declineReason ? '🔄 Re-Assign to New Specialist(s)' : '🎯 Assign / FCFS Multi-Offer'}
                                                </button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()
                          )}
                        </div>
                      )}

                      {/* TAB 2: ACTIVE ASSIGNMENTS */}
                      {assignDeskTab === 'assigned' && (
                        <div>
                          {assignedOrders.length === 0 ? (
                            <div className="ad-assign-empty-card">
                              <h3 style={{ fontSize: 18, marginBottom: 6 }}>No tasks currently in production</h3>
                              <p style={{ color: '#888', fontSize: 14 }}>Assign tasks from the "Awaiting Assignment" tab to start production.</p>
                            </div>
                          ) : (
                            <div className="ad-qc-grid">
                              {assignedOrders.map(o => {
                                const isPendingAcceptance = o.assignmentStatus === 'pending_acceptance';
                                let candidateNames = '';
                                if (o.assignedFreelancers && o.assignedFreelancers.length > 0) {
                                  candidateNames = o.assignedFreelancers.map(f => f.name).join(', ');
                                }
                                return (
                                  <div className="ad-qc-card" key={o.id}>
                                    <div className="ad-qc-header">
                                      <div>
                                        <h3>Order #WN-{o.id}</h3>
                                        <small style={{ color: '#888' }}>{o.serviceCategory} ({o.tier?.toUpperCase() || 'STANDARD'})</small>
                                      </div>
                                      <span className="ad-assign-assigned-badge" style={isPendingAcceptance ? { background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' } : {}}>
                                        {isPendingAcceptance ? (
                                          `⚡ FCFS Multi-Offer (${o.assignedFreelancers?.length || 1} Invited)`
                                        ) : (
                                          `👤 ${o.freelancer?.name || `Specialist #${o.freelancerId}`}`
                                        )}
                                      </span>
                                    </div>
                                    <p className="ad-qc-brief">{o.description || 'No brief provided.'}</p>

                                    {/* Timeline and Deadline */}
                                    {(o.deadline || o.durationValue) && (
                                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '6px 0', fontSize: 12 }}>
                                        {o.durationValue && (
                                          <span style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '2px 7px', borderRadius: 5, fontWeight: 600 }}>
                                            ⏱️ {o.durationValue} {o.durationUnit || 'days'}
                                          </span>
                                        )}
                                        {o.deadline && (
                                          <span style={{ background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', padding: '2px 7px', borderRadius: 5, fontWeight: 600 }}>
                                            📅 Due: {new Date(o.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                        )}
                                      </div>
                                    )}

                                     <div className="ad-assign-order-meta" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px', fontSize: 11.5, background: '#f8fafc', padding: '8px 10px', borderRadius: 6, margin: '8px 0' }}>
                                       <div>Client: <b>{o.client?.name || `#${o.clientId}`}</b></div>
                                       <div>Agreed Payout: <b style={{ color: '#16a34a' }}>₹{(o.freelancerPayoutAmount || 0).toLocaleString()}</b></div>
                                       <div style={{ color: '#475569' }}>
                                         📅 <b>Placed:</b> {o.createdAt ? new Date(o.createdAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                                       </div>
                                       <div style={{ color: '#2563eb' }}>
                                         🎯 <b>Assigned:</b> {o.assignedAt ? new Date(o.assignedAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : (o.updatedAt ? new Date(o.updatedAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recently')}
                                       </div>
                                     </div>

                                    {/* Project Notice */}
                                    {o.projectNotice && (
                                      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '5px 8px', fontSize: 11.5, color: '#92400e', marginBottom: 6 }}>
                                        <b>📝 Notice:</b> {o.projectNotice}
                                      </div>
                                    )}

                                    {/* Candidate list if FCFS pending */}
                                    {isPendingAcceptance && candidateNames && (
                                      <div style={{ fontSize: 11.5, color: '#64748b', background: '#f8fafc', padding: '5px 8px', borderRadius: 5, border: '1px solid #e2e8f0', marginBottom: 8 }}>
                                        <b>⚡ Invited Candidates:</b> {candidateNames}
                                      </div>
                                    )}
                                     <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                        <span className={`fd-status-pill ${o.status}`}>{o.status.replace('_', ' ').toUpperCase()}</span>
                                        {isPendingAcceptance ? (
                                          <span style={{ fontSize: 10.5, fontWeight: 800, color: '#b45309', background: '#fef3c7', padding: '2px 7px', borderRadius: 4, border: '1px solid #f59e0b', textTransform: 'uppercase' }}>
                                            ⏳ Awaiting Specialist Acceptance (FCFS)
                                          </span>
                                        ) : (
                                          <span style={{ fontSize: 10.5, fontWeight: 800, color: '#15803d', background: '#dcfce7', padding: '2px 7px', borderRadius: 4, border: '1px solid #86efac', textTransform: 'uppercase' }}>
                                            ✓ In Production
                                          </span>
                                        )}
                                      </div>
                                      {o.midpointSubmissionLink && <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>✓ 50% Midpoint uploaded</span>}
                                    </div>
                                    <div className="ad-qc-actions" style={{ display: 'flex', gap: 8 }}>
                                      <button
                                        className="ad-btn-primary"
                                        style={{ flex: 1 }}
                                        onClick={() => openAssignModal(o)}
                                      >
                                        🔄 Re-assign / Invite Candidates
                                      </button>
                                      <button className="ad-pag-btn" onClick={() => setRelayOrder(o)}>💬 Chat</button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}

            {/* ════ VIEW: INTERNAL QC GATE ════ */}
            {currentView === 'qc' && (
              <>
                <div className="ad-view-header">
                  <p>Quality Control Room</p>
                  <h1>Internal QC Gate</h1>
                </div>
                {orders.filter(o => o.status === 'submitted').length === 0 ? (
                  <p style={{ color: '#888', textAlign: 'center', padding: 40 }}>Internal QC gate queue is currently empty.</p>
                ) : (
                  <div className="ad-qc-grid">
                    {orders.filter(o => o.status === 'submitted').map(o => (
                      <div className="ad-qc-card" key={o.id}>
                        <div className="ad-qc-header">
                          <h3>QA Review Queue · Order #WN-{o.id}</h3>
                          <span>Freelancer: <b>{o.freelancer?.name}</b></span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <div>
                            <label className="ad-form-label">Original Brief</label>
                            <div className="ad-qc-brief">{o.description}</div>
                          </div>
                          <div>
                            <label className="ad-form-label">Submission Asset Link</label>
                            <div className="ad-qc-brief"><a href={o.submissionLink} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>{o.submissionLink} ↗</a></div>
                          </div>
                        </div>
                        <div className="ad-qc-actions">
                          <button className="ad-btn-primary" onClick={() => setQaOrder(o)}>Start Quality Evaluation Gate</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ════ VIEW: REVISIONS ════ */}
            {currentView === 'disputes' && (
              <>
                <div className="ad-view-header">
                  <p>Workflow Disputes</p>
                  <h1>Dispute / Revision Desk</h1>
                </div>
                {orders.filter(o => o.status === 'revision_requested').length === 0 ? (
                  <p style={{ color: '#888', textAlign: 'center', padding: 40 }}>No active revision requests from clients.</p>
                ) : (
                  <div className="ad-table-wrap">
                    <table className="ad-table">
                      <thead>
                        <tr><th>Order ID</th><th>Service Category</th><th>Client</th><th>Freelancer</th><th>Revision comments</th><th>Actions</th></tr>
                      </thead>
                      <tbody>
                        {orders.filter(o => o.status === 'revision_requested').map(o => (
                          <tr key={o.id}>
                            <td><b>#WN-{o.id}</b></td>
                            <td>{o.serviceCategory}</td>
                            <td>{o.client?.name}</td>
                            <td>{o.freelancer?.name}</td>
                            <td style={{ color: '#991b1b' }}>"{o.adminRevisionComments}"</td>
                            <td><button className="ad-pag-btn" onClick={() => setRelayOrder(o)}>Relay Chat 💬</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* ════ VIEW: CLIENTS CRM SPREADSHEET ════ */}
            {currentView === 'clients' && (
              <>
                <div className="ad-view-header">
                  <p>CRM intelligence</p>
                  <h1>Clients Directory Grid</h1>
                </div>

                <div className="ad-grid-controls">
                  <div className="ad-grid-search">
                    <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 13, height: 13 }}><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
                    <input type="search" placeholder="Search Name, Email, Phone..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} />
                  </div>
                  <select className="ad-grid-select" value={clientSort} onChange={e => setClientSort(e.target.value)}>
                    <option value="ltv-high">Sort: LTV (High to Low)</option>
                    <option value="orders-high">Sort: Total Orders (High to Low)</option>
                  </select>
                  <button className="ad-export-btn" onClick={exportClientsToExcel} style={{ background: '#10b981', color: '#fff', fontWeight: 700, border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer' }}>
                    📊 Download Clients Sheet (Excel .CSV)
                  </button>
                </div>

                <div className="ad-table-wrap">
                  <table className="ad-table">
                    <thead>
                      <tr><th>Client &amp; Org</th><th>Contact Info</th><th>Total Orders</th><th>Active Tasks</th><th>Lifetime Value</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {filteredClientRows.map(c => (
                        <tr
                          key={c.email}
                          onClick={() => setSelectedClientModal(c)}
                          style={{ cursor: 'pointer' }}
                          title="Click row to inspect enterprise client profile, projects & activity history"
                        >
                          <td>
                            <button
                              className="ad-client-link"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedClientModal(c);
                              }}
                            >
                              🏢 {c.name} <span style={{ fontSize: 11, color: '#2563eb' }}>↗</span>
                            </button>
                          </td>
                          <td>
                            <div><b>{c.email}</b></div>
                            {c.phone && c.phone !== '—' ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>📞 {c.phone}</span>
                                <a
                                  href={`https://wa.me/${c.phone.replace(/[^\d]/g, '')}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  style={{ fontSize: 10, background: '#25D366', color: '#fff', padding: '1px 6px', borderRadius: 4, textDecoration: 'none', fontWeight: 700 }}
                                >
                                  WhatsApp 💬
                                </a>
                              </div>
                            ) : (
                              <small style={{ color: '#94a3b8' }}>No phone recorded</small>
                            )}
                          </td>
                          <td>{c.totalOrders} Orders</td>
                          <td>{c.activeTasks} Active</td>
                          <td><b>₹{c.ltv.toLocaleString('en-IN')}</b></td>
                          <td>
                            <span className={c.status === 'Active' ? 'ad-status-dot-active' : c.status === 'Suspended' ? 'ad-status-dot-dormant' : 'ad-status-dot-dormant'}>
                              {c.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* ════ VIEW: FREELANCERS CRM SPREADSHEET (BOOSTER DIRECTORY) ════ */}
            {currentView === 'freelancers' && (
              <>
                <div className="ad-view-header">
                  <p>Specialist Talent &amp; Resource Directory</p>
                  <h1>Freelancer Directory Grid</h1>
                </div>

                <div className="ad-grid-controls">
                  <div className="ad-grid-search">
                    <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 13, height: 13 }}><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
                    <input type="search" placeholder="Search Name, Email, Phone, Skill..." value={flSearch} onChange={e => setFlSearch(e.target.value)} />
                  </div>
                  <select className="ad-grid-select" value={flFilterSkill} onChange={e => setFlFilterSkill(e.target.value)}>
                    <option value="all">Filter: All Vetted Skills</option>
                    <option value="web">Web Development</option>
                    <option value="design">Graphic Designing</option>
                    <option value="video">Video Editing</option>
                    <option value="3d">3D Design &amp; Modeling</option>
                    <option value="vfx">VFX &amp; Animation</option>
                    <option value="ai">AI Services</option>
                    <option value="software">Software &amp; App Development</option>
                    <option value="marketing">Digital Marketing</option>
                  </select>
                  <select className="ad-grid-select" value={flSort} onChange={e => setFlSort(e.target.value)}>
                    <option value="earnings-high">Sort: Settled Earnings (High to Low)</option>
                    <option value="tasks-high">Sort: Total Tasks (High to Low)</option>
                    <option value="active-high">Sort: Active Tasks (High to Low)</option>
                  </select>
                  <button className="ad-export-btn" onClick={exportFreelancersToExcel} style={{ background: '#10b981', color: '#fff', fontWeight: 700, border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer' }}>
                    📊 Download Freelancers Sheet (Excel .CSV)
                  </button>
                  {isMaster && <button className="ad-export-btn" onClick={() => setOnboardingOpen(true)}>+ Onboard Freelancer</button>}
                </div>

                <div className="ad-table-wrap">
                  <table className="ad-table">
                    <thead>
                      <tr>
                        <th>Specialist &amp; Profile</th>
                        <th>Contact Info</th>
                        <th>Vetted Skills</th>
                        <th>Assigned Tasks</th>
                        <th>Active Production</th>
                        <th>Lifetime Earnings</th>
                        <th>Account Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFreelancers.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', color: '#888', padding: 32 }}>
                            No specialist freelancers found matching your filter criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredFreelancers.map(f => (
                          <tr
                            key={f.id}
                            onClick={() => setSelectedFreelancerModal(f)}
                            style={{ cursor: 'pointer' }}
                            title="Click row to inspect specialist profile, tasks & earnings history"
                          >
                            <td>
                              <button
                                className="ad-client-link"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedFreelancerModal(f);
                                }}
                              >
                                👨‍💻 {f.name} <span style={{ fontSize: 11, color: '#2563eb' }}>↗</span>
                              </button>
                            </td>
                            <td>
                              <div><b>{f.email}</b></div>
                              {f.phone && f.phone !== '—' ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                  <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>📞 {f.phone}</span>
                                  <a
                                    href={`https://wa.me/${f.phone.replace(/[^\d]/g, '')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    style={{ fontSize: 10, background: '#25D366', color: '#fff', padding: '1px 6px', borderRadius: 4, textDecoration: 'none', fontWeight: 700 }}
                                  >
                                    WhatsApp 💬
                                  </a>
                                </div>
                              ) : (
                                <small style={{ color: '#94a3b8' }}>No phone recorded</small>
                              )}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {f.services.length > 0 ? (
                                  f.services.map(s => <span className="fd-tech-pill" key={s} style={{ fontSize: 10 }}>{s}</span>)
                                ) : (
                                  <span style={{ fontSize: 11, color: '#94a3b8' }}>General Specialist</span>
                                )}
                              </div>
                            </td>
                            <td>{f.totalTasks} Task{f.totalTasks === 1 ? '' : 's'}</td>
                            <td>
                              <span className={f.activeTasks > 0 ? 'fd-status-pill submitted' : 'ad-status-dot-dormant'} style={{ fontSize: 11 }}>
                                {f.activeTasks} Active
                              </span>
                            </td>
                            <td><b>₹{f.totalEarnings.toLocaleString('en-IN')}</b></td>
                            <td>
                              <span className={f.status === 'Active' ? 'ad-status-dot-active' : 'ad-status-dot-dormant'}>
                                {f.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* ════ VIEW: RAZORPAY FINANCIALS ════ */}
            {currentView === 'financials' && (
              <>
                <div className="ad-view-header">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p>Payment Gateway &amp; Revenue Operations</p>
                      <h1>💳 Razorpay &amp; Financial Control Panel</h1>
                    </div>
                    <button
                      className="ad-btn-primary"
                      onClick={exportFinancialsToExcel}
                      style={{ background: '#10b981', color: '#fff', fontWeight: 700, border: 'none', borderRadius: 8, padding: '10px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      📊 Download Financial Ledger (Excel .CSV)
                    </button>
                  </div>
                </div>

                {/* Financial KPIs */}
                <div className="ad-kpi-grid" style={{ marginBottom: 24 }}>
                  <div className="ad-kpi-card">
                    <small>Total Razorpay Volume</small>
                    <strong style={{ color: '#6366f1' }}>₹{(financials?.summary?.totalCollected || 0).toLocaleString('en-IN')}</strong>
                  </div>
                  <div className="ad-kpi-card">
                    <small>Specialist Payouts Settled</small>
                    <strong style={{ color: '#10b981' }}>₹{(financials?.summary?.totalPayoutsReleased || 0).toLocaleString('en-IN')}</strong>
                  </div>
                  <div className="ad-kpi-card">
                    <small>Escrow &amp; Pending Payouts</small>
                    <strong style={{ color: '#f59e0b' }}>₹{(financials?.summary?.pendingEscrowPayouts || 0).toLocaleString('en-IN')}</strong>
                  </div>
                  <div className="ad-kpi-card">
                    <small>Net Platform Margin</small>
                    <strong style={{ color: '#38bdf8' }}>₹{(financials?.summary?.netPlatformRevenue || 0).toLocaleString('en-IN')}</strong>
                  </div>
                </div>

                {/* Transactions Table */}
                <div className="ad-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Razorpay Payment Receipts &amp; Audit Stream</h3>
                    <span style={{ fontSize: 13, color: '#94a3b8' }}>
                      {financials?.summary?.totalTransactions || 0} Transactions Recorded
                    </span>
                  </div>
                  <div className="ad-table-wrap">
                    <table className="ad-table">
                      <thead>
                        <tr>
                          <th>Order ID</th>
                          <th>Client Details</th>
                          <th>Service &amp; Tier</th>
                          <th>Gross Paid</th>
                          <th>Razorpay Payment ID</th>
                          <th>Transaction Date</th>
                          <th>Lifecycle Status</th>
                          <th>Payout Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(financials?.transactions || []).length === 0 ? (
                          <tr><td colSpan={8} style={{ textAlign: 'center', color: '#888', padding: 30 }}>No transactions recorded yet.</td></tr>
                        ) : (
                          (financials?.transactions || []).map((t: any) => (
                            <tr key={t.id}>
                              <td><b>#WN-{t.id}</b></td>
                              <td>
                                <div><b>{t.client?.name || 'Client'}</b></div>
                                <small style={{ color: '#888' }}>{t.client?.email || ''}</small>
                              </td>
                              <td>
                                <div>{t.serviceCategory}</div>
                                <span style={{ fontSize: 11, color: '#38bdf8', textTransform: 'uppercase', fontWeight: 700 }}>{t.tier}</span>
                              </td>
                              <td><b style={{ color: '#10b981' }}>₹{t.price.toLocaleString('en-IN')}</b></td>
                              <td>
                                <code style={{ background: '#1e2230', color: '#a5b4fc', padding: '4px 8px', borderRadius: 4, fontSize: 12, border: '1px solid #2e344a' }}>
                                  {t.paymentId}
                                </code>
                              </td>
                              <td><small>{t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-IN') : 'Recent'}</small></td>
                              <td>
                                <span className={`ad-status-pill ${t.status}`}>
                                  {t.status.replace('_', ' ').toUpperCase()}
                                </span>
                              </td>
                              <td>
                                {t.status === 'client_approved' && (
                                  <button
                                    className="ad-btn-primary"
                                    style={{ background: '#059669', fontSize: 11, padding: '5px 10px' }}
                                    onClick={() => handlePayoutRelease(t.id)}
                                  >
                                    Release ₹{t.freelancerPayoutAmount?.toLocaleString('en-IN')}
                                  </button>
                                )}
                                {t.status === 'delivered' && (
                                  <span style={{ color: '#10b981', fontSize: 12, fontWeight: 700 }}>✓ Settled</span>
                                )}
                                {t.status !== 'client_approved' && t.status !== 'delivered' && (
                                  <span style={{ color: '#888', fontSize: 12 }}>In Milestone</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* ════ VIEW: PAYOUTS BATCH ════ */}
            {currentView === 'payouts' && (
              <>
                <div className="ad-view-header">
                  <p>Settlement &amp; Regulation Desk</p>
                  <h1>Admin-Regulated Specialist Payouts</h1>
                </div>
                {orders.filter(o => ['qa_approved', 'client_approved', 'completed', 'delivered'].includes(o.status)).length === 0 ? (
                  <p style={{ color: '#888', textAlign: 'center', padding: 40 }}>All specialist payouts have been audited and settled.</p>
                ) : (
                  <div className="ad-table-wrap">
                    <table className="ad-table">
                      <thead>
                        <tr>
                          <th>Order ID</th>
                          <th>Service &amp; Tier</th>
                          <th>Assigned Specialist</th>
                          <th>Client Status</th>
                          <th>Editable Payout Fee (INR)</th>
                          <th>Regulation Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.filter(o => ['qa_approved', 'client_approved', 'completed', 'delivered'].includes(o.status)).map(o => {
                          const isReleased = o.payoutStatus === 'payout_released' || ['completed', 'delivered'].includes(o.status);
                          const isApproved = o.payoutStatus === 'payout_approved';
                          return (
                            <tr key={o.id}>
                              <td><b>#WN-{o.id}</b></td>
                              <td>
                                <b>{o.serviceCategory}</b>
                                <small style={{ display: 'block', color: '#6366f1' }}>{o.tier?.toUpperCase() || 'STANDARD'}</small>
                              </td>
                              <td>
                                <b>{o.freelancer?.name || 'Assigned Specialist'}</b>
                                <small style={{ display: 'block', color: '#888' }}>{o.freelancer?.email}</small>
                              </td>
                              <td>
                                <span className={`ad-status-pill ${o.status}`}>
                                  {o.status === 'client_approved' ? 'CLIENT APPROVED 🎉' : o.status.replace('_', ' ').toUpperCase()}
                                </span>
                              </td>
                              <td>
                                {!isReleased ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ color: '#888', fontWeight: 600 }}>₹</span>
                                    <input
                                      type="number"
                                      defaultValue={o.freelancerPayoutAmount || 0}
                                      id={`payout-input-${o.id}`}
                                      style={{
                                        width: 100,
                                        padding: '4px 8px',
                                        borderRadius: 4,
                                        border: '1px solid #cbd5e1',
                                        fontSize: 13,
                                        fontWeight: 700
                                      }}
                                    />
                                    <button
                                      style={{
                                        background: '#334155',
                                        color: '#ffffff',
                                        border: 'none',
                                        padding: '4px 8px',
                                        borderRadius: 4,
                                        fontSize: 11,
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                      }}
                                      onClick={() => {
                                        const el = document.getElementById(`payout-input-${o.id}`) as HTMLInputElement;
                                        if (el) {
                                          handleUpdatePayoutAmount(o.id, Number(el.value));
                                        }
                                      }}
                                    >
                                      Save ✏️
                                    </button>
                                  </div>
                                ) : (
                                  <b style={{ color: '#10b981' }}>₹{o.freelancerPayoutAmount?.toLocaleString('en-IN')}</b>
                                )}
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                  {!isReleased && !isApproved && (
                                    <button
                                      style={{ background: '#4f46e5', color: '#ffffff', border: 'none', padding: '6px 12px', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                                      onClick={() => handleApprovePayout(o.id)}
                                    >
                                      🛡️ Approve Payout
                                    </button>
                                  )}
                                  {!isReleased ? (
                                    <button
                                      style={{ background: '#10b981', color: '#ffffff', border: 'none', padding: '6px 12px', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                                      onClick={() => handlePayoutRelease(o.id)}
                                    >
                                      💰 Release / Disburse Payout
                                    </button>
                                  ) : (
                                    <span style={{ fontSize: 12, color: '#10b981', fontWeight: 700, padding: '4px 8px', background: '#dcfce7', borderRadius: 4 }}>
                                      ✓ Payout Disbursed
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* ════ VIEW: INVOICES TAX ════ */}
            {currentView === 'invoices' && (
              <>
                <div className="ad-view-header">
                  <p>Billing &amp; Tax Compliance</p>
                  <h1>GST Invoices Generator</h1>
                </div>
                <div className="ad-table-wrap">
                  <table className="ad-table">
                    <thead>
                      <tr><th>Invoice ID</th><th>Related Order</th><th>Client Company</th><th>Gross Collection</th><th>GST Claimable (18%)</th><th>Invoice PDF</th></tr>
                    </thead>
                    <tbody>
                      {orders.map((o) => {
                        const inv = `WN-INV-2026-${String(o.id).padStart(4, '0')}`;
                        return (
                          <tr key={o.id}>
                            <td><b>{inv}</b></td>
                            <td>Order #WN-{o.id}</td>
                            <td>{o.client?.name || 'Valued Client'}</td>
                            <td>₹{o.price.toLocaleString('en-IN')}</td>
                            <td>₹{Math.round(o.price * 0.18).toLocaleString('en-IN')}</td>
                            <td>
                              <button
                                className="ad-pag-btn"
                                style={{ background: '#4f46e5', color: '#ffffff', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                onClick={() => {
                                  downloadClientInvoicePDF({
                                    orderId: o.id,
                                    clientName: o.client?.name || 'Valued Client',
                                    clientEmail: o.client?.email || 'client@workonova.com',
                                    clientPhone: o.client?.phone || '',
                                    serviceCategory: o.serviceCategory,
                                    tier: o.tier || 'STANDARD',
                                    totalPrice: o.price,
                                    amountPaid: o.amountPaid || o.price,
                                    milestoneStage: o.milestoneStage || 3,
                                    date: new Date(o.createdAt).toLocaleDateString('en-IN'),
                                  });
                                  setSuccess(`📄 Downloaded Tax Invoice ${inv}.pdf`);
                                }}
                              >
                                📄 Export PDF
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* ════ VIEW: TESTIMONIALS QUEUE ════ */}
            {currentView === 'testimonials' && (
              <>
                <div className="ad-view-header">
                  <p>CMS Feedback queue</p>
                  <h1>Testimonials Approvals</h1>
                </div>
                <div className="ad-qc-grid">
                  {testimonials.map(t => (
                    <div className="ad-qc-card" key={t.id}>
                      <div className="ad-qc-header">
                        <h3>{t.name} · {t.role}</h3>
                        <b>Rating: {t.stars}/5 ⭐</b>
                      </div>
                      <p className="ad-qc-brief">"{t.quote}"</p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                        <span className={`fd-status-pill ${t.status === 'pending' ? 'submitted' : t.status === 'approved' ? 'qa_approved' : 'cancelled'}`}>{t.status.toUpperCase()}</span>
                        {t.status === 'pending' && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="ad-btn-primary" onClick={() => handleTestimonialApprove(t.id, true)}>Approve &amp; Showcase</button>
                            <button className="ad-btn-secondary" onClick={() => handleTestimonialApprove(t.id, false)}>Reject</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ════ VIEW: LANDING PAGE BLOGS ════ */}
            {currentView === 'blogs' && (
              <>
                <div className="ad-view-header">
                  <p>Landing page content manager</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h1>Landing Page Blogs</h1>
                    {isMaster && (
                      <button className="ad-btn-primary" onClick={() => {
                        setEditingBlog(null);
                        setBlogForm({ title: '', author: 'Workonova Editorial', content: '', publishedAt: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) });
                        setBlogModalOpen(true);
                      }}>+ Create Blog Post</button>
                    )}
                  </div>
                </div>

                <div className="ad-table-wrap">
                  <table className="ad-table">
                    <thead>
                      <tr><th>Title</th><th>Author</th><th>Date</th><th>Preview Content</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {blogsList.map(b => (
                        <tr key={b.id}>
                          <td><b>{b.title}</b></td>
                          <td>{b.author}</td>
                          <td>{b.publishedAt || b.published_at}</td>
                          <td><span style={{ display: 'inline-block', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.content}</span></td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {isMaster && <button className="ad-pag-btn active" onClick={() => {
                                setEditingBlog(b);
                                setBlogForm({ title: b.title, author: b.author, content: b.content, publishedAt: b.publishedAt || b.published_at });
                                setBlogModalOpen(true);
                              }}>Edit</button>}
                              {isMaster && <button className="ad-pag-btn" onClick={() => handleBlogDelete(b.id)}>Delete</button>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* ════ VIEW: PRICING BUNDLES ════ */}
            {currentView === 'bundles' && (
              <>
                <div className="ad-view-header">
                  <p>Offer structure manager</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h1>Pricing Bundles</h1>
                    {isMaster && (
                      <button className="ad-btn-primary" onClick={() => {
                        setEditingBundle(null);
                        setBundleForm({ category: 'All Services', tag: '', name: '', description: '', price: '', period: '/ Monthly', features: [], popular: false });
                        setBundleModalOpen(true);
                      }}>+ Create Bundle</button>
                    )}
                  </div>
                </div>

                <div className="ad-table-wrap">
                  <table className="ad-table">
                    <thead>
                      <tr><th>Category &amp; Package</th><th>Price &amp; Cycle</th><th>Tag Label</th><th>Features Count</th><th>Popular Choice</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {bundlesList.map(b => {
                        const featuresList = typeof b.features === 'string' ? JSON.parse(b.features) : b.features;
                        return (
                          <tr key={b.id}>
                            <td><b>{b.name}</b> <span style={{ fontSize: 10, background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>{b.category || 'All Services'}</span><br/><span style={{ fontSize: 11, color: '#888' }}>{b.description}</span></td>
                            <td><b>₹{b.price}</b> {b.period}</td>
                            <td><span className="fd-tech-pill" style={{ fontSize: 10 }}>{b.tag}</span></td>
                            <td>{featuresList ? featuresList.length : 0} items</td>
                            <td>{b.popular === 1 ? '⭐ YES' : 'NO'}</td>
                            <td>
                              <div style={{ display: 'flex', gap: 6 }}>
                                {isMaster && <button className="ad-pag-btn active" onClick={() => {
                                  setEditingBundle(b);
                                  setBundleForm({
                                    category: b.category || 'All Services',
                                    tag: b.tag,
                                    name: b.name,
                                    description: b.description,
                                    price: b.price,
                                    period: b.period,
                                    features: featuresList || [],
                                    popular: b.popular === 1
                                  });
                                  setBundleModalOpen(true);
                                }}>Edit</button>}
                                {isMaster && <button className="ad-pag-btn" onClick={() => handleBundleDelete(b.id)}>Delete</button>}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* ════ VIEW: CLIENT MODAL BUNDLES & SERVICES MANAGER ════ */}
            {currentView === 'client_bundles' && (
              <>
                <div className="ad-view-header">
                  <p>Client Intake Modal &amp; Category Packages Manager</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h1>🎯 Client Modal Bundles &amp; Services</h1>
                    {isMaster && (
                      <button className="ad-btn-primary" onClick={() => {
                        setEditingBundle(null);
                        setBundleForm({ category: selectedClientBundleCat, tag: 'STARTER', name: `${selectedClientBundleCat} Starter`, description: '', price: '14999', period: '/ Monthly', features: [], popular: false });
                        setBundleModalOpen(true);
                      }}>+ Add Category Tier Package</button>
                    )}
                  </div>
                </div>

                {/* Service Category Selection Bar */}
                <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>📁 Select Service Category to Manage:</span>
                    <span style={{ fontSize: 11, background: '#f1f5f9', padding: '2px 8px', borderRadius: 12, color: '#64748b' }}>
                      Updates live client "Start New Project" modal
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[
                      'Website Development', 'Graphic Designing', 'Video Editing', 'App Development',
                      'AI Services', '3D Design & Modeling', 'VFX', 'Animation', 'Digital Marketing',
                      'Software Development', 'IT Services', 'Cyber Security', 'All Services'
                    ].map(cat => {
                      const isActive = selectedClientBundleCat === cat;
                      const count = bundlesList.filter(b => (b.category || 'All Services') === cat).length;
                      return (
                        <button
                          key={cat}
                          onClick={() => setSelectedClientBundleCat(cat)}
                          style={{
                            padding: '8px 14px',
                            borderRadius: 8,
                            border: isActive ? '2px solid #56c41a' : '1px solid #cbd5e1',
                            background: isActive ? '#f0fdf4' : '#f8fafc',
                            color: isActive ? '#15803d' : '#334155',
                            fontWeight: isActive ? 700 : 500,
                            cursor: 'pointer',
                            fontSize: 13,
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {cat} {count > 0 && <span style={{ fontSize: 10, background: isActive ? '#56c41a' : '#cbd5e1', color: '#fff', padding: '1px 6px', borderRadius: 10, marginLeft: 4 }}>{count}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Info banner */}
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: '#1e40af', fontSize: 13 }}>
                  💡 <b>Real-Time Client Sync:</b> Any package tier name, price, badge, description, or feature deliverable edited below for <b>{selectedClientBundleCat}</b> will immediately display in the Client Portal when a client clicks "Start New Project".
                </div>

                {/* Bundle Cards Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
                  {bundlesList
                    .filter(b => (b.category || 'All Services') === selectedClientBundleCat || b.category === 'All Services')
                    .map(b => {
                      const featuresList = typeof b.features === 'string' ? JSON.parse(b.features) : b.features;
                      return (
                        <div key={b.id} style={{ background: '#ffffff', border: b.popular === 1 ? '2px solid #56c41a' : '1px solid #e2e8f0', borderRadius: 12, padding: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <span style={{ fontSize: 10, fontWeight: 700, background: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: 4, letterSpacing: '0.5px' }}>
                                {b.tag || 'PACKAGE TIER'}
                              </span>
                              {b.popular === 1 && <span style={{ fontSize: 10, fontWeight: 700, background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: 4 }}>⭐ MOST POPULAR</span>}
                            </div>
                            <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', margin: '4px 0' }}>{b.name}</h3>
                            <div style={{ fontSize: 20, fontWeight: 800, color: '#56c41a', margin: '6px 0 10px' }}>
                              ₹{b.price} <span style={{ fontSize: 12, fontWeight: 400, color: '#64748b' }}>{b.period}</span>
                            </div>
                            <p style={{ fontSize: 12, color: '#64748b', lineHeight: '1.4', marginBottom: 14 }}>{b.description}</p>
                            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
                              <small style={{ fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>Deliverables Included:</small>
                              <ul style={{ paddingLeft: 16, marginTop: 6, fontSize: 12, color: '#334155', listStyleType: 'disc' }}>
                                {featuresList && Array.isArray(featuresList) && featuresList.map((f: string, idx: number) => (
                                  <li key={idx} style={{ marginBottom: 4 }}>{f}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 18, borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
                            {isMaster && (
                              <button
                                className="ad-btn-primary"
                                style={{ flex: 1, padding: '8px 12px', fontSize: 12 }}
                                onClick={() => {
                                  setEditingBundle(b);
                                  setBundleForm({
                                    category: b.category || selectedClientBundleCat,
                                    tag: b.tag,
                                    name: b.name,
                                    description: b.description,
                                    price: b.price,
                                    period: b.period,
                                    features: featuresList || [],
                                    popular: b.popular === 1
                                  });
                                  setBundleModalOpen(true);
                                }}
                              >
                                ✏️ Edit Package Tier
                              </button>
                            )}
                            {isMaster && (
                              <button
                                className="ad-btn-secondary"
                                style={{ padding: '8px 12px', fontSize: 12, color: '#b91c1c' }}
                                onClick={() => handleBundleDelete(b.id)}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  {bundlesList.filter(b => (b.category || 'All Services') === selectedClientBundleCat || b.category === 'All Services').length === 0 && (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', color: '#64748b' }}>
                      <p style={{ fontSize: 15, fontWeight: 600 }}>No custom bundle tiers configured for {selectedClientBundleCat} yet.</p>
                      <button
                        className="ad-btn-primary"
                        style={{ marginTop: 12 }}
                        onClick={() => {
                          setEditingBundle(null);
                          setBundleForm({ category: selectedClientBundleCat, tag: 'STARTER', name: `${selectedClientBundleCat} Starter`, description: '', price: '14999', period: '/ Monthly', features: [], popular: false });
                          setBundleModalOpen(true);
                        }}
                      >
                        + Create First Package Tier for {selectedClientBundleCat}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}


            {/* ════ VIEW: TEAM MEMBERS ════ */}
            {currentView === 'team' && (
              <>
                <div className="ad-view-header">
                  <p>Landing page leadership minds manager</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h1>Team Members Desk</h1>
                    {isMaster && (
                      <button className="ad-btn-primary" onClick={() => {
                        setEditingTeam(null);
                        setTeamForm({ name: '', role: '', subtitle: '', description: '', bio: '', uniqueFact: '', image: '', orderIndex: teamList.length + 1 });
                        setTeamModalOpen(true);
                      }}>+ Onboard Mind</button>
                    )}
                  </div>
                </div>

                <div className="ad-table-wrap">
                  <table className="ad-table">
                    <thead>
                      <tr><th>Member Photo</th><th>Name &amp; Designation</th><th>Subtitle/Focus</th><th>Short Description</th><th>Biography Modal Preview</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {teamList.map(m => (
                        <tr key={m.id}>
                          <td>
                            <img src={m.image} alt={m.name} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '1px solid #ccc' }} />
                          </td>
                          <td><b>{m.name}</b><br/><span style={{ fontSize: 11, color: '#3c9d18', fontWeight: 600 }}>{m.role}</span></td>
                          <td>{m.subtitle}</td>
                          <td><span style={{ display: 'inline-block', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.description}</span></td>
                          <td><span style={{ display: 'inline-block', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.bio}</span></td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {isMaster && <button className="ad-pag-btn active" onClick={() => {
                                setEditingTeam(m);
                                setTeamForm({
                                  name: m.name,
                                  role: m.role,
                                  subtitle: m.subtitle,
                                  description: m.description,
                                  bio: m.bio,
                                  uniqueFact: m.uniqueFact,
                                  image: m.image,
                                  orderIndex: m.orderIndex
                                });
                                setTeamModalOpen(true);
                              }}>Edit</button>}
                              {isMaster && <button className="ad-pag-btn" onClick={() => handleTeamDelete(m.id)}>Remove</button>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* ════ VIEW: GALLERY / PORTFOLIO CMS ════ */}
            {currentView === 'gallery' && (
              <>
                <div className="ad-view-header">
                  <p>Landing page portfolio &amp; media showcase</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h1>🖼️ Portfolio Gallery Manager</h1>
                    {isMaster && (
                      <button className="ad-btn-primary" onClick={() => {
                        setEditingGallery(null);
                        setGalleryForm({
                          title: '',
                          category: 'Website Development',
                          mediaType: 'image',
                          mediaUrl: '',
                          thumbnailUrl: '',
                          description: '',
                          clientName: '',
                          featured: true,
                          orderIndex: galleryList.length + 1
                        });
                        setGalleryModalOpen(true);
                      }}>+ Add Portfolio Media</button>
                    )}
                  </div>
                </div>

                <div className="ad-card" style={{ marginBottom: 24, background: '#1e293b', color: '#f8fafc', padding: '16px 20px', borderRadius: 12 }}>
                  <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
                    💡 <b>Gallery Display Rules:</b> Uploaded items with <b>Featured (ON)</b> are immediately displayed in the <b>Landing Page Portfolio / Gallery Section</b>. If media is an Image, clients can click to zoom. If media is a Video (YouTube / MP4), it plays with responsive embeds.
                  </p>
                </div>

                {galleryList.length === 0 ? (
                  <div className="ad-card" style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                    <p style={{ fontSize: 16 }}>No portfolio media items uploaded yet.</p>
                    <button className="ad-btn-primary" onClick={() => {
                      setEditingGallery(null);
                      setGalleryModalOpen(true);
                    }}>+ Upload First Media</button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
                    {galleryList.map(item => (
                      <div key={item.id} style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        {/* Media Preview Box */}
                        <div style={{ height: 190, position: 'relative', background: '#000', overflow: 'hidden' }}>
                          {item.mediaType === 'video' ? (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
                              {item.mediaUrl.includes('youtube.com') || item.mediaUrl.includes('youtu.be') ? (
                                <iframe
                                  src={item.mediaUrl.replace('watch?v=', 'embed/')}
                                  title={item.title}
                                  style={{ width: '100%', height: '100%', border: 'none' }}
                                />
                              ) : (
                                <video src={item.mediaUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} controls />
                              )}
                              <span style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(239, 68, 68, 0.9)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4 }}>▶ VIDEO</span>
                            </div>
                          ) : (
                            <img
                              src={item.thumbnailUrl || item.mediaUrl}
                              alt={item.title}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          )}
                          <span style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(15, 23, 42, 0.85)', color: '#38bdf8', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4, backdropFilter: 'blur(4px)' }}>
                            {item.category}
                          </span>
                        </div>

                        {/* Card Info */}
                        <div style={{ padding: 16, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <div>
                            <h3 style={{ margin: '0 0 6px', fontSize: 16, color: '#f8fafc', fontWeight: 700 }}>{item.title}</h3>
                            {item.clientName && <p style={{ margin: '0 0 8px', fontSize: 12, color: '#94a3b8' }}>Client: <b>{item.clientName}</b></p>}
                            <p style={{ margin: 0, fontSize: 13, color: '#cbd5e1', lineHeight: 1.4 }}>{item.description || 'No description provided.'}</p>
                          </div>

                          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleGalleryToggleFeatured(item)}
                              style={{
                                background: item.featured === 1 ? '#065f46' : '#334155',
                                color: item.featured === 1 ? '#34d399' : '#94a3b8',
                                border: 'none',
                                padding: '5px 10px',
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              {item.featured === 1 ? '✓ Active on Landing' : 'Hidden'}
                            </button>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {isMaster && (
                                <button
                                  className="ad-btn-secondary"
                                  style={{ padding: '4px 10px', fontSize: 11 }}
                                  onClick={() => {
                                    setEditingGallery(item);
                                    setGalleryForm({
                                      title: item.title,
                                      category: item.category,
                                      mediaType: item.mediaType || 'image',
                                      mediaUrl: item.mediaUrl,
                                      thumbnailUrl: item.thumbnailUrl || '',
                                      description: item.description || '',
                                      clientName: item.clientName || '',
                                      featured: item.featured === 1,
                                      orderIndex: item.orderIndex || 0,
                                    });
                                    setGalleryModalOpen(true);
                                  }}
                                >
                                  Edit ✏️
                                </button>
                              )}
                              {isMaster && (
                                <button
                                  className="ad-btn-secondary"
                                  style={{ padding: '4px 10px', fontSize: 11, color: '#f87171' }}
                                  onClick={() => handleGalleryDelete(item.id)}
                                >
                                  Delete 🗑️
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}


            {/* ════ VIEW: SECURITY LOGS ════ */}
            {currentView === 'security' && (
              <>
                <div className="ad-view-header">
                  <p>Zero-EXE Firewall</p>
                  <h1>Blocked EXE/File Upload Logs</h1>
                </div>
                <div className="ad-table-wrap">
                  <table className="ad-table" style={{ fontFamily: 'monospace' }}>
                    <thead>
                      <tr><th>Timestamp</th><th>IP Address</th><th>Target Order</th><th>File Upload Request</th><th>Firewall Action</th></tr>
                    </thead>
                    <tbody>
                      <tr><td>2026-08-16 14:22:18</td><td>103.54.212.18</td><td>Order #WN-105</td><td style={{ color: '#991b1b' }}>system_config_run.exe</td><td style={{ color: '#991b1b', fontWeight: 'bold' }}>🚫 BLOCKED &amp; IP QUARANTINED</td></tr>
                      <tr><td>2026-08-15 09:11:05</td><td>172.56.12.109</td><td>Order #WN-103</td><td style={{ color: '#991b1b' }}>patch_v4_install.bat</td><td style={{ color: '#991b1b', fontWeight: 'bold' }}>🚫 BLOCKED &amp; IP QUARANTINED</td></tr>
                      <tr><td>2026-08-13 18:45:30</td><td>89.122.90.54</td><td>Order #WN-98</td><td style={{ color: '#991b1b' }}>crack_figma_key.exe</td><td style={{ color: '#991b1b', fontWeight: 'bold' }}>🚫 BLOCKED &amp; IP QUARANTINED</td></tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* ════ VIEW: AUDIT TRAIL ════ */}
            {currentView === 'audit' && (
              <>
                <div className="ad-view-header">
                  <p>System Ledger Logs</p>
                  <h1>🔐 Platform Audit Trail</h1>
                </div>
                <div className="ad-table-wrap">
                  <table className="ad-table">
                    <thead>
                      <tr><th>Timestamp</th><th>Admin Actor</th><th>Category</th><th>Details / Actions Log</th></tr>
                    </thead>
                    <tbody>
                      <tr><td>2026-08-16 19:10:00</td><td>Sumit Bhardwaj (Super Admin)</td><td>FINANCE</td><td>Released Freelancer batch payout for Order #WN-89 (₹9,999)</td></tr>
                      <tr><td>2026-08-15 11:22:15</td><td>Sumit Bhardwaj (Super Admin)</td><td>ASSIGNMENT</td><td>Assigned Order #WN-105 to Alex Developer (Payout: ₹24,500)</td></tr>
                      <tr><td>2026-08-14 09:45:00</td><td>QA Support Mod</td><td>QUALITY GATE</td><td>Moved Order #WN-98 back to revision desk with instruction notes.</td></tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ═══════════ FOOTER STATUS BAR ═══════════ */}
      <div className="ad-footer">
        <div className="ad-footer-left">
          <span className="ad-footer-dot" />
          WORKONOVA Admin v2.4 • Node/Postgres Cluster: Healthy • Zero-EXE Firewall Active
        </div>
        <div className="ad-footer-right">
          Platform Latency: 22ms
        </div>
      </div>

      {/* ═══════════ MODALS ═══════════ */}

      {/* ASSIGN MODAL — expertise filtered */}
      {/* ASSIGN MODAL — multi-specialist FCFS, duration limit, and notice */}
      {assigningOrder && (() => {
        const category = assigningOrder.serviceCategory || '';
        const matchedFreelancers = freelancers.filter(f =>
          (f.services || []).some(s =>
            s.toLowerCase().includes(category.toLowerCase()) ||
            category.toLowerCase().includes(s.toLowerCase())
          )
        );
        const otherFreelancers = freelancers.filter(f => !matchedFreelancers.includes(f));
        const isMultiSelected = selectedFreelancerIds.length > 1;

        const toggleFreelancer = (id: number) => {
          if (selectedFreelancerIds.includes(id)) {
            setSelectedFreelancerIds(selectedFreelancerIds.filter(x => x !== id));
          } else {
            setSelectedFreelancerIds([...selectedFreelancerIds, id]);
          }
        };

        const selectAllMatched = () => {
          setSelectedFreelancerIds(matchedFreelancers.map(f => f.id));
        };

        const selectAll = () => {
          setSelectedFreelancerIds(freelancers.map(f => f.id));
        };

        const clearSelection = () => {
          setSelectedFreelancerIds([]);
        };

        return (
          <div className="ad-modal-overlay" onClick={() => setAssigningOrder(null)}>
            <div className="ad-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 680, maxHeight: '90vh', overflowY: 'auto' }}>
              <div className="ad-modal-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 14 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 19 }}>🎯 Task Assignment &amp; FCFS Dispatch</h2>
                  <small style={{ color: '#64748b' }}>Order #WN-{assigningOrder.id} · {assigningOrder.serviceCategory} ({assigningOrder.tier?.toUpperCase() || 'STANDARD'})</small>
                </div>
                <button className="ad-modal-close" onClick={() => setAssigningOrder(null)}>×</button>
              </div>

              <div className="ad-modal-body">
                {/* Order info strip */}
                <div className="ad-assign-modal-info" style={{ marginBottom: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                  <div className="ad-assign-modal-info-row">
                    <span className="ad-assign-modal-label">Client Name</span>
                    <span className="ad-assign-modal-value">{assigningOrder.client?.name || `Client #${assigningOrder.clientId}`}</span>
                  </div>
                  <div className="ad-assign-modal-info-row">
                    <span className="ad-assign-modal-label">Client Price</span>
                    <span className="ad-assign-modal-value" style={{ color: '#16a34a', fontWeight: 800 }}>₹{assigningOrder.price.toLocaleString()}</span>
                  </div>
                  <div className="ad-assign-modal-info-row">
                    <span className="ad-assign-modal-label">Order Placed Date</span>
                    <span className="ad-assign-modal-value" style={{ color: '#0f172a', fontWeight: 600 }}>
                      {assigningOrder.createdAt ? new Date(assigningOrder.createdAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                    </span>
                  </div>
                  <div className="ad-assign-modal-info-row">
                    <span className="ad-assign-modal-label">Intake Assets</span>
                    <span className="ad-assign-modal-value">
                      {assigningOrder.submissionLink ? (
                        <a href={assigningOrder.submissionLink} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 700 }}>
                          View Files ↗
                        </a>
                      ) : 'Pending Intake'}
                    </span>
                  </div>
                </div>

                {assigningOrder.description && (
                  <div style={{ marginBottom: 16, background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, color: '#475569' }}>
                    <div style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: '#94a3b8', marginBottom: 4 }}>Task Scope Brief</div>
                    <div style={{ maxHeight: 70, overflowY: 'auto', lineHeight: 1.4 }}>{assigningOrder.description}</div>
                  </div>
                )}

                {freelancers.length === 0 ? (
                  <div style={{ padding: 20, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, textAlign: 'center', margin: '16px 0' }}>
                    <p style={{ color: '#991b1b', fontSize: 14, margin: '0 0 10px', fontWeight: 600 }}>⚠️ No freelancers found in the platform roster.</p>
                    <button
                      type="button"
                      className="ad-btn-primary"
                      onClick={() => {
                        setAssigningOrder(null);
                        setOnboardingOpen(true);
                      }}
                    >
                      + Onboard First Freelancer
                    </button>
                  </div>
                ) : (
                  <form id="assignForm" onSubmit={handleAssignOrder}>
                    {/* SECTION 1: FREELANCER SPECIALIST SELECTION (MULTI FCFS) */}
                    <div className="ad-form-row">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <label className="ad-form-label" style={{ margin: 0 }}>
                          Select Specialist Candidates ({selectedFreelancerIds.length} chosen)
                        </label>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {matchedFreelancers.length > 0 && (
                            <button
                              type="button"
                              onClick={selectAllMatched}
                              style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid #86efac', background: '#f0fdf4', color: '#166534', fontWeight: 700, cursor: 'pointer' }}
                            >
                              ⚡ Matched ({matchedFreelancers.length})
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={selectAll}
                            style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#334155', fontWeight: 600, cursor: 'pointer' }}
                          >
                            All ({freelancers.length})
                          </button>
                          {selectedFreelancerIds.length > 0 && (
                            <button
                              type="button"
                              onClick={clearSelection}
                              style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', fontWeight: 600, cursor: 'pointer' }}
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>

                      {/* FCFS MODE BANNER */}
                      {isMultiSelected && (
                        <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: '10px 12px', marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
                          <span style={{ fontSize: 20 }}>⚡</span>
                          <div style={{ fontSize: 12, color: '#92400e', lineHeight: 1.4 }}>
                            <b>First-Come, First-Served (FCFS) Offer Active:</b> The task will be dispatched to all <b>{selectedFreelancerIds.length} selected specialists</b> simultaneously. The first specialist to click <b>Accept</b> claims the task exclusively, and others will no longer be able to take it.
                          </div>
                        </div>
                      )}

                      {/* SPECIALIST SELECTION GRID */}
                      <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, maxHeight: 220, overflowY: 'auto', background: '#f8fafc', padding: 8 }}>
                        {matchedFreelancers.length > 0 && (
                          <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#16a34a', padding: '4px 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span>✓ Matched for "{category}" ({matchedFreelancers.length})</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 6 }}>
                              {matchedFreelancers.map(f => {
                                const isChecked = selectedFreelancerIds.includes(f.id);
                                return (
                                  <div
                                    key={f.id}
                                    onClick={() => toggleFreelancer(f.id)}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 10,
                                      padding: '8px 10px',
                                      borderRadius: 6,
                                      border: isChecked ? '2px solid #16a34a' : '1px solid #e2e8f0',
                                      background: isChecked ? '#f0fdf4' : '#ffffff',
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease'
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {}}
                                      style={{ cursor: 'pointer', width: 16, height: 16, accentColor: '#16a34a' }}
                                    />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span>{f.name}</span>
                                        <span style={{ fontSize: 9.5, background: '#dcfce7', color: '#166534', padding: '1px 5px', borderRadius: 4, fontWeight: 800 }}>EXPERT</span>
                                      </div>
                                      <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {(f.services || []).slice(0, 2).join(', ')} • {f.email}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {otherFreelancers.length > 0 && (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#64748b', padding: '4px 6px' }}>
                              Other Specialists ({otherFreelancers.length})
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 6 }}>
                              {otherFreelancers.map(f => {
                                const isChecked = selectedFreelancerIds.includes(f.id);
                                return (
                                  <div
                                    key={f.id}
                                    onClick={() => toggleFreelancer(f.id)}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 10,
                                      padding: '8px 10px',
                                      borderRadius: 6,
                                      border: isChecked ? '2px solid #2563eb' : '1px solid #e2e8f0',
                                      background: isChecked ? '#eff6ff' : '#ffffff',
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease'
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {}}
                                      style={{ cursor: 'pointer', width: 16, height: 16, accentColor: '#2563eb' }}
                                    />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                                        {f.name}
                                      </div>
                                      <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {(f.services || []).slice(0, 2).join(', ') || 'General'} • {f.email}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* SECTION 2: TIMELINE, TIME LIMIT & END DATE / TIME */}
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#334155', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>⏱️ Project Time Limit &amp; Deadline</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {/* Time Limit: Value + Unit */}
                        <div>
                          <label className="ad-form-label" style={{ fontSize: 11.5 }}>
                            Project Time Limit
                          </label>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input
                              className="ad-form-input"
                              type="number"
                              min="1"
                              placeholder="e.g. 7"
                              value={assignDurationValue}
                              onChange={e => {
                                const val = e.target.value === '' ? '' : Number(e.target.value);
                                setAssignDurationValue(val);
                                if (typeof val === 'number' && val > 0) {
                                  syncDeadlineFromDuration(val, assignDurationUnit);
                                }
                              }}
                              style={{ width: '50%' }}
                            />
                            <select
                              className="ad-form-select"
                              value={assignDurationUnit}
                              onChange={e => {
                                const u = e.target.value;
                                setAssignDurationUnit(u);
                                if (typeof assignDurationValue === 'number' && assignDurationValue > 0) {
                                  syncDeadlineFromDuration(assignDurationValue, u);
                                }
                              }}
                              style={{ width: '50%' }}
                            >
                              <option value="days">Days</option>
                              <option value="months">Months</option>
                              <option value="hours">Hours</option>
                            </select>
                          </div>
                        </div>

                        {/* Concrete End Date & Time */}
                        <div>
                          <label className="ad-form-label" style={{ fontSize: 11.5 }}>
                            End Date &amp; Time (Deadline)
                          </label>
                          <input
                            className="ad-form-input"
                            type="datetime-local"
                            value={assignDeadline}
                            onChange={e => setAssignDeadline(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* SECTION 3: PROJECT NOTICE & REVIEW GUIDELINES */}
                    <div className="ad-form-row">
                      <label className="ad-form-label">
                        Project Notice / Milestone Guidelines for Freelancer
                      </label>
                      <textarea
                        className="ad-form-textarea"
                        rows={2}
                        placeholder="e.g. Client needs initial Figma wireframe within 48 hours. 2 revisions included. Final deliverable must include raw source files."
                        value={assignNotice}
                        onChange={e => setAssignNotice(e.target.value)}
                      />
                      <small style={{ color: '#64748b', fontSize: 11 }}>
                        This notice will be displayed prominently on the freelancer's offer card and workspace alongside the countdown.
                      </small>
                    </div>

                    {/* SECTION 4: FREELANCER AGREED PAYOUT */}
                    <div className="ad-form-row">
                      <label className="ad-form-label">Specialist Agreed Payout (₹ INR)</label>
                      <input
                        className="ad-form-input"
                        type="number"
                        min="0"
                        value={payoutAmount}
                        onChange={e => setPayoutAmount(Number(e.target.value))}
                        max={assigningOrder.price}
                        required
                      />
                      <small style={{ color: '#888', display: 'block', marginTop: 4 }}>
                        Client paid ₹{assigningOrder.price.toLocaleString()} · Suggested: ₹{Math.floor(assigningOrder.price * 0.7).toLocaleString()} (70% margin)
                      </small>
                    </div>

                    <div className="ad-modal-footer" style={{ padding: '16px 0 0', marginTop: 16, borderTop: '1px solid #f0f0ee' }}>
                      <button type="button" className="ad-btn-secondary" onClick={() => setAssigningOrder(null)} disabled={isAssigning}>Cancel</button>
                      <button
                        className="ad-btn-primary"
                        type="submit"
                        disabled={isAssigning || selectedFreelancerIds.length === 0}
                        style={{
                          background: isMultiSelected ? 'linear-gradient(135deg, #d97706, #b45309)' : undefined
                        }}
                      >
                        {isAssigning
                          ? 'Dispatching Task...'
                          : isMultiSelected
                            ? `⚡ Broadcast FCFS Offer to ${selectedFreelancerIds.length} Specialists`
                            : '🎯 Confirm & Assign Task'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* QA GATEWAY MODAL */}
      {qaOrder && (
        <div className="ad-modal-overlay" onClick={() => setQaOrder(null)}>
          <div className="ad-modal wide" onClick={e => e.stopPropagation()}>
            <div className="ad-modal-header">
              <h2>🛡️ QA Review Gateway — #WN-{qaOrder.id}</h2>
              <button className="ad-modal-close" onClick={() => setQaOrder(null)}>×</button>
            </div>
            <div className="ad-modal-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span>Freelancer Files: <b><a href={qaOrder.submissionLink} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>Open Submission Link ↗</a></b></span>
              </div>
              <form id="qaForm" onSubmit={handleQaSubmit}>
                <div className="ad-form-row">
                  <label className="ad-form-label">Choose Action Decision</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['approve', 'revision', 'reject'].map(a => (
                      <button key={a} type="button" style={{ padding: '8px 14px', borderRadius: 8, border: qaAction === a ? '2px solid #56c41a' : '1px solid #e8e7e0', background: qaAction === a ? '#f0fce8' : 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, textTransform: 'capitalize' }} onClick={() => setQaAction(a as any)}>{a}</button>
                    ))}
                  </div>
                </div>
                {qaAction === 'approve' && (
                  <div className="ad-form-row">
                    <label className="ad-form-label">Curated Deliverable Link (Optional)</label>
                    <input className="ad-form-input" type="url" placeholder="Defaults to freelancer submission link if left empty..." value={qaApprovedLinkInput} onChange={e => setQaApprovedLinkInput(e.target.value)} />
                  </div>
                )}
                <div className="ad-form-row">
                  <label className="ad-form-label">QA Review / Revision Comments</label>
                  <textarea className="ad-form-textarea" rows={4} placeholder="Feedback instructions..." value={qaComments} onChange={e => setQaComments(e.target.value)} required={qaAction === 'revision'} />
                </div>
              </form>
            </div>
            <div className="ad-modal-footer">
              <button className="ad-btn-secondary" onClick={() => setQaOrder(null)}>Cancel</button>
              <button className="ad-btn-primary" form="qaForm" type="submit">Submit QA Decision</button>
            </div>
          </div>
        </div>
      )}

      {/* MESSAGES RELAY & CONTROL STATION MODAL */}
      {relayOrder && (() => {
        const clientMsgs = chatMessages.filter(m => m.senderRole === 'client' || m.targetAudience === 'client_only' || m.targetAudience === 'all' || !m.targetAudience);
        const flMsgs = chatMessages.filter(m => m.senderRole === 'freelancer' || m.targetAudience === 'freelancer_only' || m.targetAudience === 'all' || !m.targetAudience);
        const internalMsgs = chatMessages.filter(m => m.targetAudience === 'internal' || m.senderRole === 'system');

        let filteredList = chatMessages;
        if (chatChannelFilter === 'client') filteredList = clientMsgs;
        else if (chatChannelFilter === 'freelancer') filteredList = flMsgs;
        else if (chatChannelFilter === 'internal') filteredList = internalMsgs;

        return (
          <div className="ad-modal-overlay" onClick={() => setRelayOrder(null)}>
            <div className="ad-modal" style={{ maxWidth: 780, width: '94%', borderRadius: 14, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
              <div className="ad-modal-header" style={{ borderBottom: '1px solid #e2e8f0', background: '#0f172a', color: '#ffffff', padding: '16px 20px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18, color: '#ffffff' }}>💬 Communication Command Center — #WN-{relayOrder.id}</h2>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <span>Client: <b style={{ color: '#f8fafc' }}>{relayOrder.client?.name || `Client #${relayOrder.clientId}`}</b></span>
                    <span>Specialist: <b style={{ color: '#f8fafc' }}>{relayOrder.freelancer?.name || (relayOrder.freelancerId ? `Specialist #${relayOrder.freelancerId}` : 'Unassigned')}</b></span>
                    <span>Service: <b style={{ color: '#f8fafc' }}>{relayOrder.serviceCategory}</b></span>
                  </div>
                </div>
                <button className="ad-modal-close" style={{ color: '#94a3b8' }} onClick={() => setRelayOrder(null)}>×</button>
              </div>

              {/* Channel View Filter Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#ffffff', padding: '8px 18px', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    setChatChannelFilter('all');
                    setChatAudience('all');
                  }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 7,
                    border: 'none',
                    background: chatChannelFilter === 'all' ? '#0f172a' : '#f1f5f9',
                    color: chatChannelFilter === 'all' ? '#ffffff' : '#475569',
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  🌐 All Messages ({chatMessages.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setChatChannelFilter('client');
                    setChatAudience('client_only');
                  }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 7,
                    border: 'none',
                    background: chatChannelFilter === 'client' ? '#0284c7' : '#f1f5f9',
                    color: chatChannelFilter === 'client' ? '#ffffff' : '#475569',
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  🏢 Client Channel ({clientMsgs.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setChatChannelFilter('freelancer');
                    setChatAudience('freelancer_only');
                  }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 7,
                    border: 'none',
                    background: chatChannelFilter === 'freelancer' ? '#16a34a' : '#f1f5f9',
                    color: chatChannelFilter === 'freelancer' ? '#ffffff' : '#475569',
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  🛠️ Specialist Channel ({flMsgs.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setChatChannelFilter('internal');
                    setChatAudience('internal');
                  }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 7,
                    border: 'none',
                    background: chatChannelFilter === 'internal' ? '#d97706' : '#f1f5f9',
                    color: chatChannelFilter === 'internal' ? '#ffffff' : '#475569',
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  🔒 Internal QA Notes ({internalMsgs.length})
                </button>
              </div>

              {/* Message List */}
              <div className="ad-modal-body" style={{ maxHeight: '48vh', overflowY: 'auto', padding: '18px', background: '#f8fafc' }}>
                <div className="ad-chat-list">
                  {filteredList.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '36px 16px', color: '#94a3b8' }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>No messages in this channel view yet.</p>
                      <p style={{ margin: '6px 0 0', fontSize: 12 }}>Use the transmitter below to send a message to this channel.</p>
                    </div>
                  ) : (
                    filteredList.map(msg => {
                      const isSystem = msg.senderId === 0 || msg.senderRole === 'system';
                      const isMe = msg.senderRole === 'admin';
                      const isClient = msg.senderRole === 'client';
                      const isFreelancer = msg.senderRole === 'freelancer';

                      return (
                        <div key={msg.id} className={`ad-chat-msg${isMe ? ' me' : ''}`} style={{ marginBottom: 14 }}>
                          <div className={`ad-chat-av${isMe ? ' me' : ''}`} style={
                            isClient ? { background: '#0284c7' } :
                            isFreelancer ? { background: '#16a34a' } :
                            isSystem ? { background: '#d97706' } : {}
                          }>
                            {isMe ? initials : (isClient ? 'C' : (isFreelancer ? 'S' : '⚙️'))}
                          </div>
                          <div style={{ maxWidth: '82%' }}>
                            <div className="ad-chat-bubble" style={
                              msg.targetAudience === 'internal' ? { background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' } :
                              msg.targetAudience === 'freelancer_only' ? { background: '#ffffff', color: '#0f172a', borderLeft: '4px solid #16a34a', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' } :
                              msg.targetAudience === 'client_only' ? { background: '#ffffff', color: '#0f172a', borderLeft: '4px solid #0284c7', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' } :
                              { background: '#ffffff', color: '#0f172a', borderLeft: '4px solid #64748b', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }
                            }>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
                                {msg.targetAudience === 'client_only' && (
                                  <span style={{ fontSize: 10, fontWeight: 700, background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: 4 }}>
                                    🏢 Client Channel Only
                                  </span>
                                )}
                                {msg.targetAudience === 'freelancer_only' && (
                                  <span style={{ fontSize: 10, fontWeight: 700, background: '#dcfce7', color: '#15803d', padding: '2px 6px', borderRadius: 4 }}>
                                    🛠️ Specialist Channel Only
                                  </span>
                                )}
                                {msg.targetAudience === 'internal' && (
                                  <span style={{ fontSize: 10, fontWeight: 700, background: '#fee2e2', color: '#b91c1c', padding: '2px 6px', borderRadius: 4 }}>
                                    🔒 Admin QA Internal Note
                                  </span>
                                )}
                                {(!msg.targetAudience || msg.targetAudience === 'all') && !isSystem && (
                                  <span style={{ fontSize: 10, fontWeight: 700, background: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: 4 }}>
                                    📢 Broadcast (Visible to All)
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 13.5, lineHeight: 1.45 }}>{msg.messageText}</div>
                            </div>
                            <div className="ad-chat-time" style={{ marginTop: 3, fontSize: 11, color: '#64748b' }}>
                              {isSystem ? '⚙️ SYSTEM' : `${msg.senderRole.toUpperCase()}`} · {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Message Transmitter & Audience Controller */}
              <div style={{ background: '#ffffff', borderTop: '1px solid #e2e8f0', padding: '14px 20px' }}>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      📡 Transmit Message To:
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>
                      {chatAudience === 'all' && '📢 Message will be delivered to Both Client & Specialist'}
                      {chatAudience === 'client_only' && '🏢 Message will be delivered to Client ONLY'}
                      {chatAudience === 'freelancer_only' && '🛠️ Message will be delivered to Specialist ONLY'}
                      {chatAudience === 'internal' && '🔒 Saved as Private QA note (Hidden from everyone)'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                    {/* Broadcast Pill */}
                    <button
                      type="button"
                      onClick={() => {
                        setChatAudience('all');
                        if (chatChannelFilter !== 'all') setChatChannelFilter('all');
                      }}
                      style={{
                        padding: '7px 10px',
                        fontSize: 12,
                        borderRadius: 8,
                        border: chatAudience === 'all' ? '2px solid #0f172a' : '1px solid #cbd5e1',
                        background: chatAudience === 'all' ? '#0f172a' : '#ffffff',
                        color: chatAudience === 'all' ? '#ffffff' : '#334155',
                        fontWeight: chatAudience === 'all' ? 800 : 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        boxShadow: chatAudience === 'all' ? '0 2px 4px rgba(15,23,42,0.2)' : 'none'
                      }}
                    >
                      📢 Broadcast (Both) {chatAudience === 'all' && '✓'}
                    </button>

                    {/* Client Only Pill */}
                    <button
                      type="button"
                      onClick={() => {
                        setChatAudience('client_only');
                        if (chatChannelFilter !== 'client') setChatChannelFilter('client');
                      }}
                      style={{
                        padding: '7px 10px',
                        fontSize: 12,
                        borderRadius: 8,
                        border: chatAudience === 'client_only' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                        background: chatAudience === 'client_only' ? '#0284c7' : '#ffffff',
                        color: chatAudience === 'client_only' ? '#ffffff' : '#334155',
                        fontWeight: chatAudience === 'client_only' ? 800 : 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        boxShadow: chatAudience === 'client_only' ? '0 2px 4px rgba(2,132,199,0.25)' : 'none'
                      }}
                    >
                      🏢 Client Only {chatAudience === 'client_only' && '✓'}
                    </button>

                    {/* Specialist Only Pill */}
                    <button
                      type="button"
                      onClick={() => {
                        setChatAudience('freelancer_only');
                        if (chatChannelFilter !== 'freelancer') setChatChannelFilter('freelancer');
                      }}
                      style={{
                        padding: '7px 10px',
                        fontSize: 12,
                        borderRadius: 8,
                        border: chatAudience === 'freelancer_only' ? '2px solid #16a34a' : '1px solid #cbd5e1',
                        background: chatAudience === 'freelancer_only' ? '#16a34a' : '#ffffff',
                        color: chatAudience === 'freelancer_only' ? '#ffffff' : '#334155',
                        fontWeight: chatAudience === 'freelancer_only' ? 800 : 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        boxShadow: chatAudience === 'freelancer_only' ? '0 2px 4px rgba(22,163,74,0.25)' : 'none'
                      }}
                    >
                      🛠️ Specialist Only {chatAudience === 'freelancer_only' && '✓'}
                    </button>

                    {/* Internal QA Note Pill */}
                    <button
                      type="button"
                      onClick={() => {
                        setChatAudience('internal');
                        if (chatChannelFilter !== 'internal') setChatChannelFilter('internal');
                      }}
                      style={{
                        padding: '7px 10px',
                        fontSize: 12,
                        borderRadius: 8,
                        border: chatAudience === 'internal' ? '2px solid #d97706' : '1px solid #cbd5e1',
                        background: chatAudience === 'internal' ? '#d97706' : '#ffffff',
                        color: chatAudience === 'internal' ? '#ffffff' : '#334155',
                        fontWeight: chatAudience === 'internal' ? 800 : 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        boxShadow: chatAudience === 'internal' ? '0 2px 4px rgba(217,119,6,0.25)' : 'none'
                      }}
                    >
                      🔒 Internal QA Note {chatAudience === 'internal' && '✓'}
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSendRelayMessage}>
                  <div className="ad-chat-input-row">
                    <input
                      className="ad-chat-input"
                      required
                      placeholder={
                        chatAudience === 'client_only' ? 'Type message visible ONLY to Client (Specialist blocked)...' :
                        chatAudience === 'freelancer_only' ? 'Type message visible ONLY to Specialist (Client blocked)...' :
                        chatAudience === 'internal' ? 'Type private QA note (Both Client & Specialist blocked)...' :
                        'Type broadcast message visible to both Client and Specialist...'
                      }
                      value={relayText}
                      onChange={e => setRelayText(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="ad-chat-send"
                      style={{
                        minWidth: 90,
                        background:
                          chatAudience === 'client_only' ? '#0284c7' :
                          chatAudience === 'freelancer_only' ? '#16a34a' :
                          chatAudience === 'internal' ? '#d97706' :
                          '#0f172a'
                      }}
                    >
                      Send →
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ONBOARD FREELANCER MODAL */}
      {onboardingOpen && (
        <div className="ad-modal-overlay" onClick={() => setOnboardingOpen(false)}>
          <div className="ad-modal" onClick={e => e.stopPropagation()}>
            <div className="ad-modal-header">
              <h2>👨‍💻 Onboard Freelancer</h2>
              <button className="ad-modal-close" onClick={() => setOnboardingOpen(false)}>×</button>
            </div>
            <div className="ad-modal-body">
              <form id="onboardForm" onSubmit={handleCreateFreelancer}>
                <div className="ad-form-row"><label className="ad-form-label">Full Name</label><input className="ad-form-input" type="text" required placeholder="e.g. Alex Sharma" value={newFreelancerForm.name} onChange={e => setNewFreelancerForm({ ...newFreelancerForm, name: e.target.value })} /></div>
                <div className="ad-form-row"><label className="ad-form-label">Email Address</label><input className="ad-form-input" type="email" required placeholder="freelancer@workonova.com" value={newFreelancerForm.email} onChange={e => setNewFreelancerForm({ ...newFreelancerForm, email: e.target.value })} /></div>
                <div className="ad-form-row"><label className="ad-form-label">Initial Password</label><input className="ad-form-input" type="password" required placeholder="Password (min 8 chars)" value={newFreelancerForm.password} onChange={e => setNewFreelancerForm({ ...newFreelancerForm, password: e.target.value })} /></div>
                <div className="ad-form-row"><label className="ad-form-label">Portfolio Link</label><input className="ad-form-input" type="url" placeholder="https://github.com/..." value={newFreelancerForm.portfolioLink} onChange={e => setNewFreelancerForm({ ...newFreelancerForm, portfolioLink: e.target.value })} /></div>
                <div className="ad-form-row">
                  <label className="ad-form-label">Vetted Primary Service</label>
                  <select className="ad-form-select" value={newFreelancerForm.services[0] || ''} onChange={e => setNewFreelancerForm({ ...newFreelancerForm, services: [e.target.value] })} required>
                    <option value="">Choose service...</option>
                    <option value="Website Development">Website Development</option>
                    <option value="Graphic Designing">Graphic Designing</option>
                    <option value="Video Editing">Video Editing</option>
                    <option value="AI Services">AI Services</option>
                  </select>
                </div>
              </form>
            </div>
            <div className="ad-modal-footer">
              <button className="ad-btn-secondary" onClick={() => setOnboardingOpen(false)}>Cancel</button>
              <button className="ad-btn-primary" form="onboardForm" type="submit">Onboard Account</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT BLOG MODAL */}
      {blogModalOpen && (
        <div className="ad-modal-overlay" onClick={() => { setBlogModalOpen(false); setEditingBlog(null); }}>
          <div className="ad-modal" onClick={e => e.stopPropagation()}>
            <div className="ad-modal-header">
              <h2>📝 {editingBlog ? 'Edit Blog Post' : 'Create Blog Post'}</h2>
              <button className="ad-modal-close" onClick={() => { setBlogModalOpen(false); setEditingBlog(null); }}>×</button>
            </div>
            <div className="ad-modal-body">
              <form id="blogForm" onSubmit={handleBlogSubmit}>
                <div className="ad-form-row">
                  <label className="ad-form-label">Blog Title</label>
                  <input className="ad-form-input" type="text" required placeholder="e.g. The Future of Freelancing" value={blogForm.title} onChange={e => setBlogForm({ ...blogForm, title: e.target.value })} />
                </div>
                <div className="ad-form-row">
                  <label className="ad-form-label">Author Name</label>
                  <input className="ad-form-input" type="text" required placeholder="e.g. Editorial Guild" value={blogForm.author} onChange={e => setBlogForm({ ...blogForm, author: e.target.value })} />
                </div>
                <div className="ad-form-row">
                  <label className="ad-form-label">Published Date</label>
                  <input className="ad-form-input" type="text" required placeholder="e.g. August 12, 2026" value={blogForm.publishedAt} onChange={e => setBlogForm({ ...blogForm, publishedAt: e.target.value })} />
                </div>
                <div className="ad-form-row">
                  <label className="ad-form-label">Blog Content Markdown</label>
                  <textarea className="ad-form-textarea" required rows={6} placeholder="Type blog article body content here..." value={blogForm.content} onChange={e => setBlogForm({ ...blogForm, content: e.target.value })} />
                </div>
              </form>
            </div>
            <div className="ad-modal-footer">
              <button className="ad-btn-secondary" onClick={() => { setBlogModalOpen(false); setEditingBlog(null); }}>Cancel</button>
              <button className="ad-btn-primary" form="blogForm" type="submit">Save Post</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT BUNDLE MODAL */}
      {bundleModalOpen && (
        <div className="ad-modal-overlay" onClick={() => { setBundleModalOpen(false); setEditingBundle(null); }}>
          <div className="ad-modal" onClick={e => e.stopPropagation()}>
            <div className="ad-modal-header">
              <h2>💎 {editingBundle ? 'Edit Pricing Bundle' : 'Create Pricing Bundle'}</h2>
              <button className="ad-modal-close" onClick={() => { setBundleModalOpen(false); setEditingBundle(null); }}>×</button>
            </div>
            <div className="ad-modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
              <form id="bundleForm" onSubmit={handleBundleSubmit}>
                <div className="ad-form-row">
                  <label className="ad-form-label">Service Category</label>
                  <select className="ad-form-select" value={bundleForm.category || 'All Services'} onChange={e => setBundleForm({ ...bundleForm, category: e.target.value })}>
                    <option value="All Services">All Services (Default Global)</option>
                    <option value="Graphic Designing">Graphic Designing</option>
                    <option value="Video Editing">Video Editing</option>
                    <option value="3D Design & Modeling">3D Design & Modeling</option>
                    <option value="VFX">VFX</option>
                    <option value="Animation">Animation</option>
                    <option value="Digital Marketing">Digital Marketing</option>
                    <option value="Website Development">Website Development</option>
                    <option value="Software Development">Software Development</option>
                    <option value="App Development">App Development</option>
                    <option value="AI Services">AI Services</option>
                    <option value="IT Services">IT Services</option>
                    <option value="Cyber Security">Cyber Security</option>
                  </select>
                </div>
                <div className="ad-form-row">
                  <label className="ad-form-label">Target Audience Tag</label>
                  <input className="ad-form-input" type="text" required placeholder="e.g. STARTUPS & SOLO CREATORS" value={bundleForm.tag} onChange={e => setBundleForm({ ...bundleForm, tag: e.target.value })} />
                </div>
                <div className="ad-form-row">
                  <label className="ad-form-label">Bundle Package Name</label>
                  <input className="ad-form-input" type="text" required placeholder="e.g. Starter Creative" value={bundleForm.name} onChange={e => setBundleForm({ ...bundleForm, name: e.target.value })} />
                </div>
                <div className="ad-form-row">
                  <label className="ad-form-label">Pricing Cost (INR)</label>
                  <input className="ad-form-input" type="text" required placeholder="e.g. 14,999" value={bundleForm.price} onChange={e => setBundleForm({ ...bundleForm, price: e.target.value })} />
                </div>
                <div className="ad-form-row">
                  <label className="ad-form-label">Billing Frequency</label>
                  <input className="ad-form-input" type="text" required placeholder="e.g. / Monthly" value={bundleForm.period} onChange={e => setBundleForm({ ...bundleForm, period: e.target.value })} />
                </div>
                <div className="ad-form-row">
                  <label className="ad-form-label">Short Description</label>
                  <textarea className="ad-form-textarea" required rows={2} placeholder="e.g. Ideal for early stage startups..." value={bundleForm.description} onChange={e => setBundleForm({ ...bundleForm, description: e.target.value })} />
                </div>
                <div className="ad-form-row">
                  <label className="ad-form-label">Add Feature Item</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input className="ad-form-input" type="text" placeholder="e.g. Priority 24 Hours Turnaround" value={featureInput} onChange={e => setFeatureInput(e.target.value)} />
                    <button className="ad-btn-primary" type="button" onClick={() => {
                      if (!featureInput.trim()) return;
                      setBundleForm({ ...bundleForm, features: [...bundleForm.features, featureInput.trim()] });
                      setFeatureInput('');
                    }}>+ Add</button>
                  </div>
                  <ul style={{ paddingLeft: 20, marginTop: 8, fontSize: 12 }}>
                    {bundleForm.features.map((f, i) => (
                      <li key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span>{f}</span>
                        <button type="button" style={{ border: 'none', background: 'none', color: '#b91c1c', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => {
                          setBundleForm({ ...bundleForm, features: bundleForm.features.filter((_, idx) => idx !== i) });
                        }}>[x]</button>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="ad-form-row" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
                  <input type="checkbox" id="popular" checked={bundleForm.popular} onChange={e => setBundleForm({ ...bundleForm, popular: e.target.checked })} />
                  <label htmlFor="popular" className="ad-form-label" style={{ margin: 0, textTransform: 'none' }}>Highlight as Most Popular Choice</label>
                </div>
              </form>
            </div>
            <div className="ad-modal-footer">
              <button className="ad-btn-secondary" onClick={() => { setBundleModalOpen(false); setEditingBundle(null); }}>Cancel</button>
              <button className="ad-btn-primary" form="bundleForm" type="submit">Save Bundle</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT TEAM MIND MODAL */}
      {teamModalOpen && (
        <div className="ad-modal-overlay" onClick={() => { setTeamModalOpen(false); setEditingTeam(null); }}>
          <div className="ad-modal" onClick={e => e.stopPropagation()}>
            <div className="ad-modal-header">
              <h2>👥 {editingTeam ? 'Edit Leadership Mind' : 'Onboard Leadership Mind'}</h2>
              <button className="ad-modal-close" onClick={() => { setTeamModalOpen(false); setEditingTeam(null); }}>×</button>
            </div>
            <div className="ad-modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
              <form id="teamForm" onSubmit={handleTeamSubmit}>
                <div className="ad-form-row">
                  <label className="ad-form-label">Full Name</label>
                  <input className="ad-form-input" type="text" required placeholder="e.g. Dharmendra Sharma" value={teamForm.name} onChange={e => setTeamForm({ ...teamForm, name: e.target.value })} />
                </div>
                <div className="ad-form-row">
                  <label className="ad-form-label">Designation / Role Title</label>
                  <input className="ad-form-input" type="text" required placeholder="e.g. Founder / CEO / MD" value={teamForm.role} onChange={e => setTeamForm({ ...teamForm, role: e.target.value })} />
                </div>
                <div className="ad-form-row">
                  <label className="ad-form-label">Subtitle / Key Focus</label>
                  <input className="ad-form-input" type="text" required placeholder="e.g. Strategic Leadership & Agency Vision" value={teamForm.subtitle} onChange={e => setTeamForm({ ...teamForm, subtitle: e.target.value })} />
                </div>
                <div className="ad-form-row">
                  <label className="ad-form-label">
                    Profile Image Link (URL)
                    <span style={{ fontSize: 11, fontWeight: 'normal', color: '#586455', marginLeft: 8 }}>
                      (ImgBB, Google Drive, Dropbox, Imgur, or direct image link)
                    </span>
                  </label>
                  <input
                    className="ad-form-input"
                    type="url"
                    required
                    placeholder="https://ibb.co/d00LTQmk or https://images.unsplash.com/..."
                    value={teamForm.image}
                    onChange={async (e) => {
                      const val = e.target.value;
                      setTeamForm(prev => ({ ...prev, image: val }));
                      if (val.includes('ibb.co') || val.includes('imgbb.com') || val.includes('postimg.cc') || val.includes('drive.google.com') || val.includes('dropbox.com') || val.includes('imgur.com')) {
                        const resolved = await fetchDirectImageUrl(val);
                        if (resolved && resolved !== val) {
                          setTeamForm(prev => ({ ...prev, image: resolved }));
                        }
                      }
                    }}
                    onBlur={async (e) => {
                      const val = e.target.value.trim();
                      if (val) {
                        const resolved = await fetchDirectImageUrl(val);
                        if (resolved && resolved !== val) {
                          setTeamForm(prev => ({ ...prev, image: resolved }));
                        }
                      }
                    }}
                  />
                  {teamForm.image && (
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12, background: '#f8faf7', padding: '8px 12px', borderRadius: 8, border: '1px solid #d4dfd2' }}>
                      <img
                        src={formatImageUrl(teamForm.image)}
                        alt="Preview"
                        style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid #3c9d18', background: '#eef3eb' }}
                        onError={async () => {
                          const direct = await fetchDirectImageUrl(teamForm.image);
                          if (direct && direct !== teamForm.image) {
                            setTeamForm(prev => ({ ...prev, image: direct }));
                          }
                        }}
                      />
                      <div style={{ fontSize: 12, color: '#404c3e' }}>
                        <span style={{ fontWeight: 600, color: '#172414', display: 'block' }}>Photo Preview</span>
                        <span style={{ fontSize: 11, color: '#586455' }}>
                          {teamForm.image.includes('ibb.co') || teamForm.image.includes('imgbb.com') ? '⚡ ImgBB link auto-converted' : '✓ Live preview'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="ad-form-row">
                  <label className="ad-form-label">Short Intro Card Description</label>
                  <textarea className="ad-form-textarea" required rows={2} placeholder="Brief one-sentence card description..." value={teamForm.description} onChange={e => setTeamForm({ ...teamForm, description: e.target.value })} />
                </div>
                <div className="ad-form-row">
                  <label className="ad-form-label">Detailed Biography (Popup Modal Content)</label>
                  <textarea className="ad-form-textarea" required rows={4} placeholder="Full background narrative..." value={teamForm.bio} onChange={e => setTeamForm({ ...teamForm, bio: e.target.value })} />
                </div>
                <div className="ad-form-row">
                  <label className="ad-form-label">Core Philosophy / Unique Fact</label>
                  <input className="ad-form-input" type="text" required placeholder="e.g. Vetted and interviewed over 1,200 creators..." value={teamForm.uniqueFact} onChange={e => setTeamForm({ ...teamForm, uniqueFact: e.target.value })} />
                </div>
                <div className="ad-form-row">
                  <label className="ad-form-label">Display Priority Order Index</label>
                  <input className="ad-form-input" type="number" required placeholder="e.g. 1" value={teamForm.orderIndex} onChange={e => setTeamForm({ ...teamForm, orderIndex: Number(e.target.value) })} />
                </div>
              </form>
            </div>
            <div className="ad-modal-footer">
              <button className="ad-btn-secondary" onClick={() => { setTeamModalOpen(false); setEditingTeam(null); }}>Cancel</button>
              <button className="ad-btn-primary" form="teamForm" type="submit">Save Mind Details</button>
            </div>
          </div>
        </div>
      )}

      {/* GALLERY / PORTFOLIO MEDIA MODAL */}
      {galleryModalOpen && (
        <div className="ad-modal-overlay" onClick={() => { setGalleryModalOpen(false); setEditingGallery(null); }}>
          <div className="ad-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="ad-modal-header">
              <h2>🖼️ {editingGallery ? 'Edit Portfolio Media' : 'Add Portfolio Media'}</h2>
              <button className="ad-modal-close" onClick={() => { setGalleryModalOpen(false); setEditingGallery(null); }}>×</button>
            </div>
            <div className="ad-modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
              <form id="galleryForm" onSubmit={handleGallerySubmit}>
                <div className="ad-form-row">
                  <label className="ad-form-label">Project Title</label>
                  <input
                    className="ad-form-input"
                    type="text"
                    required
                    placeholder="e.g. SaaS Analytics Dashboard Redesign"
                    value={galleryForm.title}
                    onChange={e => setGalleryForm({ ...galleryForm, title: e.target.value })}
                  />
                </div>

                <div className="ad-form-row">
                  <label className="ad-form-label">Service Category</label>
                  <select
                    className="ad-form-select"
                    value={galleryForm.category}
                    onChange={e => setGalleryForm({ ...galleryForm, category: e.target.value })}
                  >
                    <option value="Website Development">Website Development</option>
                    <option value="Graphic Designing">Graphic Designing</option>
                    <option value="Video Editing">Video Editing</option>
                    <option value="3D Design & Modeling">3D Design &amp; Modeling</option>
                    <option value="VFX &amp; Animation">VFX &amp; Animation</option>
                    <option value="AI Services">AI Services</option>
                    <option value="Software &amp; App Development">Software &amp; App Development</option>
                    <option value="Digital Marketing">Digital Marketing</option>
                  </select>
                </div>

                <div className="ad-form-row">
                  <label className="ad-form-label">Media Type (Image or Video)</label>
                  <select
                    className="ad-form-select"
                    value={galleryForm.mediaType}
                    onChange={e => setGalleryForm({ ...galleryForm, mediaType: e.target.value as any })}
                  >
                    <option value="image">🖼️ Image (Screenshot / Render / Poster)</option>
                    <option value="video">▶️ Video (YouTube Embed / MP4 Link / Showreel)</option>
                  </select>
                </div>

                <div className="ad-form-row">
                  <label className="ad-form-label">
                    {galleryForm.mediaType === 'video' ? 'Video URL / YouTube Embed URL' : 'Image URL (ImgBB, Google Drive, Direct Link)'}
                  </label>
                  <input
                    className="ad-form-input"
                    type="url"
                    required
                    placeholder={galleryForm.mediaType === 'video' ? 'https://www.youtube.com/embed/...' : 'https://ibb.co/d00LTQmk or https://images.unsplash.com/...'}
                    value={galleryForm.mediaUrl}
                    onChange={async (e) => {
                      const val = e.target.value;
                      setGalleryForm(prev => ({ ...prev, mediaUrl: val }));
                      if (galleryForm.mediaType === 'image' && (val.includes('ibb.co') || val.includes('imgbb.com') || val.includes('postimg.cc') || val.includes('drive.google.com') || val.includes('dropbox.com') || val.includes('imgur.com'))) {
                        const resolved = await fetchDirectImageUrl(val);
                        if (resolved && resolved !== val) {
                          setGalleryForm(prev => ({ ...prev, mediaUrl: resolved }));
                        }
                      }
                    }}
                    onBlur={async (e) => {
                      const val = e.target.value.trim();
                      if (val && galleryForm.mediaType === 'image') {
                        const resolved = await fetchDirectImageUrl(val);
                        if (resolved && resolved !== val) {
                          setGalleryForm(prev => ({ ...prev, mediaUrl: resolved }));
                        }
                      }
                    }}
                  />
                  {galleryForm.mediaType === 'image' && galleryForm.mediaUrl && (
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12, background: '#f8faf7', padding: '8px 12px', borderRadius: 8, border: '1px solid #d4dfd2' }}>
                      <img
                        src={formatImageUrl(galleryForm.mediaUrl)}
                        alt="Preview"
                        style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover', border: '1px solid #3c9d18', background: '#eef3eb' }}
                        onError={async () => {
                          const direct = await fetchDirectImageUrl(galleryForm.mediaUrl);
                          if (direct && direct !== galleryForm.mediaUrl) {
                            setGalleryForm(prev => ({ ...prev, mediaUrl: direct }));
                          }
                        }}
                      />
                      <div style={{ fontSize: 12, color: '#404c3e' }}>
                        <span style={{ fontWeight: 600, color: '#172414', display: 'block' }}>Media Preview</span>
                        <span style={{ fontSize: 11, color: '#586455' }}>
                          {galleryForm.mediaUrl.includes('ibb.co') || galleryForm.mediaUrl.includes('imgbb.com') ? '⚡ ImgBB link auto-converted' : '✓ Live preview'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="ad-form-row">
                  <label className="ad-form-label">Thumbnail URL (Optional fallback image)</label>
                  <input
                    className="ad-form-input"
                    type="url"
                    placeholder="https://ibb.co/d00LTQmk or https://images.unsplash.com/..."
                    value={galleryForm.thumbnailUrl}
                    onChange={async (e) => {
                      const val = e.target.value;
                      setGalleryForm(prev => ({ ...prev, thumbnailUrl: val }));
                      if (val.includes('ibb.co') || val.includes('imgbb.com') || val.includes('postimg.cc') || val.includes('drive.google.com') || val.includes('dropbox.com') || val.includes('imgur.com')) {
                        const resolved = await fetchDirectImageUrl(val);
                        if (resolved && resolved !== val) {
                          setGalleryForm(prev => ({ ...prev, thumbnailUrl: resolved }));
                        }
                      }
                    }}
                    onBlur={async (e) => {
                      const val = e.target.value.trim();
                      if (val) {
                        const resolved = await fetchDirectImageUrl(val);
                        if (resolved && resolved !== val) {
                          setGalleryForm(prev => ({ ...prev, thumbnailUrl: resolved }));
                        }
                      }
                    }}
                  />
                </div>

                <div className="ad-form-row">
                  <label className="ad-form-label">Client Name / Brand (Optional)</label>
                  <input
                    className="ad-form-input"
                    type="text"
                    placeholder="e.g. Apex Metrics Inc."
                    value={galleryForm.clientName}
                    onChange={e => setGalleryForm({ ...galleryForm, clientName: e.target.value })}
                  />
                </div>

                <div className="ad-form-row">
                  <label className="ad-form-label">Project Summary Description</label>
                  <textarea
                    className="ad-form-textarea"
                    rows={3}
                    placeholder="Describe the tech stack, creative direction, and metrics achieved..."
                    value={galleryForm.description}
                    onChange={e => setGalleryForm({ ...galleryForm, description: e.target.value })}
                  />
                </div>

                <div className="ad-form-row" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                  <input
                    type="checkbox"
                    id="featuredGal"
                    checked={galleryForm.featured}
                    onChange={e => setGalleryForm({ ...galleryForm, featured: e.target.checked })}
                  />
                  <label htmlFor="featuredGal" className="ad-form-label" style={{ margin: 0, textTransform: 'none' }}>
                    Show in Landing Page Portfolio / Gallery Section
                  </label>
                </div>
              </form>
            </div>
            <div className="ad-modal-footer">
              <button className="ad-btn-secondary" onClick={() => { setGalleryModalOpen(false); setEditingGallery(null); }}>Cancel</button>
              <button className="ad-btn-primary" form="galleryForm" type="submit">Save Media</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT ORDER PRICE & TIMELINE MODAL */}
      {editPriceOrder && (
        <div className="ad-modal-overlay" onClick={() => setEditPriceOrder(null)}>
          <div className="ad-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="ad-modal-header">
              <h2>✏️ Customize Order Price &amp; Timeline — #WN-{editPriceOrder.id}</h2>
              <button className="ad-modal-close" onClick={() => setEditPriceOrder(null)}>×</button>
            </div>
            <div className="ad-modal-body">
              <form id="editPriceForm" onSubmit={handleSaveOrderPrice}>
                <div className="ad-form-row">
                  <label className="ad-form-label">Service Category</label>
                  <input className="ad-form-input" type="text" required value={editCategoryInput} onChange={e => setEditCategoryInput(e.target.value)} />
                </div>
                <div className="ad-form-row">
                  <label className="ad-form-label">Pricing Tier (Starter / Growth / Enterprise)</label>
                  <select className="ad-form-select" value={editTierInput} onChange={e => setEditTierInput(e.target.value)}>
                    <option value="silver">Starter (silver)</option>
                    <option value="gold">Growth (gold)</option>
                    <option value="custom">Enterprise (custom)</option>
                  </select>
                </div>
                <div className="ad-form-row">
                  <label className="ad-form-label">Customized Client Price (₹ INR)</label>
                  <input className="ad-form-input" type="number" required min={0} value={editPriceInput} onChange={e => setEditPriceInput(Number(e.target.value))} />
                  <small style={{ fontSize: 11, color: '#666', marginTop: 4, display: 'block' }}>Setting this price according to category requirements will immediately update the client's workspace portal.</small>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, margin: '12px 0' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#475569', marginBottom: 8 }}>
                    ⏱️ Project Timeline &amp; Deadline
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label className="ad-form-label" style={{ fontSize: 11 }}>Time Limit</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          className="ad-form-input"
                          type="number"
                          min="1"
                          placeholder="e.g. 7"
                          value={editDurationValue}
                          onChange={e => {
                            const val = e.target.value === '' ? '' : Number(e.target.value);
                            setEditDurationValue(val);
                            if (typeof val === 'number' && val > 0) {
                              const now = new Date();
                              if (editDurationUnit === 'months') now.setMonth(now.getMonth() + val);
                              else if (editDurationUnit === 'hours') now.setHours(now.getHours() + val);
                              else now.setDate(now.getDate() + val);
                              setEditDeadline(now.toISOString().slice(0, 16));
                            }
                          }}
                          style={{ width: '50%' }}
                        />
                        <select
                          className="ad-form-select"
                          value={editDurationUnit}
                          onChange={e => setEditDurationUnit(e.target.value)}
                          style={{ width: '50%' }}
                        >
                          <option value="days">Days</option>
                          <option value="months">Months</option>
                          <option value="hours">Hours</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="ad-form-label" style={{ fontSize: 11 }}>Deadline Date &amp; Time</label>
                      <input
                        className="ad-form-input"
                        type="datetime-local"
                        value={editDeadline}
                        onChange={e => setEditDeadline(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="ad-form-row">
                  <label className="ad-form-label">Client Notice / Milestone Guidelines</label>
                  <textarea
                    className="ad-form-textarea"
                    rows={2}
                    placeholder="Notice or special instructions for the specialist..."
                    value={editNotice}
                    onChange={e => setEditNotice(e.target.value)}
                  />
                </div>
              </form>
            </div>
            <div className="ad-modal-footer">
              <button className="ad-btn-secondary" onClick={() => setEditPriceOrder(null)}>Cancel</button>
              <button className="ad-btn-primary" form="editPriceForm" type="submit">Save &amp; Sync Price &amp; Timeline</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ ON-DEMAND QUOTE DEMAND MODAL ═══════════ */}
      {quoteOrder && (
        <div className="ad-modal-overlay" onClick={() => !isQuoting && setQuoteOrder(null)}>
          <div className="ad-modal" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
            <div className="ad-modal-header" style={{ borderBottom: '1px solid #e2e8f0' }}>
              <div>
                <h2 style={{ fontSize: 18, margin: 0 }}>⚡ Demand / Quote Custom Project Price</h2>
                <small style={{ color: '#64748b' }}>Order #WN-{quoteOrder.id} · {quoteOrder.serviceCategory}</small>
              </div>
              <button className="ad-modal-close" onClick={() => !isQuoting && setQuoteOrder(null)}>×</button>
            </div>
            <div className="ad-modal-body">
              {/* Client & Scoping Summary */}
              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                    🏢 {quoteOrder.client?.name || `Client #${quoteOrder.clientId}`}
                  </span>
                  <span className="ad-ondemand-token-pill">₹100 Advance Paid ✓</span>
                </div>
                <div style={{ fontSize: 12, color: '#475569', marginBottom: 6 }}>
                  <b>Client Email:</b> {quoteOrder.client?.email || 'N/A'}
                </div>
                <div style={{ fontSize: 12, color: '#475569', marginBottom: 6 }}>
                  <b>Project Brief:</b> {quoteOrder.description || 'No brief provided.'}
                </div>
                {quoteOrder.submissionLink && (
                  <div style={{ fontSize: 12 }}>
                    <b>Assets Link:</b>{' '}
                    <a href={quoteOrder.submissionLink} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 600 }}>
                      {quoteOrder.submissionLink} ↗
                    </a>
                  </div>
                )}
              </div>

              <form id="quoteDemandForm" onSubmit={handleQuoteSubmit}>
                <div className="ad-form-row">
                  <label className="ad-form-label">Total Custom Project Price Quote (₹ INR) *</label>
                  <input
                    className="ad-form-input"
                    type="number"
                    required
                    min={100}
                    step={100}
                    placeholder="e.g. 25000"
                    value={quotePriceInput || ''}
                    onChange={e => setQuotePriceInput(Number(e.target.value))}
                    style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}
                  />
                  <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[5000, 15000, 25000, 45000, 75000, 120000].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        className="ad-assign-tag"
                        onClick={() => setQuotePriceInput(amt)}
                      >
                        ₹{amt.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Milestone breakdown calculation preview */}
                {quotePriceInput > 0 && (
                  <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: 12, borderRadius: 8, marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#065f46', marginBottom: 4 }}>
                      💰 Automatic 3-Stage Escrow Milestone Schedule:
                    </div>
                    <div style={{ fontSize: 12, color: '#047857', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                      <div><b>M1 (50% Kickoff):</b> ₹{Math.round(quotePriceInput * 0.5).toLocaleString()}</div>
                      <div><b>M2 (25% Midpoint):</b> ₹{Math.round(quotePriceInput * 0.25).toLocaleString()}</div>
                      <div><b>M3 (25% Delivery):</b> ₹{Math.round(quotePriceInput * 0.25).toLocaleString()}</div>
                    </div>
                  </div>
                )}

                <div className="ad-form-row">
                  <label className="ad-form-label">Admin Scope Breakdown &amp; Deliverables Note</label>
                  <textarea
                    className="ad-form-textarea"
                    rows={3}
                    placeholder="Provide scope details, estimated delivery turnaround, tech stack, and key deliverables for the client..."
                    value={quoteNotesInput}
                    onChange={e => setQuoteNotesInput(e.target.value)}
                  />
                </div>
              </form>
            </div>
            <div className="ad-modal-footer">
              <button className="ad-btn-secondary" disabled={isQuoting} onClick={() => setQuoteOrder(null)}>
                Cancel
              </button>
              <button
                className="ad-btn-primary"
                form="quoteDemandForm"
                type="submit"
                disabled={isQuoting || quotePriceInput <= 0}
                style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
              >
                {isQuoting ? 'Sending Quote...' : `📋 Send Quote & Demand Payment (₹${(quotePriceInput || 0).toLocaleString()})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ CLIENT DOSSIER & PROFILE MODAL ═══════════ */}
      {selectedClientModal && (
        <div className="ad-modal-overlay" onClick={() => setSelectedClientModal(null)}>
          <div className="ad-modal" style={{ maxWidth: 840, width: '92%' }} onClick={e => e.stopPropagation()}>
            <div className="ad-modal-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="ad-dossier-avatar">
                  {getInitials(selectedClientModal.name)}
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 20 }}>🏢 {selectedClientModal.name}</h2>
                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                    Client ID #{selectedClientModal.id || 'N/A'} · Registered Client
                  </div>
                </div>
              </div>
              <button className="ad-modal-close" onClick={() => setSelectedClientModal(null)}>×</button>
            </div>

            <div className="ad-modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
              {/* Contact and Status Header Bar */}
              <div className="ad-dossier-header-bar">
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                  <div>
                    <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Email Address</span>
                    <strong style={{ fontSize: 13, color: '#1e293b' }}>{selectedClientModal.email}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Phone / WhatsApp</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                      <strong style={{ fontSize: 13, color: '#1e293b' }}>{selectedClientModal.phone}</strong>
                      {selectedClientModal.phone && selectedClientModal.phone !== '—' && (
                        <>
                          <a
                            href={`https://wa.me/${selectedClientModal.phone.replace(/[^\d]/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontSize: 10, background: '#25D366', color: '#fff', padding: '2px 6px', borderRadius: 4, textDecoration: 'none', fontWeight: 700 }}
                          >
                            WhatsApp 💬
                          </a>
                          <a
                            href={`tel:${selectedClientModal.phone.replace(/\s+/g, '')}`}
                            style={{ fontSize: 10, background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: 4, textDecoration: 'none', fontWeight: 700 }}
                          >
                            Call 📞
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Account Status</span>
                    <span className={selectedClientModal.status === 'Active' ? 'ad-status-dot-active' : 'ad-status-dot-dormant'} style={{ display: 'inline-block', marginTop: 2 }}>
                      {selectedClientModal.status}
                    </span>
                  </div>
                </div>
                <div>
                  <button
                    className="ad-pag-btn"
                    style={{
                      borderColor: selectedClientModal.status === 'Active' ? '#fca5a5' : '#86efac',
                      color: selectedClientModal.status === 'Active' ? '#dc2626' : '#16a34a',
                      fontWeight: 700,
                    }}
                    onClick={() => handleToggleClientStatus(selectedClientModal.id, selectedClientModal.status)}
                  >
                    {selectedClientModal.status === 'Active' ? '🚫 Suspend Account' : '✓ Activate Account'}
                  </button>
                </div>
              </div>

              {/* 4 Financial & Project KPIs */}
              <div className="ad-dossier-kpis">
                <div className="ad-dossier-kpi">
                  <small>Lifetime Value (LTV)</small>
                  <strong style={{ color: '#16a34a' }}>₹{selectedClientModal.ltv.toLocaleString('en-IN')}</strong>
                </div>
                <div className="ad-dossier-kpi">
                  <small>Total Orders Placed</small>
                  <strong>{selectedClientModal.totalOrders}</strong>
                </div>
                <div className="ad-dossier-kpi">
                  <small>Active Tasks</small>
                  <strong style={{ color: '#2563eb' }}>{selectedClientModal.activeTasks}</strong>
                </div>
                <div className="ad-dossier-kpi">
                  <small>Completed Deliverables</small>
                  <strong style={{ color: '#7c3aed' }}>{selectedClientModal.completedTasks}</strong>
                </div>
              </div>

              {/* Complete Projects & Orders History Table */}
              <div>
                <h3 style={{ fontSize: 15, margin: '0 0 12px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>📦 Project Portfolio &amp; Activity History ({selectedClientModal.totalOrders})</span>
                </h3>

                {(() => {
                  const clientOrders = orders.filter(
                    o => (o.client?.email && o.client.email.toLowerCase() === selectedClientModal.email.toLowerCase()) || o.clientId === selectedClientModal.id
                  );

                  if (clientOrders.length === 0) {
                    return (
                      <div className="ad-assign-empty-card" style={{ padding: '24px 16px' }}>
                        <p style={{ color: '#888', margin: 0, fontSize: 13 }}>No orders recorded for this client yet.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="ad-table-wrap">
                      <table className="ad-table" style={{ fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th>Order ID</th>
                            <th>Category &amp; Tier</th>
                            <th>Status</th>
                            <th>Price / Paid</th>
                            <th>Assigned Specialist</th>
                            <th>Intake / Asset Link</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clientOrders.map(ord => (
                            <tr key={ord.id}>
                              <td><b>#WN-{ord.id}</b></td>
                              <td>
                                <div><b>{ord.serviceCategory}</b></div>
                                <small style={{ color: '#64748b' }}>Tier: {ord.tier?.toUpperCase() || 'STANDARD'}</small>
                              </td>
                              <td>
                                <span className={`fd-status-pill ${ord.status}`}>
                                  {ord.status.replace('_', ' ').toUpperCase()}
                                </span>
                              </td>
                              <td>
                                <b>₹{ord.price.toLocaleString()}</b>
                                <div style={{ fontSize: 11, color: '#64748b' }}>Paid: ₹{(ord.amountPaid || 0).toLocaleString()}</div>
                              </td>
                              <td>
                                {ord.freelancer ? (
                                  <span style={{ fontWeight: 600, color: '#1e293b' }}>👨‍💻 {ord.freelancer.name}</span>
                                ) : (
                                  <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Unassigned</span>
                                )}
                              </td>
                              <td>
                                {ord.submissionLink ? (
                                  <a href={ord.submissionLink} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 600 }}>
                                    Link ↗
                                  </a>
                                ) : (
                                  <span style={{ color: '#94a3b8' }}>—</span>
                                )}
                              </td>
                              <td>
                                <button
                                  className="ad-pag-btn"
                                  style={{ padding: '4px 8px', fontSize: 11 }}
                                  onClick={() => {
                                    setSelectedClientModal(null);
                                    setRelayOrder(ord);
                                  }}
                                >
                                  💬 Chat
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="ad-modal-footer" style={{ borderTop: '1px solid #e2e8f0' }}>
              <button className="ad-btn-secondary" onClick={() => setSelectedClientModal(null)}>
                Close Dossier
              </button>
              {(() => {
                const clientOrders = orders.filter(
                  o => (o.client?.email && o.client.email.toLowerCase() === selectedClientModal.email.toLowerCase()) || o.clientId === selectedClientModal.id
                );
                if (clientOrders.length > 0) {
                  return (
                    <button
                      className="ad-btn-primary"
                      onClick={() => {
                        const targetOrder = clientOrders[0];
                        setSelectedClientModal(null);
                        setRelayOrder(targetOrder);
                      }}
                    >
                      💬 Open Relay Chat with Client
                    </button>
                  );
                }
                return null;
              })()}
            </div>
          </div>
        </div>
      )}
      {/* ═══════════ FREELANCER DOSSIER & PROFILE MODAL ═══════════ */}
      {selectedFreelancerModal && (
        <div className="ad-modal-overlay" onClick={() => setSelectedFreelancerModal(null)}>
          <div className="ad-modal" style={{ maxWidth: 880, width: '92%' }} onClick={e => e.stopPropagation()}>
            <div className="ad-modal-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="ad-dossier-avatar" style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}>
                  {getInitials(selectedFreelancerModal.name)}
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 20 }}>👨‍💻 {selectedFreelancerModal.name}</h2>
                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                    Specialist ID #{selectedFreelancerModal.id || 'N/A'} · Creative / Tech Specialist
                  </div>
                </div>
              </div>
              <button className="ad-modal-close" onClick={() => setSelectedFreelancerModal(null)}>×</button>
            </div>

            <div className="ad-modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
              {/* Contact and Status Header Bar */}
              <div className="ad-dossier-header-bar">
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                  <div>
                    <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Email Address</span>
                    <strong style={{ fontSize: 13, color: '#1e293b' }}>{selectedFreelancerModal.email}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Phone / WhatsApp</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                      <strong style={{ fontSize: 13, color: '#1e293b' }}>{selectedFreelancerModal.phone}</strong>
                      {selectedFreelancerModal.phone && selectedFreelancerModal.phone !== '—' && (
                        <>
                          <a
                            href={`https://wa.me/${selectedFreelancerModal.phone.replace(/[^\d]/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontSize: 10, background: '#25D366', color: '#fff', padding: '2px 6px', borderRadius: 4, textDecoration: 'none', fontWeight: 700 }}
                          >
                            WhatsApp 💬
                          </a>
                          <a
                            href={`tel:${selectedFreelancerModal.phone.replace(/\s+/g, '')}`}
                            style={{ fontSize: 10, background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: 4, textDecoration: 'none', fontWeight: 700 }}
                          >
                            Call 📞
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Account Status</span>
                    <span className={selectedFreelancerModal.status === 'Active' ? 'ad-status-dot-active' : 'ad-status-dot-dormant'} style={{ display: 'inline-block', marginTop: 2 }}>
                      {selectedFreelancerModal.status}
                    </span>
                  </div>
                  {selectedFreelancerModal.portfolioLink && (
                    <div>
                      <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Portfolio / GitHub</span>
                      <a href={selectedFreelancerModal.portfolioLink} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#2563eb', fontWeight: 600 }}>
                        Open Portfolio Link ↗
                      </a>
                    </div>
                  )}
                </div>
                <div>
                  <button
                    className="ad-pag-btn"
                    style={{
                      borderColor: selectedFreelancerModal.status === 'Active' ? '#fca5a5' : '#86efac',
                      color: selectedFreelancerModal.status === 'Active' ? '#dc2626' : '#16a34a',
                      fontWeight: 700,
                    }}
                    onClick={() => handleToggleFreelancerStatus(selectedFreelancerModal.id, selectedFreelancerModal.status)}
                  >
                    {selectedFreelancerModal.status === 'Active' ? '🚫 Suspend Specialist' : '✓ Activate Specialist'}
                  </button>
                </div>
              </div>

              {/* Vetted Skills List */}
              <div style={{ margin: '14px 0', background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 6 }}>
                  Vetted Competencies &amp; Services
                </span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {selectedFreelancerModal.services.length > 0 ? (
                    selectedFreelancerModal.services.map(s => <span className="fd-tech-pill" key={s}>{s}</span>)
                  ) : (
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>No specific tags set</span>
                  )}
                </div>
              </div>

              {/* 4 Financial & Project KPIs */}
              <div className="ad-dossier-kpis">
                <div className="ad-dossier-kpi">
                  <small>Lifetime Settled Payouts</small>
                  <strong style={{ color: '#16a34a' }}>₹{selectedFreelancerModal.totalEarnings.toLocaleString('en-IN')}</strong>
                </div>
                <div className="ad-dossier-kpi">
                  <small>Pending Escrow Payout</small>
                  <strong style={{ color: '#f59e0b' }}>₹{selectedFreelancerModal.pendingPayout.toLocaleString('en-IN')}</strong>
                </div>
                <div className="ad-dossier-kpi">
                  <small>Active Tasks</small>
                  <strong style={{ color: '#2563eb' }}>{selectedFreelancerModal.activeTasks}</strong>
                </div>
                <div className="ad-dossier-kpi">
                  <small>Completed Deliverables</small>
                  <strong style={{ color: '#7c3aed' }}>{selectedFreelancerModal.completedTasks}</strong>
                </div>
              </div>

              {/* Complete Assigned Tasks & Orders History Table */}
              <div>
                <h3 style={{ fontSize: 15, margin: '0 0 12px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>📋 Assigned Projects &amp; Deliverables History ({selectedFreelancerModal.totalTasks})</span>
                </h3>

                {(() => {
                  const flOrders = orders.filter(
                    o => o.freelancerId === selectedFreelancerModal.id || (o.freelancer?.email && o.freelancer.email.toLowerCase() === selectedFreelancerModal.email.toLowerCase())
                  );

                  if (flOrders.length === 0) {
                    return (
                      <div className="ad-assign-empty-card" style={{ padding: '24px 16px' }}>
                        <p style={{ color: '#888', margin: 0, fontSize: 13 }}>No tasks assigned to this specialist yet.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="ad-table-wrap">
                      <table className="ad-table" style={{ fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th>Order ID</th>
                            <th>Category &amp; Tier</th>
                            <th>Status</th>
                            <th>Agreed Payout Fee</th>
                            <th>Client Name</th>
                            <th>Deliverables / Brief</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {flOrders.map(ord => (
                            <tr key={ord.id}>
                              <td><b>#WN-{ord.id}</b></td>
                              <td>
                                <div><b>{ord.serviceCategory}</b></div>
                                <small style={{ color: '#64748b' }}>Tier: {ord.tier?.toUpperCase() || 'STANDARD'}</small>
                              </td>
                              <td>
                                <span className={`fd-status-pill ${ord.status}`}>
                                  {ord.status.replace('_', ' ').toUpperCase()}
                                </span>
                              </td>
                              <td>
                                <b style={{ color: '#16a34a' }}>₹{(ord.freelancerPayoutAmount || 0).toLocaleString('en-IN')}</b>
                                <div style={{ fontSize: 10.5, color: '#64748b' }}>Status: {(ord.payoutStatus || 'pending').replace('_', ' ')}</div>
                              </td>
                              <td>
                                <span style={{ fontWeight: 600, color: '#1e293b' }}>{ord.client?.name || `Client #${ord.clientId}`}</span>
                              </td>
                              <td>
                                {ord.submissionLink ? (
                                  <a href={ord.submissionLink} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 600 }}>
                                    Brief Link ↗
                                  </a>
                                ) : (
                                  <span style={{ color: '#94a3b8' }}>—</span>
                                )}
                              </td>
                              <td>
                                <button
                                  className="ad-pag-btn"
                                  style={{ padding: '4px 8px', fontSize: 11 }}
                                  onClick={() => {
                                    setSelectedFreelancerModal(null);
                                    setRelayOrder(ord);
                                  }}
                                >
                                  💬 Chat
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="ad-modal-footer" style={{ borderTop: '1px solid #e2e8f0' }}>
              <button className="ad-btn-secondary" onClick={() => setSelectedFreelancerModal(null)}>
                Close Dossier
              </button>
              {(() => {
                const flOrders = orders.filter(
                  o => o.freelancerId === selectedFreelancerModal.id || (o.freelancer?.email && o.freelancer.email.toLowerCase() === selectedFreelancerModal.email.toLowerCase())
                );
                if (flOrders.length > 0) {
                  return (
                    <button
                      className="ad-btn-primary"
                      onClick={() => {
                        const targetOrder = flOrders[0];
                        setSelectedFreelancerModal(null);
                        setRelayOrder(targetOrder);
                      }}
                    >
                      💬 Open Relay Chat with Specialist
                    </button>
                  );
                }
                return null;
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}
