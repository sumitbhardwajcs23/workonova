import { useState, useEffect, useRef } from 'react';
import { getUser, getToken, logout } from '../utils/auth.js';
import WelcomePopup from '../components/WelcomePopup.tsx';
import { API_BASE } from '../config.js';
import './FreelancerDashboard.css';

interface Task {
  id: number;
  serviceCategory: string;
  tier: string;
  description: string;
  submissionLink: string;
  qaApprovedLink: string;
  status: string;
  freelancerPayoutAmount: number;
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
  const clients = ['StartupX', 'RetailFlow India', 'NovaSaaS', 'FitPeak Fitness', 'NorthStar Agency'];
  return clients[taskId % clients.length];
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

  // Profile & Bank Details State
  const [profile, setProfile] = useState<{ services: string[]; portfolioLink?: string; bankDetails?: any } | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [bankForm, setBankForm] = useState({
    accountName: '',
    accountNumber: '',
    ifscCode: '',
    upiId: '',
    bankName: '',
    portfolioLink: '',
  });

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
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/freelancer/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.data) {
        setProfile(data.data);
        setBankForm({
          accountName: data.data.bankDetails?.accountName || '',
          accountNumber: data.data.bankDetails?.accountNumber || '',
          ifscCode: data.data.bankDetails?.ifscCode || '',
          upiId: data.data.bankDetails?.upiId || '',
          bankName: data.data.bankDetails?.bankName || '',
          portfolioLink: data.data.portfolioLink || '',
        });
      }
    } catch (e) {
      console.error('Failed to fetch profile:', e);
    }
  };

  const handleSaveBankDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_BASE}/api/freelancer/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          portfolioLink: bankForm.portfolioLink,
          services: profile?.services || [],
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
      setSuccess('Bank payout details updated successfully!');
      setEditingProfile(false);
      fetchProfile();
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    let interval: any;
    if (activeChatTask) {
      fetchMessages(activeChatTask.id);
      interval = setInterval(() => fetchMessages(activeChatTask.id), 4000);
    }
    return () => clearInterval(interval);
  }, [activeChatTask]);

  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const fetchTasks = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/freelancer/tasks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch tasks');
      
      const tasks = data.data || [];
      setTasksList(tasks);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
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
    try {
      const res = await fetch(`${API_BASE}/api/freelancer/tasks/${activeChatTask.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ messageText: newMessageText })
      });
      if (res.ok) {
        setNewMessageText('');
        fetchMessages(activeChatTask.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ── COUNTS & FILTERING ────────────────────────────────────────
  const activeTasks = tasksList.filter(t => !['delivered', 'cancelled'].includes(t.status));
  const completedTasks = tasksList.filter(t => t.status === 'delivered');

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
                            "{task.description}"
                          </div>

                          {task.adminRevisionComments && (
                            <div style={{ background: '#fee2e2', borderLeft: '3.5px solid #ef4444', padding: '10px 14px', borderRadius: 6, fontSize: 12.5, color: '#991b1b', marginTop: 12 }}>
                              <b>Revision Requested by QA:</b> "{task.adminRevisionComments}"
                            </div>
                          )}
                        </div>

                        <div className="fd-card-actions">
                          <button className="fd-action-btn" onClick={() => setActiveChatTask(task)}>
                            💬 Ask Clarification
                          </button>
                          {['assigned', 'revision_requested'].includes(task.status) && (
                            <button className="fd-action-btn primary" onClick={() => setSubmittingTask(task)}>
                              📤 Open Full Workspace →
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

            {/* ════ EARNINGS LEDGER ════ */}
            {currentView === 'ledger' && (
              <>
                <div className="fd-view-header">
                  <p>Payout Ledger</p>
                  <h1>Earnings &amp; Invoices</h1>
                </div>
                <div className="cd-kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
                  <div className="cd-kpi-card"><div className="cd-kpi-icon money">₹</div><div><b>₹{completedTasks.reduce((acc, t) => acc + (t.freelancerPayoutAmount || 0), 0).toLocaleString()}</b><small>Earned Payouts</small></div></div>
                  <div className="cd-kpi-card"><div className="cd-kpi-icon live">⚡</div><div><b>₹{activeTasks.filter(t => t.status === 'qa_approved').reduce((acc, t) => acc + (t.freelancerPayoutAmount || 0), 0).toLocaleString()}</b><small>Pending Payouts</small></div></div>
                  <div className="cd-kpi-card"><div className="cd-kpi-icon done">✓</div><div><b>{completedTasks.length}</b><small>Completed Deliveries</small></div></div>
                </div>

                <p className="cd-section-title">Transactions Ledger</p>
                <div className="fd-ledger">
                  {completedTasks.map(t => (
                    <div className="fd-ledger-item" key={t.id}>
                      <div className="fd-ledger-info">
                        <b>Task #{t.id} - {t.serviceCategory}</b>
                        <small>Completed on {new Date(t.updatedAt || t.createdAt).toLocaleDateString()}</small>
                      </div>
                      <span className="fd-ledger-amount">+ ₹{t.freelancerPayoutAmount?.toLocaleString() || 0}</span>
                    </div>
                  ))}
                  {completedTasks.length === 0 && (
                    <p className="fd-empty-text">No payout transactions recorded yet. Complete a task assignment to start earning payouts.</p>
                  )}
                </div>
              </>
            )}

            {/* ════ PROFILE SETTINGS ════ */}
            {currentView === 'profile' && (
              <>
                <div className="fd-view-header">
                  <p>Onboarding</p>
                  <h1>Profile Settings</h1>
                </div>
                <div className="fd-profile-grid">
                  <div className="fd-profile-card">
                    <h3>Payout details</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div className="fd-form-row"><label className="fd-form-label">Contact Email</label><p style={{ fontSize: 13.5 }}>{user?.email}</p></div>
                      <div className="fd-form-row"><label className="fd-form-label">Vetted Services</label><p style={{ fontSize: 13.5 }}>{profile?.services?.join(', ') || 'General Digital Specialist'}</p></div>
                      {profile?.portfolioLink && (
                        <div className="fd-form-row"><label className="fd-form-label">Portfolio URL</label><p><a href={profile.portfolioLink} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'none', fontSize: 13 }}>{profile.portfolioLink} ↗</a></p></div>
                      )}
                      <div className="fd-form-row">
                        <label className="fd-form-label">Active Payout Info</label>
                        <p style={{ fontSize: 13.5, fontWeight: 600 }}>
                          {profile?.bankDetails?.upiId
                            ? `UPI ID: ${profile.bankDetails.upiId}`
                            : profile?.bankDetails?.accountNumber
                            ? `Bank Account: ****${profile.bankDetails.accountNumber.slice(-4)}`
                            : '⚠️ Bank payout details missing'}
                        </p>
                      </div>
                      <button className="fd-btn-secondary" style={{ marginTop: 8 }} onClick={() => setEditingProfile(true)}>⚙️ Update Payout &amp; Bank Settings</button>
                    </div>
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

      {/* DELIVER ASSET MODAL */}
      {submittingTask && (
        <div className="fd-modal-overlay" onClick={() => setSubmittingTask(null)}>
          <div className="fd-modal" onClick={e => e.stopPropagation()}>
            <div className="fd-modal-header">
              <h2>📤 Deliver Completed Assets — #{submittingTask.id}</h2>
              <button className="fd-modal-close" onClick={() => setSubmittingTask(null)}>×</button>
            </div>
            <div className="fd-modal-body">
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
              <button className="fd-btn-primary" form="deliverForm" type="submit">Deliver Work</button>
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

      {/* BANK SETTINGS EDIT MODAL */}
      {editingProfile && (
        <div className="fd-modal-overlay" onClick={() => setEditingProfile(false)}>
          <div className="fd-modal" onClick={e => e.stopPropagation()}>
            <div className="fd-modal-header">
              <h2>⚙️ Payout &amp; Bank Settings</h2>
              <button className="fd-modal-close" onClick={() => setEditingProfile(false)}>×</button>
            </div>
            <div className="fd-modal-body">
              <form id="profileForm" onSubmit={handleSaveBankDetails}>
                <div className="fd-form-row"><label className="fd-form-label">Portfolio Link</label><input className="fd-form-input" type="url" value={bankForm.portfolioLink} onChange={e => setBankForm({ ...bankForm, portfolioLink: e.target.value })} /></div>
                <div className="fd-form-row"><label className="fd-form-label">UPI ID (Fast Payout)</label><input className="fd-form-input" type="text" placeholder="name@upi" value={bankForm.upiId} onChange={e => setBankForm({ ...bankForm, upiId: e.target.value })} /></div>
                <div className="fd-form-row"><label className="fd-form-label">Account Holder Name</label><input className="fd-form-input" type="text" value={bankForm.accountName} onChange={e => setBankForm({ ...bankForm, accountName: e.target.value })} /></div>
                <div className="fd-form-row"><label className="fd-form-label">Bank Account Number</label><input className="fd-form-input" type="text" value={bankForm.accountNumber} onChange={e => setBankForm({ ...bankForm, accountNumber: e.target.value })} /></div>
                <div className="fd-form-row"><label className="fd-form-label">Bank IFSC Code</label><input className="fd-form-input" type="text" value={bankForm.ifscCode} onChange={e => setBankForm({ ...bankForm, ifscCode: e.target.value })} /></div>
              </form>
            </div>
            <div className="fd-modal-footer">
              <button className="fd-btn-secondary" onClick={() => setEditingProfile(false)}>Cancel</button>
              <button className="fd-btn-primary" form="profileForm" type="submit">Save Settings</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
