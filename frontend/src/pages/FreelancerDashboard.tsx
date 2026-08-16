import { useState, useEffect } from 'react';
import { getUser, getToken, logout } from '../utils/auth.js';
import WelcomePopup from '../components/WelcomePopup.tsx';
import { API_BASE } from '../config.js';

interface Task {
  id: number;
  serviceCategory: string;
  tier: string;
  description: string;
  submissionLink: string; // client reference files
  qaApprovedLink: string; // finalized QA asset
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

export default function FreelancerDashboard() {
  const user = getUser();
  const token = getToken();

  const [tasksList, setTasksList] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

  const fetchTasks = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/freelancer/tasks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch tasks');
      setTasksList(data.data || []);
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
      if (res.ok) {
        setChatMessages(data.data || []);
      }
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

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'assigned': return 'badge-assigned';
      case 'submitted': return 'badge-submitted';
      case 'qa_approved': return 'badge-qa';
      case 'revision_requested': return 'badge-revision';
      case 'delivered': return 'badge-delivered';
      case 'cancelled': return 'badge-cancelled';
      default: return '';
    }
  };

  const formatStatus = (status: string) => {
    return status.replace('_', ' ').toUpperCase();
  };

  const activeTasks = tasksList.filter(t => !['delivered', 'cancelled'].includes(t.status));
  const completedTasks = tasksList.filter(t => t.status === 'delivered');

  return (
    <div className="db-layout">
      <WelcomePopup role="freelancer" />
      {/* Header */}
      <header className="db-header">
        <div className="db-header-left">
          <img src="/assets/workonova-logo.webp" alt="Workonova" className="db-logo" />
          <span className="db-badge badge-freelancer">Freelancer Portal</span>
        </div>
        <div className="db-header-right">
          <span className="db-user-name">Freelancer: {user?.name}</span>
          <button className="db-btn-logout" onClick={logout}>Log out</button>
        </div>
      </header>

      <div className="db-container">
        {/* Main Content */}
        <main className="db-main">
          {error && <div className="db-alert db-alert-error">{error}</div>}
          {success && <div className="db-alert db-alert-success">{success}</div>}

          {/* Stats Bar */}
          <section className="db-stats">
            <div className="db-stat-card">
              <h4>Active Tasks</h4>
              <p>{activeTasks.length}</p>
            </div>
            <div className="db-stat-card">
              <h4>Earned Payouts</h4>
              <p>₹{completedTasks.reduce((acc, t) => acc + (t.freelancerPayoutAmount || 0), 0).toLocaleString()}</p>
            </div>
            <div className="db-stat-card">
              <h4>Pending Payouts</h4>
              <p>₹{activeTasks.filter(t => t.status === 'qa_approved').reduce((acc, t) => acc + (t.freelancerPayoutAmount || 0), 0).toLocaleString()}</p>
            </div>
          </section>

          {/* Main Grid */}
          <div className="db-grid">
            {/* Column Left: Active Tasks */}
            <div className="db-col-left">
              <h3 className="section-title">Active Task Assignments</h3>
              {loading ? (
                <div className="db-card-loading">Loading assignments...</div>
              ) : activeTasks.length === 0 ? (
                <div className="db-empty-card">
                  <p>You have no active task assignments at the moment. Check back later!</p>
                </div>
              ) : (
                <div className="db-orders-list">
                  {activeTasks.map(task => (
                    <div key={task.id} className="db-order-card">
                      <div className="db-order-card-header">
                        <div>
                          <span className="order-cat">{task.serviceCategory}</span>
                          <span className={`order-status-badge ${getStatusBadgeClass(task.status)}`}>
                            {formatStatus(task.status)}
                          </span>
                        </div>
                        <span className="order-price">Payout: ₹{task.freelancerPayoutAmount?.toLocaleString() || 0}</span>
                      </div>

                      <div className="blind-banner">
                        🔒 Blind Task Privacy Mode Active. Client contact, name, and billing details are completely anonymized.
                      </div>

                      <div className="task-detail-section">
                        <h5>Project Description & Brief</h5>
                        <p className="order-desc">{task.description}</p>
                      </div>

                      {task.submissionLink && (
                        <div className="task-detail-section">
                          <h5>Client Reference Files</h5>
                          <a href={task.submissionLink} target="_blank" rel="noreferrer" className="btn-secondary-link">
                            🔗 Open Reference Files Folder
                          </a>
                        </div>
                      )}

                      {task.adminRevisionComments && (
                        <div className="order-comments">
                          <strong>Revision Requested by Admin QA:</strong> {task.adminRevisionComments}
                        </div>
                      )}

                      <div className="db-order-card-actions">
                        <button className="btn-secondary" onClick={() => setActiveChatTask(task)}>
                          💬 Support Chat
                        </button>
                        {['assigned', 'revision_requested'].includes(task.status) && (
                          <button className="btn-primary" onClick={() => setSubmittingTask(task)}>
                            📤 Deliver Finished Assets
                          </button>
                        )}
                        {task.status === 'submitted' && (
                          <span className="task-status-text text-yellow">
                            ⏳ Awaiting Admin QA approval
                          </span>
                        )}
                        {task.status === 'qa_approved' && (
                          <span className="task-status-text text-green">
                            ✓ QA Approved! Payout will release shortly.
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Column Right: Payout Ledger & History */}
            <div className="db-col-right-panel">
              <div className="db-card">
                <h3>Payout Ledger</h3>
                <p className="card-sub">Completed tasks and manual mark-as-paid confirmations.</p>
                
                {completedTasks.length === 0 ? (
                  <p className="payout-empty-text">No payout history available yet. Deliver a task and wait for admin payout approval.</p>
                ) : (
                  <div className="payout-ledger-list">
                    {completedTasks.map(t => (
                      <div key={t.id} className="payout-ledger-item">
                        <div className="payout-item-desc">
                          <strong>Task #{t.id} - {t.serviceCategory}</strong>
                          <span>Completed on {new Date(t.updatedAt || t.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="payout-item-amount text-green">
                          + ₹{t.freelancerPayoutAmount?.toLocaleString() || 0}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Freelancer Profile Details */}
              <div className="db-card freelancer-profile-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3>Your Onboarding Details</h3>
                  <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => setEditingProfile(true)}>
                    ⚙️ Edit Bank Payout Details
                  </button>
                </div>
                <div className="profile-details-list" style={{ marginTop: '12px' }}>
                  <div className="profile-detail">
                    <span className="detail-lbl">Contact Email:</span>
                    <span className="detail-val">{user?.email}</span>
                  </div>
                  <div className="profile-detail">
                    <span className="detail-lbl">Vetted Services:</span>
                    <span className="detail-val">
                      {profile?.services && profile.services.length > 0
                        ? profile.services.join(', ')
                        : 'General Digital Specialist'}
                    </span>
                  </div>
                  {profile?.portfolioLink && (
                    <div className="profile-detail">
                      <span className="detail-lbl">Portfolio / GitHub:</span>
                      <span className="detail-val">
                        <a href={profile.portfolioLink} target="_blank" rel="noreferrer" className="btn-text-link">
                          Open Link ↗
                        </a>
                      </span>
                    </div>
                  )}
                  <div className="profile-detail">
                    <span className="detail-lbl">Payout Method:</span>
                    <span className="detail-val">
                      {profile?.bankDetails?.upiId
                        ? `UPI: ${profile.bankDetails.upiId}`
                        : profile?.bankDetails?.accountNumber
                        ? `Bank: ****${profile.bankDetails.accountNumber.slice(-4)}`
                        : '⚠️ Payout bank details missing'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Delivery Submission Modal */}
      {submittingTask && (
        <div className="chat-modal-backdrop" onClick={() => setSubmittingTask(null)}>
          <div className="chat-modal-content" onClick={e => e.stopPropagation()}>
            <div className="chat-header">
              <div>
                <h4>Deliver Completed Assets - Task #{submittingTask.id}</h4>
                <p>{submittingTask.serviceCategory}</p>
              </div>
              <button className="chat-close" onClick={() => setSubmittingTask(null)}>×</button>
            </div>

            <form onSubmit={handleDeliverTask} className="db-form p-6">
              <div className="form-group">
                <label htmlFor="delivery-link">Google Drive or Dropbox Deliverables Link</label>
                <input
                  id="delivery-link"
                  type="url"
                  placeholder="https://drive.google.com/drive/folders/..."
                  value={deliveryLink}
                  onChange={e => setDeliveryLink(e.target.value)}
                  required
                />
                <small className="form-tip">Provide link to your finished vector files, edits, renders, or source code.</small>
              </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setSubmittingTask(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Deliver Work
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Support Chat Drawer */}
      {activeChatTask && (
        <div className="chat-modal-backdrop" onClick={() => setActiveChatTask(null)}>
          <div className="chat-modal-content" onClick={e => e.stopPropagation()}>
            <div className="chat-header">
              <div>
                <h4>Admin Support Chat - Task #{activeChatTask.id}</h4>
                <p>{activeChatTask.serviceCategory} ({activeChatTask.tier.toUpperCase()})</p>
              </div>
              <button className="chat-close" onClick={() => setActiveChatTask(null)}>×</button>
            </div>

            <div className="chat-messages-container">
              {chatMessages.length === 0 ? (
                <div className="chat-empty">No messages yet. Message support regarding your task requirements.</div>
              ) : (
                chatMessages.map(msg => {
                  const isMe = msg.senderRole === 'freelancer';
                  const isSystem = msg.senderId === 0;
                  return (
                    <div key={msg.id} className={`chat-bubble-wrap ${isMe ? 'chat-me' : isSystem ? 'chat-system' : 'chat-other'}`}>
                      <div className="chat-bubble">
                        <small className="chat-sender">
                          {isMe ? 'You' : isSystem ? 'SYSTEM LOG' : 'Support Admin'}
                        </small>
                        <p>{msg.messageText}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={handleSendMessage} className="chat-input-form">
              <input
                type="text"
                placeholder="Type your message..."
                value={newMessageText}
                onChange={e => setNewMessageText(e.target.value)}
                required
              />
              <button type="submit" className="btn-chat-send">Send</button>
            </form>
          </div>
        </div>
      )}

      {/* Bank Details Modal */}
      {editingProfile && (
        <div className="chat-modal-backdrop" onClick={() => setEditingProfile(false)}>
          <div className="chat-modal-content" onClick={e => e.stopPropagation()}>
            <div className="chat-header">
              <h4>Bank Payout & Portfolio Settings</h4>
              <button className="chat-close" onClick={() => setEditingProfile(false)}>×</button>
            </div>

            <form onSubmit={handleSaveBankDetails} className="db-form p-6">
              <div className="form-group">
                <label htmlFor="portfolio-url">Portfolio / Showreel / GitHub Link</label>
                <input
                  id="portfolio-url"
                  type="url"
                  placeholder="https://github.com/... or https://behance.net/..."
                  value={bankForm.portfolioLink}
                  onChange={e => setBankForm({ ...bankForm, portfolioLink: e.target.value })}
                />
              </div>

              <h5 style={{ marginTop: '16px', marginBottom: '8px', color: 'var(--text-muted)' }}>UPI Payout Option (Fastest)</h5>
              <div className="form-group">
                <label htmlFor="upi-id">UPI ID (e.g. name@okhdfcbank)</label>
                <input
                  id="upi-id"
                  type="text"
                  placeholder="username@upi"
                  value={bankForm.upiId}
                  onChange={e => setBankForm({ ...bankForm, upiId: e.target.value })}
                />
              </div>

              <h5 style={{ marginTop: '16px', marginBottom: '8px', color: 'var(--text-muted)' }}>Bank Account Payout Option</h5>
              <div className="form-group">
                <label htmlFor="account-name">Account Holder Name</label>
                <input
                  id="account-name"
                  type="text"
                  placeholder="Full name as per bank"
                  value={bankForm.accountName}
                  onChange={e => setBankForm({ ...bankForm, accountName: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label htmlFor="account-number">Bank Account Number</label>
                <input
                  id="account-number"
                  type="text"
                  placeholder="Account Number"
                  value={bankForm.accountNumber}
                  onChange={e => setBankForm({ ...bankForm, accountNumber: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label htmlFor="ifsc-code">Bank IFSC Code</label>
                <input
                  id="ifsc-code"
                  type="text"
                  placeholder="HDFC0001234"
                  value={bankForm.ifscCode}
                  onChange={e => setBankForm({ ...bankForm, ifscCode: e.target.value })}
                />
              </div>

              <div className="form-actions" style={{ marginTop: '20px' }}>
                <button type="button" className="btn-secondary" onClick={() => setEditingProfile(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Payout Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
