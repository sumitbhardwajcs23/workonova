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
  milestoneStage?: number;
  amountPaid?: number;
  description: string;
  submissionLink: string;
  midpointSubmissionLink?: string;
  midpointSubmissionNotes?: string;
  midpointApprovedAt?: string;
  qaApprovedLink: string;
  freelancerId?: number;
  freelancerPayoutAmount?: number;
  payoutStatus?: string;
  payoutReleasedAt?: string;
  adminRevisionComments?: string;
  createdAt: string;
  updatedAt?: string;
  client?: { name: string; email: string; phone?: string; };
  freelancer?: { name: string; email: string; };
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

  // Freelancer Roster Grid Filters
  const [flSearch, setFlSearch] = useState('');
  const [flFilterSkill, setFlFilterSkill] = useState('all');

  // ── MODALS & SUBMIT CONTROLS ──────────────────────────────────
  const [assigningOrder, setAssigningOrder] = useState<Order | null>(null);
  const [selectedFreelancerId, setSelectedFreelancerId] = useState<number | ''>('');
  const [payoutAmount, setPayoutAmount] = useState<number>(0);

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

  // ── EDIT PRICE STATE ──────────────────────────────────────────
  const [editPriceOrder, setEditPriceOrder] = useState<Order | null>(null);
  const [editPriceInput, setEditPriceInput] = useState<number>(0);
  const [editTierInput, setEditTierInput] = useState<string>('silver');
  const [editCategoryInput, setEditCategoryInput] = useState<string>('');

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

      setOrders(dataOrders.data || []);
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


  const handleAssignOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningOrder || !selectedFreelancerId) return;
    setError(''); setSuccess('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/orders/${assigningOrder.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ freelancerId: Number(selectedFreelancerId), payoutAmount })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Assignment failed');
      setSuccess(`Task assigned successfully to freelancer!`);
      setAssigningOrder(null); setSelectedFreelancerId(''); setPayoutAmount(0);
      fetchDashboardData();
    } catch (err: any) { setError(err.message); }
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
          serviceCategory: editCategoryInput
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update order price');
      setSuccess(`Order #${editPriceOrder.id} price updated to ₹${editPriceInput.toLocaleString('en-IN')}!`);
      setEditPriceOrder(null);
      fetchDashboardData();
    } catch (err: any) { setError(err.message); }
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

  const handleUpdatePayoutAmount = async (orderId: number, newAmount: number) => {
    if (!isMaster) return;
    setError(''); setSuccess('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/orders/${orderId}/payout-amount`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ payoutAmount: newAmount })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update payout amount');
      setSuccess(`✅ Payout amount for Order #WN-${orderId} updated to ₹${newAmount.toLocaleString('en-IN')}`);
      fetchDashboardData();
    } catch (err: any) { setError(err.message); }
  };

  const handleApprovePayout = async (orderId: number) => {
    if (!isMaster) return;
    setError(''); setSuccess('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/orders/${orderId}/approve-payout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to approve payout');
      setSuccess(`🛡️ Payout for Order #WN-${orderId} approved by Admin! Ready for final disbursement.`);
      fetchDashboardData();
    } catch (err: any) { setError(err.message); }
  };

  const handlePayoutRelease = async (orderId: number) => {
    if (!isMaster) return;
    setError(''); setSuccess('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/orders/${orderId}/release-payout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payout release failed');
      setSuccess(data.message || '🎉 Payout released and notified specialist. Order delivered!');
      fetchDashboardData();
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
    const optimisticMsg = {
      id: Date.now(),
      orderId: relayOrder.id,
      senderId: 0,
      senderRole: 'admin' as const,
      messageText: textToSend,
      createdAt: new Date().toISOString(),
    };
    setChatMessages(prev => [...prev, optimisticMsg]);
    setRelayText('');

    try {
      const res = await fetch(`${API_BASE}/api/admin/orders/${relayOrder.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messageText: textToSend })
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
  const activeCount = orders.filter(o => ['paid', 'assigned', 'submitted', 'revision_requested'].includes(o.status)).length;
  const qcGateCount = orders.filter(o => o.status === 'submitted').length;
  const payoutDue = orders.filter(o => o.status === 'qa_approved').reduce((acc, o) => acc + (o.freelancerPayoutAmount || 0), 0);

  const assignDeskCount = orders.filter(o => o.status === 'paid').length;
  const disputeDeskCount = orders.filter(o => o.status === 'revision_requested').length;
  const testimonialCount = testimonials.filter(t => t.status === 'pending').length;

  // Group orders by client to compute Client Intelligence Grid
  interface ClientRow {
    name: string;
    email: string;
    phone: string;
    totalOrders: number;
    activeTasks: number;
    ltv: number;
    status: 'Active' | 'Dormant';
  }

  const clientMap: Record<string, ClientRow> = {};
  orders.forEach(o => {
    if (!o.client) return;
    const key = o.client.email.toLowerCase();
    if (!clientMap[key]) {
      clientMap[key] = {
        name: o.client.name,
        email: o.client.email,
        phone: o.client.phone || '+91 98765 43210',
        totalOrders: 0,
        activeTasks: 0,
        ltv: 0,
        status: 'Dormant'
      };
    }
    clientMap[key].totalOrders += 1;
    clientMap[key].ltv += o.price;
    if (['paid', 'assigned', 'submitted', 'revision_requested'].includes(o.status)) {
      clientMap[key].activeTasks += 1;
      clientMap[key].status = 'Active';
    }
  });

  const clientRows = Object.values(clientMap);
  const filteredClientRows = clientRows.filter(c => {
    if (clientSearch.trim()) {
      const q = clientSearch.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.phone.includes(q);
    }
    return true;
  }).sort((a, b) => {
    if (clientSort === 'ltv-high') return b.ltv - a.ltv;
    if (clientSort === 'orders-high') return b.totalOrders - a.totalOrders;
    return 0;
  });

  // Freelancer mapping
  const filteredFreelancers = freelancers.filter(f => {
    if (flSearch.trim()) {
      const q = flSearch.toLowerCase();
      return f.name.toLowerCase().includes(q) || f.email.toLowerCase().includes(q);
    }
    if (flFilterSkill !== 'all') {
      return f.services.some(s => s.toLowerCase().includes(flFilterSkill.toLowerCase()));
    }
    return true;
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
                              <button className="ad-pag-btn" onClick={() => { setEditPriceOrder(o); setEditPriceInput(o.price); setEditTierInput(o.tier || 'silver'); setEditCategoryInput(o.serviceCategory); }}>✏️ Price</button>
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

            {/* ════ VIEW: ASSIGN DESK ════ */}
            {currentView === 'assign' && (
              <>
                <div className="ad-view-header">
                  <p>Production Assignments</p>
                  <h1>Assign Desk</h1>
                  <p style={{ color: '#888', fontSize: 13, marginTop: 4 }}>
                    Freelancers are matched by their registered <b>Area of Expertise</b>
                  </p>
                </div>

                {orders.filter(o => o.status === 'paid').length === 0 ? (
                  <p style={{ color: '#888', textAlign: 'center', padding: 40 }}>All paid orders successfully assigned to freelancers!</p>
                ) : (
                  (() => {
                    // Group paid orders by service category
                    const paidOrders = orders.filter(o => o.status === 'paid');
                    const grouped: Record<string, typeof paidOrders> = {};
                    paidOrders.forEach(o => {
                      const cat = o.serviceCategory || 'Uncategorized';
                      if (!grouped[cat]) grouped[cat] = [];
                      grouped[cat].push(o);
                    });
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
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
                                  <span className="ad-assign-cat-badge">{catOrders.length} order{catOrders.length > 1 ? 's' : ''}</span>
                                </div>
                                <div className="ad-assign-cat-meta">
                                  {matchedFreelancers.length > 0 ? (
                                    <span className="ad-assign-match-pill matched">
                                      ✓ {matchedFreelancers.length} matched freelancer{matchedFreelancers.length > 1 ? 's' : ''}
                                    </span>
                                  ) : (
                                    <span className="ad-assign-match-pill none">⚠ No matched freelancers</span>
                                  )}
                                </div>
                              </div>

                              {/* Matched freelancer chips */}
                              {matchedFreelancers.length > 0 && (
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
                              )}

                              {/* Order cards in this category */}
                              <div className="ad-qc-grid">
                                {catOrders.map(o => (
                                  <div className="ad-qc-card" key={o.id}>
                                    <div className="ad-qc-header">
                                      <h3>Order #WN-{o.id}</h3>
                                      <b>₹{o.price.toLocaleString()}</b>
                                    </div>
                                    <p className="ad-qc-brief">{o.description || 'No brief provided.'}</p>
                                    <div className="ad-assign-order-meta">
                                      <span>Tier: <b>{o.tier || 'Standard'}</b></span>
                                      <span>Client: <b>{o.client?.name || `#${o.clientId}`}</b></span>
                                    </div>
                                    <div className="ad-qc-actions">
                                      <button
                                        className="ad-btn-primary"
                                        onClick={() => {
                                          setAssigningOrder(o);
                                          setPayoutAmount(Math.floor(o.price * 0.7));
                                          setSelectedFreelancerId(
                                            matchedFreelancers.length === 1 ? matchedFreelancers[0].id : ''
                                          );
                                        }}
                                      >
                                        🎯 Assign to Freelancer
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
                        <tr key={c.email}>
                          <td><b>🏢 {c.name}</b></td>
                          <td>{c.email} · {c.phone}</td>
                          <td>{c.totalOrders} Orders</td>
                          <td>{c.activeTasks} Active</td>
                          <td><b>₹{c.ltv.toLocaleString('en-IN')}</b></td>
                          <td><span className={c.status === 'Active' ? 'ad-status-dot-active' : 'ad-status-dot-dormant'}>{c.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* ════ VIEW: FREELANCERS CRM SPREADSHEET ════ */}
            {currentView === 'freelancers' && (
              <>
                <div className="ad-view-header">
                  <p>Resource Directory</p>
                  <h1>Freelancer Roster Grid</h1>
                </div>

                <div className="ad-grid-controls">
                  <div className="ad-grid-search">
                    <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 13, height: 13 }}><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
                    <input type="search" placeholder="Search Freelancer..." value={flSearch} onChange={e => setFlSearch(e.target.value)} />
                  </div>
                  <select className="ad-grid-select" value={flFilterSkill} onChange={e => setFlFilterSkill(e.target.value)}>
                    <option value="all">Filter: Vetted Services (All)</option>
                    <option value="web">Web Development</option>
                    <option value="design">Graphic Designing</option>
                    <option value="video">Video Editing</option>
                  </select>
                  {isMaster && <button className="ad-export-btn" onClick={() => setOnboardingOpen(true)}>+ Onboard Freelancer</button>}
                </div>

                <div className="ad-table-wrap">
                  <table className="ad-table">
                    <thead>
                      <tr><th>Freelancer Name</th><th>Email</th><th>Vetted Skills</th><th>Workload Capacity</th><th>Ratings</th><th>Portfolio</th></tr>
                    </thead>
                    <tbody>
                      {filteredFreelancers.map(f => (
                        <tr key={f.id}>
                          <td><b>{f.name}</b></td>
                          <td>{f.email}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {f.services.map(s => <span className="fd-tech-pill" key={s} style={{ fontSize: 10 }}>{s}</span>)}
                            </div>
                          </td>
                          <td><span className="fd-status-pill submitted" style={{ fontSize: 10.5 }}>1/3 Active</span></td>
                          <td>⭐⭐⭐⭐⭐ (5/5)</td>
                          <td><a href={f.portfolioLink || '#'} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>Open Link ↗</a></td>
                        </tr>
                      ))}
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
      {assigningOrder && (() => {
        const category = assigningOrder.serviceCategory || '';
        const matchedFreelancers = freelancers.filter(f =>
          (f.services || []).some(s =>
            s.toLowerCase().includes(category.toLowerCase()) ||
            category.toLowerCase().includes(s.toLowerCase())
          )
        );
        const otherFreelancers = freelancers.filter(f => !matchedFreelancers.includes(f));
        return (
          <div className="ad-modal-overlay" onClick={() => setAssigningOrder(null)}>
            <div className="ad-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
              <div className="ad-modal-header">
                <h2>🎯 Assign Task — Order #WN-{assigningOrder.id}</h2>
                <button className="ad-modal-close" onClick={() => setAssigningOrder(null)}>×</button>
              </div>
              <div className="ad-modal-body">
                {/* Order info strip */}
                <div className="ad-assign-modal-info">
                  <div className="ad-assign-modal-info-row">
                    <span className="ad-assign-modal-label">Service</span>
                    <span className="ad-assign-modal-value">{assigningOrder.serviceCategory}</span>
                  </div>
                  <div className="ad-assign-modal-info-row">
                    <span className="ad-assign-modal-label">Tier</span>
                    <span className="ad-assign-modal-value">{assigningOrder.tier || 'Standard'}</span>
                  </div>
                  <div className="ad-assign-modal-info-row">
                    <span className="ad-assign-modal-label">Client Price</span>
                    <span className="ad-assign-modal-value">₹{assigningOrder.price.toLocaleString()}</span>
                  </div>
                </div>

                <form id="assignForm" onSubmit={handleAssignOrder}>
                  <div className="ad-form-row">
                    <label className="ad-form-label">
                      Select Freelancer
                      {matchedFreelancers.length > 0 && (
                        <span className="ad-assign-match-pill matched" style={{ marginLeft: 10 }}>
                          ✓ {matchedFreelancers.length} expert{matchedFreelancers.length > 1 ? 's' : ''} matched
                        </span>
                      )}
                    </label>
                    <select
                      className="ad-form-select"
                      value={selectedFreelancerId}
                      onChange={e => setSelectedFreelancerId(e.target.value === '' ? '' : Number(e.target.value))}
                      required
                    >
                      <option value="">— Choose a freelancer —</option>

                      {/* Matched by expertise — shown first */}
                      {matchedFreelancers.length > 0 && (
                        <optgroup label={`✓ Matched for "${category}" (${matchedFreelancers.length})`}>
                          {matchedFreelancers.map(f => (
                            <option key={f.id} value={f.id}>
                              {f.name} · {(f.services || []).slice(0, 2).join(', ')}
                            </option>
                          ))}
                        </optgroup>
                      )}

                      {/* Other freelancers — different expertise */}
                      {otherFreelancers.length > 0 && (
                        <optgroup label={`Other Freelancers (${otherFreelancers.length})`}>
                          {otherFreelancers.map(f => (
                            <option key={f.id} value={f.id}>
                              {f.name} · {(f.services || []).slice(0, 2).join(', ') || 'No expertise listed'}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>

                    {/* Show selected freelancer's expertise tags */}
                    {selectedFreelancerId !== '' && (() => {
                      const sel = freelancers.find(f => f.id === selectedFreelancerId);
                      if (!sel) return null;
                      const isMatch = matchedFreelancers.includes(sel);
                      return (
                        <div className="ad-assign-selected-info">
                          <span className={`ad-assign-match-pill ${isMatch ? 'matched' : 'other'}`}>
                            {isMatch ? '✓ Expertise matches this task' : '⚠ Expertise may not match'}
                          </span>
                          <div className="ad-assign-selected-tags">
                            {(sel.services || []).map(s => (
                              <span key={s} className={`ad-assign-tag ${s.toLowerCase().includes(category.toLowerCase()) || category.toLowerCase().includes(s.toLowerCase()) ? 'highlight' : ''}`}>
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="ad-form-row">
                    <label className="ad-form-label">Freelancer Payout Fee (₹)</label>
                    <input
                      className="ad-form-input"
                      type="number"
                      value={payoutAmount}
                      onChange={e => setPayoutAmount(Number(e.target.value))}
                      max={assigningOrder.price}
                      required
                    />
                    <small style={{ color: '#888', display: 'block', marginTop: 4 }}>
                      Client paid ₹{assigningOrder.price.toLocaleString()} · Suggested: ₹{Math.floor(assigningOrder.price * 0.7).toLocaleString()} (70%)
                    </small>
                  </div>
                </form>
              </div>
              <div className="ad-modal-footer">
                <button className="ad-btn-secondary" onClick={() => setAssigningOrder(null)}>Cancel</button>
                <button className="ad-btn-primary" form="assignForm" type="submit">🎯 Assign Task</button>
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

      {/* MESSAGES RELAY MODAL */}
      {relayOrder && (
        <div className="ad-modal-overlay" onClick={() => setRelayOrder(null)}>
          <div className="ad-modal wide" onClick={e => e.stopPropagation()}>
            <div className="ad-modal-header">
              <h2>💬 Relay Support — #WN-{relayOrder.id}</h2>
              <button className="ad-modal-close" onClick={() => setRelayOrder(null)}>×</button>
            </div>
            <div className="ad-modal-body">
              <div className="ad-chat-list">
                {chatMessages.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#aaa', padding: '20px 0', fontSize: 13 }}>No messages yet.</p>
                ) : (
                  chatMessages.map(msg => {
                    const isSystem = msg.senderId === 0;
                    const isMe = msg.senderRole === 'admin';
                    return (
                      <div key={msg.id} className={`ad-chat-msg${isMe ? ' me' : ''}`}>
                        <div className={`ad-chat-av${isMe ? ' me' : ''}`}>{isMe ? initials : 'U'}</div>
                        <div>
                          <div className="ad-chat-bubble">{msg.messageText}</div>
                          <div className="ad-chat-time">{isSystem ? 'SYSTEM LOG' : `${msg.senderRole.toUpperCase()}`} · {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <form onSubmit={handleSendRelayMessage}>
                <div className="ad-chat-input-row">
                  <input className="ad-chat-input" required placeholder="Type support message to relay..." value={relayText} onChange={e => setRelayText(e.target.value)} />
                  <button type="submit" className="ad-chat-send">Relay</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

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

      {/* EDIT ORDER PRICE MODAL */}
      {editPriceOrder && (
        <div className="ad-modal-overlay" onClick={() => setEditPriceOrder(null)}>
          <div className="ad-modal" onClick={e => e.stopPropagation()}>
            <div className="ad-modal-header">
              <h2>✏️ Customize Order Price — #WN-{editPriceOrder.id}</h2>
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
              </form>
            </div>
            <div className="ad-modal-footer">
              <button className="ad-btn-secondary" onClick={() => setEditPriceOrder(null)}>Cancel</button>
              <button className="ad-btn-primary" form="editPriceForm" type="submit">Save &amp; Sync Price to Client Portal</button>
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
