import { useState, useEffect } from 'react';
import { getUser, getToken, logout } from '../utils/auth.js';
import { API_BASE } from '../config.js';
import './AdminDashboard.css';

interface Order {
  id: number;
  clientId: number;
  serviceCategory: string;
  tier: string;
  price: number;
  status: string;
  description: string;
  submissionLink: string;
  qaApprovedLink: string;
  freelancerId?: number;
  freelancerPayoutAmount?: number;
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

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    let interval: any;
    if (relayOrder) {
      fetchMessages(relayOrder.id);
      interval = setInterval(() => fetchMessages(relayOrder.id), 4000);
    }
    return () => clearInterval(interval);
  }, [relayOrder]);

  const fetchDashboardData = async () => {
    setLoading(true);
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

      setOrders(dataOrders.data || []);
      if (resFl.ok) setFreelancers(dataFl.data || []);
      if (resT.ok) setTestimonials(dataT.data || []);
      if (resB.ok) setBlogsList(dataB.data || []);
      if (resBu.ok) setBundlesList(dataBu.data || []);
      if (resTeam.ok) setTeamList(dataTeam.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };


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

  const handlePayoutRelease = async (orderId: number) => {
    if (!isMaster) return;
    setError(''); setSuccess('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/orders/${orderId}/payout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ markAsPaid: true })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payout release failed');
      setSuccess('Payout released and marked paid. Order complete!');
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
    try {
      const res = await fetch(`${API_BASE}/api/admin/orders/${relayOrder.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messageText: relayText })
      });
      if (res.ok) {
        setRelayText('');
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
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(teamForm)
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


  // ── CSV EXPORT MOCK ───────────────────────────────────────────
  const exportToCSV = (filename: string) => {
    setSuccess(`CSV Export started: Saved ${filename} download to desktop.`);
    setTimeout(() => setSuccess(''), 4000);
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

          <p className="ad-nav-label">Finance &amp; Payments</p>
          <button className={`ad-nav-item${currentView === 'payouts' ? ' active' : ''}`} onClick={() => goView('payouts')}>
            <span className="ad-nav-icon">💸</span><span>Batch Payouts</span>
            {payoutDue > 0 && <span className="ad-nav-badge">₹{payoutDue / 1000}K</span>}
          </button>
          <button className={`ad-nav-item${currentView === 'invoices' ? ' active' : ''}`} onClick={() => goView('invoices')}>
            <span className="ad-nav-icon">🧾</span><span>GST Invoices</span>
          </button>

          <p className="ad-nav-label">CMS &amp; Web Controls</p>
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
                </div>
                {orders.filter(o => o.status === 'paid').length === 0 ? (
                  <p style={{ color: '#888', textAlign: 'center', padding: 40 }}>All paid orders successfully assigned to freelancers!</p>
                ) : (
                  <div className="ad-qc-grid">
                    {orders.filter(o => o.status === 'paid').map(o => (
                      <div className="ad-qc-card" key={o.id}>
                        <div className="ad-qc-header">
                          <h3>Order #WN-{o.id} · {o.serviceCategory}</h3>
                          <b>Client Price: ₹{o.price.toLocaleString()}</b>
                        </div>
                        <p className="ad-qc-brief">{o.description}</p>
                        <div className="ad-qc-actions">
                          <button className="ad-btn-primary" onClick={() => { setAssigningOrder(o); setPayoutAmount(Math.floor(o.price * 0.7)); }}>Assign Freelancer Account</button>
                        </div>
                      </div>
                    ))}
                  </div>
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
                  <button className="ad-export-btn" onClick={() => exportToCSV('Clients_Directory_LTV.csv')}>📥 Export CSV</button>
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

            {/* ════ VIEW: PAYOUTS BATCH ════ */}
            {currentView === 'payouts' && (
              <>
                <div className="ad-view-header">
                  <p>Settlement desk</p>
                  <h1>Freelancer Batch Payouts</h1>
                </div>
                {orders.filter(o => o.status === 'qa_approved').length === 0 ? (
                  <p style={{ color: '#888', textAlign: 'center', padding: 40 }}>All freelancer payouts have been settled.</p>
                ) : (
                  <div className="ad-table-wrap">
                    <table className="ad-table">
                      <thead>
                        <tr><th>Order ID</th><th>Service</th><th>Assigned Freelancer</th><th>Payout Amount</th><th>Release Funds</th></tr>
                      </thead>
                      <tbody>
                        {orders.filter(o => o.status === 'qa_approved').map(o => (
                          <tr key={o.id}>
                            <td><b>#WN-{o.id}</b></td>
                            <td>{o.serviceCategory}</td>
                            <td>{o.freelancer?.name}</td>
                            <td><b>₹{o.freelancerPayoutAmount?.toLocaleString()}</b></td>
                            <td>
                              <button className="ad-btn-primary" onClick={() => handlePayoutRelease(o.id)}>Release Payment</button>
                            </td>
                          </tr>
                        ))}
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
                      {orders.map((o, i) => (
                        <tr key={o.id}>
                          <td><b>INV-2026-{100 + i}</b></td>
                          <td>Order #WN-{o.id}</td>
                          <td>{o.client?.name}</td>
                          <td>₹{o.price.toLocaleString()}</td>
                          <td>₹{Math.round(o.price * 0.18).toLocaleString()}</td>
                          <td><button className="ad-pag-btn" onClick={() => exportToCSV(`GST_Invoice_WN-${o.id}.pdf`)}>📄 Export PDF</button></td>
                        </tr>
                      ))}
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

      {/* ASSIGN MODAL */}
      {assigningOrder && (
        <div className="ad-modal-overlay" onClick={() => setAssigningOrder(null)}>
          <div className="ad-modal" onClick={e => e.stopPropagation()}>
            <div className="ad-modal-header">
              <h2>🎯 Assign Task — Order #WN-{assigningOrder.id}</h2>
              <button className="ad-modal-close" onClick={() => setAssigningOrder(null)}>×</button>
            </div>
            <div className="ad-modal-body">
              <form id="assignForm" onSubmit={handleAssignOrder}>
                <div className="ad-form-row">
                  <label className="ad-form-label">Select Vetted Freelancer</label>
                  <select className="ad-form-select" value={selectedFreelancerId} onChange={e => setSelectedFreelancerId(e.target.value === '' ? '' : Number(e.target.value))} required>
                    <option value="">Choose freelancer...</option>
                    {freelancers.map(f => (
                      <option key={f.id} value={f.id}>{f.name} ({f.email})</option>
                    ))}
                  </select>
                </div>
                <div className="ad-form-row">
                  <label className="ad-form-label">Freelancer Payout Fee (₹)</label>
                  <input className="ad-form-input" type="number" value={payoutAmount} onChange={e => setPayoutAmount(Number(e.target.value))} max={assigningOrder.price} required />
                  <small style={{ color: '#888', display: 'block', marginTop: 4 }}>Client price paid: ₹{assigningOrder.price.toLocaleString()}</small>
                </div>
              </form>
            </div>
            <div className="ad-modal-footer">
              <button className="ad-btn-secondary" onClick={() => setAssigningOrder(null)}>Cancel</button>
              <button className="ad-btn-primary" form="assignForm" type="submit">Assign Task</button>
            </div>
          </div>
        </div>
      )}

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
                  <label className="ad-form-label">Profile Image Link (URL)</label>
                  <input className="ad-form-input" type="url" required placeholder="https://images.unsplash.com/..." value={teamForm.image} onChange={e => setTeamForm({ ...teamForm, image: e.target.value })} />
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
