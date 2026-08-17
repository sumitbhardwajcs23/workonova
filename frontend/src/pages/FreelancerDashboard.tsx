import { useState, useEffect, useRef } from 'react';
import { getUser, getToken, logout } from '../utils/auth.js';
import WelcomePopup from '../components/WelcomePopup.tsx';
import { downloadFreelancerPayoutVoucherPDF } from '../utils/pdfInvoice.js';
import { API_BASE } from '../config.js';
import './FreelancerDashboard.css';

interface Task {
  id: number;
  serviceCategory: string;
  tier: string;
  description: string;
  submissionLink: string; // Client's initial raw assets / Drive / Dropbox link
  freelancerSubmissionLink?: string; // Freelancer's delivered assets link
  midpointSubmissionLink?: string;
  midpointSubmissionNotes?: string;
  midpointApprovedAt?: string;
  qaApprovedLink?: string;
  status: string;
  milestoneStage?: number;
  amountPaid?: number;
  freelancerPayoutAmount: number;
  payoutStatus?: string;
  payoutReleasedAt?: string;
  adminRevisionComments?: string;
  createdAt: string;
  updatedAt?: string;
}

interface Message {
  id: number;
  orderId: number;
  senderId: number;
  senderRole: string;
  messageText: string;
  createdAt: string;
}

// Help map tags & clients based on category for visualization matching the screenshots
const getTechTags = (category: string) => {
  const cat = category.toLowerCase();
  if (cat.includes('web') || cat.includes('software') || cat.includes('app')) {
    return ['Next.js 15', 'Tailwind', 'Razorpay', 'Vercel'];
  }
  if (cat.includes('ai') || cat.includes('automation') || cat.includes('chat')) {
    return ['OpenAI API', 'LangChain', 'Python', 'FastAPI'];
  }
  if (cat.includes('video') || cat.includes('motion') || cat.includes('vfx') || cat.includes('edit')) {
    return ['Premiere Pro', 'After Effects', 'Color Grading', 'Subtitles'];
  }
  return ['Figma', 'Brand Guidelines', 'Typography', 'Iconography'];
};

const getClientName = (taskId: number) => {
  return `Client #WN-${taskId}`;
};

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

export default function FreelancerDashboard() {
  const user = getUser();
  const token = getToken();

  const [tasksList, setTasksList] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const triggerToast = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 4000);
  };

  // Submit Modal state
  const [submittingTask, setSubmittingTask] = useState<Task | null>(null);
  const [deliveryLink, setDeliveryLink] = useState('');

  // 50% Midpoint Modal State
  const [midpointModalTask, setMidpointModalTask] = useState<Task | null>(null);
  const [midpointLink, setMidpointLink] = useState('');
  const [midpointNotes, setMidpointNotes] = useState('');
  const [midpointSubmitting, setMidpointSubmitting] = useState(false);

  // Profile & Bank Details State
  const [profile, setProfile] = useState<{ name?: string; email?: string; phone?: string; services: string[]; portfolioLink?: string; bankDetails?: any } | null>(null);
  const [editName, setEditName] = useState(user?.name || '');
  const [editPhone, setEditPhone] = useState((user as any)?.phone || '');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [profileSaving, setProfileSaving] = useState(false);

  // Email Change OTP State
  const [emailChangeModalOpen, setEmailChangeModalOpen] = useState(false);
  const [newEmailInput, setNewEmailInput] = useState('');
  const [emailOtpInput, setEmailOtpInput] = useState('');
  const [emailOtpSent, setEmailOtpSent] = useState(false);

  const [bankForm, setBankForm] = useState({
    accountName: '',
    accountNumber: '',
    ifscCode: '',
    upiId: '',
    bankName: '',
    portfolioLink: '',
  });

  const ALL_SERVICES = [
    'Graphic Designing', 'Video Editing', '3D Design & Modeling', 'VFX',
    'Animation', 'Digital Marketing', 'Website Development', 'Software Development',
    'App Development', 'AI Services', 'IT Services', 'Cyber Security'
  ];

  const handleToggleService = (service: string) => {
    if (selectedServices.includes(service)) {
      setSelectedServices(selectedServices.filter(s => s !== service));
    } else {
      if (selectedServices.length >= 4) {
        triggerToast('⚠️ Maximum 4 vetted services allowed.');
        return;
      }
      setSelectedServices([...selectedServices, service]);
    }
  };

  // Chat State
  const [activeChatTask, setActiveChatTask] = useState<Task | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);

  // View States
  const [currentView, setCurrentView] = useState('all'); // all, cat-web, cat-ai, cat-video, revision, review, ledger, profile
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetchTasks();
    fetchProfile();

    // Fast real-time synchronization (every 2s when tab is active)
    const syncInterval = setInterval(() => {
      if (!document.hidden) {
        fetchTasks(true);
      }
    }, 2000);

    const handleVisibilitySync = () => {
      if (!document.hidden) {
        fetchTasks(true);
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

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.profile) {
        setProfile(data.profile);
        setEditName(data.profile.name || user?.name || '');
        setEditPhone(data.profile.phone || '');
        setSelectedServices(Array.isArray(data.profile.services) ? data.profile.services : []);
        setBankForm({
          accountName: data.profile.bankDetails?.accountName || '',
          accountNumber: data.profile.bankDetails?.accountNumber || '',
          ifscCode: data.profile.bankDetails?.ifscCode || '',
          upiId: data.profile.bankDetails?.upiId || '',
          bankName: data.profile.bankDetails?.bankName || '',
          portfolioLink: data.profile.portfolioLink || '',
        });
      }
    } catch (e) {
      console.error('Failed to fetch profile:', e);
    }
  };

  const handleSaveFullProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedServices.length === 0) {
      triggerToast('⚠️ Please select at least 1 vetted service.');
      return;
    }
    if (selectedServices.length > 4) {
      triggerToast('⚠️ You can select a maximum of 4 services.');
      return;
    }
    setProfileSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editName,
          phone: editPhone,
          portfolioLink: bankForm.portfolioLink,
          services: selectedServices,
          bankDetails: {
            accountName: bankForm.accountName,
            accountNumber: bankForm.accountNumber,
            ifscCode: bankForm.ifscCode,
            upiId: bankForm.upiId,
            bankName: bankForm.bankName,
          }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile');
      triggerToast('✅ Profile & Vetted Services updated successfully!');
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

  const handleSubmitMidpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!midpointLink || !midpointModalTask) return;
    setMidpointSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/freelancer/tasks/${midpointModalTask.id}/submit-midpoint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          midpointSubmissionLink: midpointLink,
          midpointSubmissionNotes: midpointNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit 50% midpoint work');
      triggerToast('🎉 50% Midpoint work submitted! Client notified for review.');
      setMidpointModalTask(null);
      setMidpointLink('');
      setMidpointNotes('');
      fetchTasks();
    } catch (err: any) {
      triggerToast('❌ Error: ' + err.message);
    } finally {
      setMidpointSubmitting(false);
    }
  };

  useEffect(() => {
    let interval: any;
    if (activeChatTask) {
      fetchMessages(activeChatTask.id);
      interval = setInterval(() => {
        if (!document.hidden) {
          fetchMessages(activeChatTask.id);
        }
      }, 1200);
    }
    return () => clearInterval(interval);
  }, [activeChatTask]);

  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const fetchTasks = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/freelancer/tasks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch tasks');
      
      const tasks = data.data || [];
      setTasksList(tasks);
    } catch (err: any) {
      if (!silent) setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleDeliverTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveryLink || !submittingTask) return;
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_BASE}/api/freelancer/tasks/${submittingTask.id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ submissionLink: deliveryLink })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit task assets');

      setSuccess('Task asset delivered successfully! Status updated to submitted.');
      setSubmittingTask(null);
      setDeliveryLink('');
      fetchTasks();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchMessages = async (taskId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/freelancer/tasks/${taskId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setChatMessages(data.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText || !activeChatTask) return;
    const textToSend = newMessageText.trim();
    if (!textToSend) return;

    // Optimistic UI update: render message immediately with 0ms latency
    const optimisticMsg = {
      id: Date.now(),
      orderId: activeChatTask.id,
      senderId: 0,
      senderRole: 'freelancer' as const,
      messageText: textToSend,
      createdAt: new Date().toISOString(),
    };
    setChatMessages(prev => [...prev, optimisticMsg]);
    setNewMessageText('');

    try {
      const res = await fetch(`${API_BASE}/api/freelancer/tasks/${activeChatTask.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ messageText: textToSend })
      });
      if (res.ok) {
        fetchMessages(activeChatTask.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ── COUNTS & FILTERING ────────────────────────────────────────
  const activeTasks = tasksList.filter(t => !['delivered', 'cancelled'].includes(t.status));

  const getCategoryFromService = (service: string): string => {
    const s = service.toLowerCase();
    if (s.includes('design') || s.includes('logo') || s.includes('graphic')) return 'design';
    if (s.includes('video') || s.includes('edit') || s.includes('motion') || s.includes('vfx') || s.includes('anim')) return 'video';
    if (s.includes('ai') || s.includes('automation') || s.includes('chatbot')) return 'ai';
    if (s.includes('content') || s.includes('marketing') || s.includes('copy')) return 'content';
    return 'web';
  };

  const getFilteredTasks = () => {
    return tasksList.filter(t => {
      // Status/workflow filter
      if (currentView === 'all') {
        if (t.status === 'delivered' || t.status === 'cancelled') return false;
      } else if (currentView === 'revision') {
        if (t.status !== 'revision_requested') return false;
      } else if (currentView === 'review') {
        if (t.status !== 'submitted' && t.status !== 'qa_approved') return false;
      } else if (currentView.startsWith('cat-')) {
        const cat = currentView.replace('cat-', '');
        if (getCategoryFromService(t.serviceCategory) !== cat) return false;
        if (t.status === 'delivered' || t.status === 'cancelled') return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const client = getClientName(t.id).toLowerCase();
        const tech = getTechTags(getCategoryFromService(t.serviceCategory)).join(' ').toLowerCase();
        return t.serviceCategory.toLowerCase().includes(q) || t.id.toString().includes(q) || client.includes(q) || tech.includes(q);
      }

      return true;
    });
  };

  const catCount = (catKey: string) => {
    return tasksList.filter(t => getCategoryFromService(t.serviceCategory) === catKey && !['delivered', 'cancelled'].includes(t.status)).length;
  };

  const revisionCount = tasksList.filter(t => t.status === 'revision_requested').length;
  const reviewCount = tasksList.filter(t => t.status === 'submitted' || t.status === 'qa_approved').length;

  const initials = getInitials(user?.name || 'Freelancer');
  const filteredTasks = getFilteredTasks();

  return (
    <div className="fd-root">
      <WelcomePopup role="freelancer" />

      {/* ═══════════ SIDEBAR ═══════════ */}
      {sidebarOpen && <div className="cd-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      <aside className={`fd-sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="fd-logo-block">
          <img src="/assets/workonova-logo.webp" alt="Logo" />
          <span className="fd-crew-pill">Crew</span>
        </div>

        <div className="fd-sidebar-nav">
          <p className="fd-nav-label">Tasks</p>
          <button className={`fd-nav-item${currentView === 'all' ? ' active' : ''}`} onClick={() => { setCurrentView('all'); setSidebarOpen(false); }}>
            <span className="fd-nav-icon">📁</span><span>All Active Tasks</span>
            {activeTasks.length > 0 && <span className="fd-nav-badge">{activeTasks.length}</span>}
          </button>
          
          <button className={`fd-nav-item${currentView === 'cat-web' ? ' active' : ''}`} onClick={() => { setCurrentView('cat-web'); setSidebarOpen(false); }}>
            <span className="fd-nav-icon">🌐</span><span>Web Development</span>
            {catCount('web') > 0 && <span className="fd-nav-badge">{catCount('web')}</span>}
          </button>

          <button className={`fd-nav-item${currentView === 'cat-ai' ? ' active' : ''}`} onClick={() => { setCurrentView('cat-ai'); setSidebarOpen(false); }}>
            <span className="fd-nav-icon">⚡</span><span>AI &amp; Automation</span>
            {catCount('ai') > 0 && <span className="fd-nav-badge">{catCount('ai')}</span>}
          </button>

          <button className={`fd-nav-item${currentView === 'cat-video' ? ' active' : ''}`} onClick={() => { setCurrentView('cat-video'); setSidebarOpen(false); }}>
            <span className="fd-nav-icon">🎬</span><span>Video Post-Production</span>
            {catCount('video') > 0 && <span className="fd-nav-badge">{catCount('video')}</span>}
          </button>

          <p className="fd-nav-label">Workflow</p>
          <button className={`fd-nav-item${currentView === 'revision' ? ' active' : ''}`} onClick={() => { setCurrentView('revision'); setSidebarOpen(false); }}>
            <span className="fd-nav-icon">🔄</span><span>Revision Desk</span>
            {revisionCount > 0 && <span className="fd-nav-badge urgent">{revisionCount}</span>}
          </button>

          <button className={`fd-nav-item${currentView === 'review' ? ' active' : ''}`} onClick={() => { setCurrentView('review'); setSidebarOpen(false); }}>
            <span className="fd-nav-icon">📤</span><span>Submitted for Review</span>
            {reviewCount > 0 && <span className="fd-nav-badge">{reviewCount}</span>}
          </button>

          <button className={`fd-nav-item${currentView === 'ledger' ? ' active' : ''}`} onClick={() => { setCurrentView('ledger'); setSidebarOpen(false); }}>
            <span className="fd-nav-icon">💰</span><span>Earnings &amp; Invoices</span>
          </button>

          <button className={`fd-nav-item${currentView === 'profile' ? ' active' : ''}`} onClick={() => { setCurrentView('profile'); setSidebarOpen(false); }}>
            <span className="fd-nav-icon">⚙️</span><span>Profile Settings</span>
          </button>
        </div>
      </aside>

      {/* ═══════════ HEADER ═══════════ */}
      <div className="fd-header">
        <button className="cd-hamburger" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Menu">
          <span /><span /><span />
        </button>

        <div className="fd-online-pill">
          <span className="fd-online-dot" />
          System Online
        </div>

        {/* Search */}
        <div className="fd-search">
          <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 14, height: 14, color: '#aaa' }}><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
          <input
            type="search"
            placeholder="Search by Order ID, Client, Tech Stack..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {/* User profile actions */}
        <div className="fd-header-right">
          <div className="fd-user-pill" onClick={() => setCurrentView('profile')}>
            <div className="fd-avatar">{initials}</div>
            <div className="fd-user-meta">
              <b>{user?.name || 'Specialist'}</b>
              <small>Workonova Specialist</small>
            </div>
          </div>
          <button className="fd-logout-btn" onClick={logout}>Log out</button>
        </div>
      </div>

      {/* ═══════════ MAIN CONTENT ═══════════ */}
      <div className="fd-main">
        {error && <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}
        {success && <div style={{ background: '#dcfce7', border: '1px solid #86efac', color: '#166534', padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{success}</div>}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>Loading assignments...</div>
        ) : (
          <>
            {/* ════ TASKS LIST VIEWS ════ */}
            {!['ledger', 'profile'].includes(currentView) && (
              <>
                <div className="fd-view-header">
                  <p>All Active Tasks</p>
                  <h1>My Tasks</h1>
                </div>

                {filteredTasks.length === 0 ? (
                  <div className="cd-empty">
                    <div className="cd-empty-icon">📁</div>
                    <h2>No Task Assignments</h2>
                    <p>No active tasks match this category filter.</p>
                  </div>
                ) : (
                  filteredTasks.map(task => {
                    const cat = getCategoryFromService(task.serviceCategory);
                    const tech = getTechTags(cat);
                    const client = getClientName(task.id);
                    return (
                      <article className={`fd-task-card cat-${cat}`} key={task.id}>
                        <div className="fd-card-head">
                          <div className="fd-card-tags">
                            <span className={`fd-cat-pill ${cat}`}>{task.serviceCategory}</span>
                            <span className="fd-order-id">ORDER #WN-2026-{task.id}</span>
                          </div>
                          <div className="fd-card-right">
                            <span className={`fd-status-pill ${task.status}`}>{task.status.replace('_', ' ').toUpperCase()}</span>
                            <span className="fd-assigned">Payout: <b>₹{task.freelancerPayoutAmount?.toLocaleString() || 0}</b></span>
                          </div>
                        </div>

                        <div className="fd-card-body">
                          <h2 className="fd-task-title">{task.serviceCategory} - Build Setup</h2>
                          <div className="fd-client-lbl">Client: <b>{client}</b></div>
                          
                          {/* Tech row */}
                          <div className="fd-tech-row">
                            {tech.map(t => <span className="fd-tech-pill" key={t}>{t}</span>)}
                          </div>

                          {/* Instructions description */}
                          <div className="fd-instruction-box">
                            <b>Brief Instructions:</b> "{task.description}"
                          </div>

                          {/* Client Raw Assets & Drive Link */}
                          {task.submissionLink && (
                            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                              <a
                                href={task.submissionLink}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  background: 'rgba(99, 102, 241, 0.15)',
                                  border: '1px solid #6366f1',
                                  color: '#a5b4fc',
                                  padding: '7px 14px',
                                  borderRadius: 6,
                                  fontSize: 12.5,
                                  fontWeight: 600,
                                  textDecoration: 'none',
                                }}
                              >
                                📁 Client Raw Assets &amp; Drive Folder ↗
                              </a>
                              {task.freelancerSubmissionLink && (
                                <a
                                  href={task.freelancerSubmissionLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{
                                    color: '#34d399',
                                    fontSize: 12,
                                    textDecoration: 'underline',
                                    fontWeight: 600,
                                  }}
                                >
                                  ✓ View Your Delivered Work ↗
                                </a>
                              )}
                            </div>
                          )}

                          {task.adminRevisionComments && (
                            <div style={{ background: '#fee2e2', borderLeft: '3.5px solid #ef4444', padding: '10px 14px', borderRadius: 6, fontSize: 12.5, color: '#991b1b', marginTop: 12 }}>
                              <b>Revision Requested by QA / Client:</b> "{task.adminRevisionComments}"
                            </div>
                          )}
                        </div>

                        <div className="fd-card-actions">
                          <button className="fd-action-btn" onClick={() => setActiveChatTask(task)}>
                            💬 Ask Clarification
                          </button>

                          {/* 50% Midpoint Submission Trigger */}
                          {['assigned', 'paid_50'].includes(task.status) && (
                            <button
                              className="fd-action-btn primary"
                              style={{ background: '#6366f1', borderColor: '#4f46e5' }}
                              onClick={() => {
                                setMidpointModalTask(task);
                                setMidpointLink('');
                                setMidpointNotes('');
                              }}
                            >
                              📤 Submit 50% Midpoint Deliverable →
                            </button>
                          )}

                          {task.status === 'midpoint_submitted' && (
                            <span style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600, padding: '6px 12px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: 6, border: '1px solid #f59e0b' }}>
                              ⏳ 50% Midpoint Under Client Review
                            </span>
                          )}

                          {/* 100% Final Deliverables Trigger */}
                          {['midpoint_approved', 'paid_75', 'revision_requested'].includes(task.status) && (
                            <button
                              className="fd-action-btn primary"
                              style={{ background: '#10b981', borderColor: '#059669' }}
                              onClick={() => setSubmittingTask(task)}
                            >
                              🚀 Deliver 100% Final Work →
                            </button>
                          )}

                          {['submitted', 'qa_approved'].includes(task.status) && (
                            <span style={{ fontSize: 12, color: '#818cf8', fontWeight: 600, padding: '6px 12px', background: 'rgba(129, 140, 248, 0.1)', borderRadius: 6, border: '1px solid #818cf8' }}>
                              ⏳ Final Deliverables Under QA &amp; Client Review
                            </span>
                          )}

                          {task.status === 'client_approved' && (
                            <span style={{ fontSize: 12, color: '#34d399', fontWeight: 600, padding: '6px 12px', background: 'rgba(52, 211, 153, 0.1)', borderRadius: 6, border: '1px solid #34d399' }}>
                              🛡️ Client Approved · Payout Regulated by Admin
                            </span>
                          )}

                          {['completed', 'delivered'].includes(task.status) && (
                            <button
                              className="fd-action-btn"
                              style={{ background: '#064e3b', color: '#34d399', borderColor: '#10b981', fontWeight: 'bold' }}
                              onClick={() => {
                                downloadFreelancerPayoutVoucherPDF({
                                  orderId: task.id,
                                  freelancerName: profile?.name || user?.name || 'Vetted Specialist',
                                  freelancerEmail: profile?.email || user?.email || 'specialist@workonova.com',
                                  serviceCategory: task.serviceCategory,
                                  tier: task.tier || 'STANDARD',
                                  payoutAmount: task.freelancerPayoutAmount || 10000,
                                  payoutStatus: task.payoutStatus || 'payout_released',
                                  payoutReleasedAt: task.payoutReleasedAt,
                                  date: new Date(task.updatedAt || task.createdAt).toLocaleDateString('en-IN'),
                                });
                                triggerToast(`📥 Downloaded Payout Voucher #WN-PAYOUT-WN-${task.id}.pdf`);
                              }}
                            >
                              📄 Download Payout PDF Voucher
                            </button>
                          )}

                          <button className="fd-action-btn" onClick={() => triggerToast('📅 Extension request details sent to QA Admin.')}>
                            📅 Request Extension
                          </button>
                        </div>
                      </article>
                    );
                  })
                )}
              </>
            )}

            {/* ════ EARNINGS & PAYOUT LEDGER ════ */}
            {currentView === 'ledger' && (
              <>
                <div className="fd-view-header">
                  <p>Payout Ledger</p>
                  <h1>Earnings &amp; Admin-Regulated Payouts</h1>
                </div>
                <div className="cd-kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
                  <div className="cd-kpi-card"><div className="cd-kpi-icon money">₹</div><div><b>₹{tasksList.filter(t => t.payoutStatus === 'payout_released' || t.status === 'completed' || t.status === 'delivered').reduce((acc, t) => acc + (t.freelancerPayoutAmount || 0), 0).toLocaleString()}</b><small>Disbursed Payouts</small></div></div>
                  <div className="cd-kpi-card"><div className="cd-kpi-icon live">⚡</div><div><b>₹{tasksList.filter(t => ['client_approved', 'qa_approved'].includes(t.status) && t.payoutStatus !== 'payout_released').reduce((acc, t) => acc + (t.freelancerPayoutAmount || 0), 0).toLocaleString()}</b><small>In Admin Regulation Queue</small></div></div>
                  <div className="cd-kpi-card"><div className="cd-kpi-icon done">✓</div><div><b>{tasksList.filter(t => ['completed', 'delivered'].includes(t.status)).length}</b><small>Completed Deliveries</small></div></div>
                </div>

                <p className="cd-section-title">Specialist Payout Statements</p>
                <div className="fd-ledger">
                  {tasksList.map(t => {
                    const isDisbursed = t.payoutStatus === 'payout_released' || t.status === 'completed' || t.status === 'delivered';
                    const isApproved = t.payoutStatus === 'payout_approved';
                    return (
                      <div className="fd-ledger-item" key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                        <div className="fd-ledger-info">
                          <b>Task #WN-{t.id} — {t.serviceCategory}</b>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                            <span style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: isDisbursed ? 'rgba(16, 185, 129, 0.15)' : isApproved ? 'rgba(99, 102, 241, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                              color: isDisbursed ? '#34d399' : isApproved ? '#a5b4fc' : '#fbbf24',
                              border: `1px solid ${isDisbursed ? '#10b981' : isApproved ? '#6366f1' : '#f59e0b'}`
                            }}>
                              {isDisbursed ? '✓ PAYOUT RELEASED' : isApproved ? '🛡️ ADMIN APPROVED' : '⏳ PENDING ADMIN REGULATION'}
                            </span>
                            <small style={{ color: '#94a3b8' }}>Updated: {new Date(t.updatedAt || t.createdAt).toLocaleDateString()}</small>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          <span className="fd-ledger-amount" style={{ color: isDisbursed ? '#34d399' : '#a5b4fc' }}>
                            ₹{t.freelancerPayoutAmount?.toLocaleString() || 0}
                          </span>
                          <button
                            style={{
                              background: '#1e293b',
                              border: '1px solid #475569',
                              color: '#ffffff',
                              padding: '6px 12px',
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                            onClick={() => {
                              downloadFreelancerPayoutVoucherPDF({
                                orderId: t.id,
                                freelancerName: profile?.name || user?.name || 'Vetted Specialist',
                                freelancerEmail: profile?.email || user?.email || 'specialist@workonova.com',
                                serviceCategory: t.serviceCategory,
                                tier: t.tier || 'STANDARD',
                                payoutAmount: t.freelancerPayoutAmount || 10000,
                                payoutStatus: t.payoutStatus || 'pending_admin_approval',
                                payoutReleasedAt: t.payoutReleasedAt,
                                date: new Date(t.updatedAt || t.createdAt).toLocaleDateString('en-IN'),
                              });
                              triggerToast(`📄 Downloaded Voucher #WN-PAYOUT-WN-${t.id}.pdf`);
                            }}
                          >
                            📥 Download PDF Voucher
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {tasksList.length === 0 && (
                    <p className="fd-empty-text">No payout transactions recorded yet. Complete a task assignment to start earning payouts.</p>
                  )}
                </div>
              </>
            )}

            {/* ════ PROFILE & VETTED SERVICES SETTINGS ════ */}
            {currentView === 'profile' && (
              <>
                <div className="fd-view-header">
                  <p>Specialist Account</p>
                  <h1>Profile &amp; Vetted Services Settings</h1>
                </div>
                <div className="fd-profile-grid" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
                  <div className="fd-profile-card">
                    <h3>Specialist Profile &amp; Vetted Expertise</h3>
                    <form onSubmit={handleSaveFullProfile}>
                      <div className="fd-form-row">
                        <label className="fd-form-label">Full Legal Name</label>
                        <input
                          className="fd-form-input"
                          type="text"
                          required
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                        />
                      </div>
                      <div className="fd-form-row">
                        <label className="fd-form-label">Phone Number / WhatsApp</label>
                        <input
                          className="fd-form-input"
                          type="tel"
                          placeholder="+91 9876543210"
                          value={editPhone}
                          onChange={e => setEditPhone(e.target.value)}
                        />
                      </div>
                      <div className="fd-form-row">
                        <label className="fd-form-label">Portfolio URL (GitHub, Behance, Dribbble)</label>
                        <input
                          className="fd-form-input"
                          type="url"
                          placeholder="https://behance.net/yourprofile"
                          value={bankForm.portfolioLink}
                          onChange={e => setBankForm({ ...bankForm, portfolioLink: e.target.value })}
                        />
                      </div>

                      {/* Vetted Services Selection (Max 4) */}
                      <div className="fd-form-row" style={{ marginTop: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <label className="fd-form-label" style={{ marginBottom: 0 }}>Vetted Services Offered</label>
                          <span style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: selectedServices.length === 4 ? '#f59e0b' : '#34d399',
                            background: '#131722',
                            padding: '2px 8px',
                            borderRadius: 4,
                            border: '1px solid #1e293b'
                          }}>
                            Selected: {selectedServices.length}/4 (Max 4)
                          </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 6 }}>
                          {ALL_SERVICES.map(srv => {
                            const isChecked = selectedServices.includes(srv);
                            const isDisabled = !isChecked && selectedServices.length >= 4;
                            return (
                              <label
                                key={srv}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  padding: '8px 10px',
                                  borderRadius: 6,
                                  background: isChecked ? 'rgba(99, 102, 241, 0.15)' : '#131722',
                                  border: `1px solid ${isChecked ? '#6366f1' : '#1e293b'}`,
                                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                                  opacity: isDisabled ? 0.4 : 1,
                                  fontSize: 12,
                                  color: '#ffffff'
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  disabled={isDisabled}
                                  onChange={() => handleToggleService(srv)}
                                />
                                <span>{srv}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Bank & UPI Details */}
                      <h4 style={{ margin: '20px 0 10px 0', color: '#a5b4fc', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>Bank Payout Credentials</h4>
                      <div className="fd-form-row">
                        <label className="fd-form-label">UPI ID (Fast Payout)</label>
                        <input
                          className="fd-form-input"
                          type="text"
                          placeholder="username@upi"
                          value={bankForm.upiId}
                          onChange={e => setBankForm({ ...bankForm, upiId: e.target.value })}
                        />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div className="fd-form-row">
                          <label className="fd-form-label">Account Holder Name</label>
                          <input
                            className="fd-form-input"
                            type="text"
                            value={bankForm.accountName}
                            onChange={e => setBankForm({ ...bankForm, accountName: e.target.value })}
                          />
                        </div>
                        <div className="fd-form-row">
                          <label className="fd-form-label">Bank Name</label>
                          <input
                            className="fd-form-input"
                            type="text"
                            placeholder="e.g. HDFC Bank"
                            value={bankForm.bankName}
                            onChange={e => setBankForm({ ...bankForm, bankName: e.target.value })}
                          />
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div className="fd-form-row">
                          <label className="fd-form-label">Bank Account Number</label>
                          <input
                            className="fd-form-input"
                            type="text"
                            value={bankForm.accountNumber}
                            onChange={e => setBankForm({ ...bankForm, accountNumber: e.target.value })}
                          />
                        </div>
                        <div className="fd-form-row">
                          <label className="fd-form-label">Bank IFSC Code</label>
                          <input
                            className="fd-form-input"
                            type="text"
                            placeholder="HDFC0001234"
                            value={bankForm.ifscCode}
                            onChange={e => setBankForm({ ...bankForm, ifscCode: e.target.value })}
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="fd-btn-primary"
                        style={{ width: '100%', marginTop: 14, justifyContent: 'center' }}
                        disabled={profileSaving}
                      >
                        {profileSaving ? 'Saving Changes… ⏳' : '💾 Save Profile &amp; Services Updates'}
                      </button>
                    </form>
                  </div>

                  <div className="fd-profile-card">
                    <h3>Contact Email &amp; OTP Security</h3>
                    <div style={{ background: '#131722', border: '1px solid #1e293b', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Registered Specialist Email</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{profile?.email || user?.email}</span>
                        <span style={{ background: '#064e3b', color: '#34d399', fontSize: 10.5, padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>✓ Verified</span>
                      </div>
                    </div>
                    <p style={{ fontSize: 12.5, color: '#94a3b8', lineHeight: 1.5, marginBottom: 16 }}>
                      Changing your specialist account email requires receiving and confirming a 6-digit OTP sent to the new email address for payout security.
                    </p>
                    <button
                      type="button"
                      className="fd-btn-secondary"
                      style={{ width: '100%', padding: '10px 16px', fontWeight: 600, border: '1px solid #6366f1', color: '#a5b4fc', cursor: 'pointer' }}
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
          </>
        )}
      </div>

      {/* ═══════════ FOOTER ═══════════ */}
      <div className="fd-footer">
        <div className="fd-footer-left">
          <span className="fd-footer-dot" />
          WORKONOVA Crew Portal v2.0 · 🛡️ 100% Encrypted &amp; Secured
        </div>
        <div className="fd-footer-right">
          24/7 Crew Support · <a href="#chat" onClick={() => triggerToast('💬 Support chat requested.')}>Open Support Ticket</a>
        </div>
      </div>

      {/* 50% MIDPOINT DELIVERABLE MODAL */}
      {midpointModalTask && (
        <div className="fd-modal-overlay" onClick={() => setMidpointModalTask(null)}>
          <div className="fd-modal" onClick={e => e.stopPropagation()}>
            <div className="fd-modal-header">
              <h2>📤 Upload 50% Midpoint Deliverables — #{midpointModalTask.id}</h2>
              <button className="fd-modal-close" onClick={() => setMidpointModalTask(null)}>×</button>
            </div>
            <div className="fd-modal-body">
              <p style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 14 }}>
                Upload your 50% progress deliverable (draft designs, wireframes, cuts, initial prototype) for client review. Once approved, the client pays Milestone 2 (25%).
              </p>
              <form id="midpointForm" onSubmit={handleSubmitMidpoint}>
                <div className="fd-form-row">
                  <label className="fd-form-label">50% Deliverable Folder (Google Drive / Dropbox)</label>
                  <input
                    className="fd-form-input"
                    type="url"
                    required
                    placeholder="https://drive.google.com/drive/folders/..."
                    value={midpointLink}
                    onChange={e => setMidpointLink(e.target.value)}
                  />
                </div>
                <div className="fd-form-row">
                  <label className="fd-form-label">Progress Summary &amp; Notes for Client</label>
                  <textarea
                    className="fd-form-input"
                    rows={3}
                    placeholder="Describe what has been completed so far and next steps for the final version..."
                    value={midpointNotes}
                    onChange={e => setMidpointNotes(e.target.value)}
                  />
                </div>
              </form>
            </div>
            <div className="fd-modal-footer">
              <button className="fd-btn-secondary" onClick={() => setMidpointModalTask(null)}>Cancel</button>
              <button className="fd-btn-primary" form="midpointForm" type="submit" disabled={midpointSubmitting}>
                {midpointSubmitting ? 'Submitting… ⏳' : '✓ Submit 50% Midpoint for Review'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELIVER 100% FINAL ASSET MODAL */}
      {submittingTask && (
        <div className="fd-modal-overlay" onClick={() => setSubmittingTask(null)}>
          <div className="fd-modal" onClick={e => e.stopPropagation()}>
            <div className="fd-modal-header">
              <h2>🚀 Deliver 100% Final Assets — #{submittingTask.id}</h2>
              <button className="fd-modal-close" onClick={() => setSubmittingTask(null)}>×</button>
            </div>
            <div className="fd-modal-body">
              {submittingTask.description && (
                <div style={{ background: '#131722', border: '1px solid #1e293b', padding: 12, borderRadius: 6, marginBottom: 14, fontSize: 12.5, color: '#cbd5e1' }}>
                  <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Client Brief Reference</div>
                  "{submittingTask.description}"
                </div>
              )}
              <form id="deliverForm" onSubmit={handleDeliverTask}>
                <div className="fd-form-row">
                  <label className="fd-form-label">Google Drive or Dropbox Deliverables Link</label>
                  <input className="fd-form-input" id="delivery-link" type="url" required placeholder="https://drive.google.com/drive/folders/..." value={deliveryLink} onChange={e => setDeliveryLink(e.target.value)} />
                  <small style={{ color: '#888', fontSize: 11, marginTop: 4, display: 'block' }}>Provide link to your finished vector files, edits, renders, or source code.</small>
                </div>
              </form>
            </div>
            <div className="fd-modal-footer">
              <button className="fd-btn-secondary" onClick={() => setSubmittingTask(null)}>Cancel</button>
              <button className="fd-btn-primary" form="deliverForm" type="submit">Deliver Final Work</button>
            </div>
          </div>
        </div>
      )}

      {/* EMAIL CHANGE OTP MODAL */}
      {emailChangeModalOpen && (
        <div className="fd-modal-overlay" onClick={() => setEmailChangeModalOpen(false)}>
          <div className="fd-modal" onClick={e => e.stopPropagation()}>
            <div className="fd-modal-header">
              <h2>🔐 Update Account Email</h2>
              <button className="fd-modal-close" onClick={() => setEmailChangeModalOpen(false)}>×</button>
            </div>
            <div className="fd-modal-body">
              {!emailOtpSent ? (
                <div>
                  <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 14 }}>
                    Enter your new email address. We will immediately dispatch a 6-digit security OTP code to verify ownership.
                  </p>
                  <div className="fd-form-row">
                    <label className="fd-form-label">New Email Address</label>
                    <input
                      className="fd-form-input"
                      type="email"
                      required
                      placeholder="newemail@example.com"
                      value={newEmailInput}
                      onChange={e => setNewEmailInput(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="fd-btn-primary"
                    style={{ width: '100%', marginTop: 8 }}
                    disabled={profileSaving}
                    onClick={handleRequestEmailChange}
                  >
                    {profileSaving ? 'Sending OTP… ⏳' : 'Send 6-Digit Verification Code →'}
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', border: '1px solid #6366f1', padding: '10px 14px', borderRadius: 8, fontSize: 12.5, marginBottom: 16 }}>
                    📧 We sent a 6-digit code to <b>{newEmailInput}</b>. Check your inbox and spam folder.
                  </div>
                  <div className="fd-form-row">
                    <label className="fd-form-label">Enter 6-Digit OTP Code</label>
                    <input
                      className="fd-form-input"
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
                    className="fd-btn-primary"
                    style={{ width: '100%', marginTop: 8 }}
                    disabled={profileSaving}
                    onClick={handleVerifyEmailChange}
                  >
                    {profileSaving ? 'Verifying… ⏳' : '✓ Confirm & Update Email Address'}
                  </button>
                  <div style={{ textAlign: 'center', marginTop: 12 }}>
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
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

      {/* SUPPORT CHAT MODAL */}
      {activeChatTask && (
        <div className="fd-modal-overlay" onClick={() => setActiveChatTask(null)}>
          <div className="fd-modal" onClick={e => e.stopPropagation()}>
            <div className="fd-modal-header">
              <h2>💬 Support Chat — #{activeChatTask.id}</h2>
              <button className="fd-modal-close" onClick={() => setActiveChatTask(null)}>×</button>
            </div>
            <div className="fd-modal-body">
              <div className="fd-chat-list">
                {chatMessages.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#aaa', padding: '20px 0', fontSize: 13 }}>No messages yet. Send a message below to reach support.</p>
                ) : (
                  chatMessages.map(msg => {
                    const isMe = msg.senderRole === 'freelancer';
                    return (
                      <div key={msg.id} className={`fd-chat-msg${isMe ? ' me' : ''}`}>
                        <div className={`fd-chat-av${isMe ? ' me' : ''}`}>{isMe ? initials : 'S'}</div>
                        <div>
                          <div className="fd-chat-bubble">{msg.messageText}</div>
                          <div className="fd-chat-time">{isMe ? 'You' : 'QA Admin'} · {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <form onSubmit={handleSendMessage}>
                <div className="fd-chat-input-row">
                  <input className="fd-chat-input" required placeholder="Type your message..." value={newMessageText} onChange={e => setNewMessageText(e.target.value)} />
                  <button type="submit" className="fd-chat-send">Send</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
