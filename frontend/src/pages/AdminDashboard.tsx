import { useState, useEffect } from 'react';
import { getUser, getToken, logout } from '../utils/auth.js';
import { API_BASE } from '../config.js';

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
  client?: {
    name: string;
    email: string;
  };
  freelancer?: {
    name: string;
    email: string;
  };
}

interface Freelancer {
  id: number;
  name: string;
  email: string;
  services: string[];
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
  const isMaster = user?.role === 'admin'; // 'admin' is Master Admin, 'qa_admin' is QA Admin

  const [orders, setOrders] = useState<Order[]>([]);
  const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Assign Panel State
  const [assigningOrder, setAssigningOrder] = useState<Order | null>(null);
  const [selectedFreelancerId, setSelectedFreelancerId] = useState<number | ''>('');
  const [payoutAmount, setPayoutAmount] = useState<number>(0);

  // QA Gate Panel State
  const [qaOrder, setQaOrder] = useState<Order | null>(null);
  const [qaAction, setQaAction] = useState<'approve' | 'revision' | 'reject'>('approve');
  const [qaComments, setQaComments] = useState('');
  const [qaApprovedLinkInput, setQaApprovedLinkInput] = useState('');

  // Onboard Freelancer State
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [newFreelancerForm, setNewFreelancerForm] = useState({
    name: '',
    email: '',
    password: '',
    services: [] as string[],
    portfolioLink: '',
  });

  // Relay Chat State
  const [relayOrder, setRelayOrder] = useState<Order | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [relayText, setRelayText] = useState('');

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
      // 1. Fetch Orders
      const resOrders = await fetch(`${API_BASE}/api/admin/orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const dataOrders = await resOrders.json();
      if (!resOrders.ok) throw new Error(dataOrders.error || 'Failed to fetch admin orders');
      setOrders(dataOrders.data || []);

      // 2. Fetch Freelancers
      const resFl = await fetch(`${API_BASE}/api/admin/freelancers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const dataFl = await resFl.json();
      if (resFl.ok) setFreelancers(dataFl.data || []);

      // 3. Fetch Testimonials
      const resT = await fetch(`${API_BASE}/api/admin/testimonials`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const dataT = await resT.json();
      if (resT.ok) setTestimonials(dataT.data || []);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningOrder || !selectedFreelancerId) return;
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`${API_BASE}/api/admin/orders/${assigningOrder.id}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ freelancerId: Number(selectedFreelancerId), payoutAmount })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Assignment failed');

      setSuccess(`Task assigned successfully to freelancer!`);
      setAssigningOrder(null);
      setSelectedFreelancerId('');
      setPayoutAmount(0);
      fetchDashboardData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleQaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qaOrder) return;
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`${API_BASE}/api/admin/orders/${qaOrder.id}/qa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          action: qaAction,
          comments: qaComments,
          qaApprovedLink: qaApprovedLinkInput || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'QA Action failed');

      setSuccess(`QA action '${qaAction.toUpperCase()}' completed successfully!`);
      setQaOrder(null);
      setQaComments('');
      setQaApprovedLinkInput('');
      fetchDashboardData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateFreelancer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`${API_BASE}/api/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
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
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handlePayoutRelease = async (orderId: number) => {
    if (!isMaster) return;
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`${API_BASE}/api/admin/orders/${orderId}/payout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ markAsPaid: true })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payout release failed');

      setSuccess('Payout released and marked paid. Order complete!');
      fetchDashboardData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRevokeOrder = async (orderId: number) => {
    if (!isMaster) return;
    if (!window.confirm('Are you sure you want to revoke this task and set freelancer payout to zero?')) return;
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`${API_BASE}/api/admin/orders/${orderId}/revoke`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Revoke task failed');

      setSuccess('Task revoked from freelancer. Payout zeroed. Re-assignment ready.');
      fetchDashboardData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCancelOrder = async (orderId: number) => {
    if (!isMaster) return;
    if (!window.confirm('Are you sure you want to cancel this order and process a refund?')) return;
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`${API_BASE}/api/admin/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cancel order failed');

      setSuccess('Order cancelled successfully. Refund initiated.');
      fetchDashboardData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleTestimonialApprove = async (id: number, approved: boolean) => {
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`${API_BASE}/api/admin/testimonials/${id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ approved })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Testimonial approval failed');

      setSuccess(`Testimonial review updated successfully!`);
      fetchDashboardData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchMessages = async (orderId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/orders/${orderId}/messages`, {
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

  const handleSendRelayMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!relayText || !relayOrder) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/orders/${relayOrder.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ messageText: relayText })
      });
      if (res.ok) {
        setRelayText('');
        fetchMessages(relayOrder.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="db-layout">
      {/* Header */}
      <header className="db-header">
        <div className="db-header-left">
          <img src="/assets/workonova-logo.webp" alt="Workonova" className="db-logo" />
          <span className="db-badge badge-admin">
            {isMaster ? 'Master Admin Controls' : 'QA Team Dashboard'}
          </span>
        </div>
        <div className="db-header-right">
          <span className="db-user-name">Role: {isMaster ? 'Master Admin' : 'QA Admin'}</span>
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
              <h4>Total Orders</h4>
              <p>{orders.length}</p>
            </div>
            <div className="db-stat-card">
              <h4>Unassigned Orders</h4>
              <p>{orders.filter(o => o.status === 'paid').length}</p>
            </div>
            <div className="db-stat-card">
              <h4>In QA Queue</h4>
              <p>{orders.filter(o => o.status === 'submitted').length}</p>
            </div>
            <div className="db-stat-card">
              <h4>Home Testimonials</h4>
              <p>{testimonials.filter(t => t.status === 'approved').length}</p>
            </div>
          </section>

          {/* Main Grid */}
          <div className="db-grid">
            {/* Column Left: Main Order Queues */}
            <div className="db-col-left">
              <h3 className="section-title">Global Order Control room</h3>
              {loading ? (
                <div className="db-card-loading">Loading projects and tasks...</div>
              ) : orders.length === 0 ? (
                <div className="db-empty-card">
                  <p>No orders currently exist on the platform database.</p>
                </div>
              ) : (
                <div className="db-orders-list">
                  {orders.map(order => (
                    <div key={order.id} className="db-order-card">
                      <div className="db-order-card-header">
                        <div>
                          <span className="order-cat">Order #{order.id} - {order.serviceCategory}</span>
                          <span className={`order-status-badge badge-${order.status}`}>
                            {order.status.toUpperCase()}
                          </span>
                        </div>
                        <span className="order-price">Client Cost: ₹{order.price.toLocaleString()}</span>
                      </div>

                      <div className="admin-order-participants">
                        <div className="participant">
                          <strong>Client:</strong> {order.client ? `${order.client.name} (${order.client.email})` : 'Unknown'}
                        </div>
                        <div className="participant">
                          <strong>Freelancer:</strong> {order.freelancer ? `${order.freelancer.name} (${order.freelancer.email})` : 'Unassigned'}
                        </div>
                      </div>

                      <div className="task-detail-section">
                        <h5>Intake Description / Brief</h5>
                        <p className="order-desc">{order.description || 'No description provided.'}</p>
                      </div>

                      {order.submissionLink && (
                        <div className="admin-links-section">
                          <strong>Intake Files (Google/Dropbox):</strong>{' '}
                          <a href={order.submissionLink} target="_blank" rel="noreferrer" className="btn-text-link">
                            Open Link
                          </a>
                        </div>
                      )}

                      {order.qaApprovedLink && (
                        <div className="admin-links-section">
                          <strong>QA Approved Deliverable:</strong>{' '}
                          <a href={order.qaApprovedLink} target="_blank" rel="noreferrer" className="btn-text-link">
                            Open Approved Deliverable
                          </a>
                        </div>
                      )}

                      {/* Stepper Status Indicators */}
                      {order.adminRevisionComments && (
                        <div className="order-comments">
                          <strong>Revision Request Details:</strong> {order.adminRevisionComments}
                        </div>
                      )}

                      {/* Admin Panel Contextual Controls */}
                      <div className="db-order-card-actions">
                        {/* 1. Assignment control */}
                        {order.status === 'paid' && (
                          <button
                            className="btn-primary"
                            onClick={() => {
                              setAssigningOrder(order);
                              setPayoutAmount(Math.floor(order.price * 0.7)); // suggest 70% payout
                            }}
                          >
                            Assign Freelancer
                          </button>
                        )}

                        {/* 2. QA review control */}
                        {order.status === 'submitted' && (
                          <button className="btn-primary" onClick={() => setQaOrder(order)}>
                            Start QA Review Gateway
                          </button>
                        )}

                        {/* 3. Message communication relay */}
                        <button className="btn-secondary" onClick={() => setRelayOrder(order)}>
                          💬 Messages Relay ({chatMessages.length})
                        </button>

                        {/* 4. Payout / Cancellation Master Admin Control */}
                        {isMaster && order.status === 'qa_approved' && (
                          <button className="btn-primary-accent" onClick={() => handlePayoutRelease(order.id)}>
                            💵 Release Freelancer Payout (₹{order.freelancerPayoutAmount})
                          </button>
                        )}

                        {isMaster && ['assigned', 'submitted', 'qa_approved', 'revision_requested'].includes(order.status) && (
                          <button className="btn-danger" onClick={() => handleRevokeOrder(order.id)}>
                            🚫 Revoke & Reassign
                          </button>
                        )}

                        {isMaster && order.status !== 'cancelled' && order.status !== 'delivered' && (
                          <button className="btn-danger-outline" onClick={() => handleCancelOrder(order.id)}>
                            Refund Client
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Column Right: Testimonials queue & users list */}
            <div className="db-col-right-panel">
              {/* Testimonials Review Section */}
              <div className="db-card">
                <h3>Testimonial Review Panel</h3>
                <p className="card-sub">Approve or reject reviews to showcase on the homepage.</p>
                {testimonials.length === 0 ? (
                  <p className="testimonial-empty-text">No user testimonials pending review.</p>
                ) : (
                  <div className="testimonials-review-list">
                    {testimonials.map(t => (
                      <div key={t.id} className="testimonial-review-item">
                        <div className="testimonial-review-info">
                          <strong>{t.name} ({t.stars} Stars)</strong>
                          <p>"{t.quote}"</p>
                          <span className={`t-status status-${t.status}`}>{t.status.toUpperCase()}</span>
                        </div>
                        {t.status === 'pending' && (
                          <div className="t-review-actions">
                            <button className="btn-t-approve" onClick={() => handleTestimonialApprove(t.id, true)}>Approve</button>
                            <button className="btn-t-reject" onClick={() => handleTestimonialApprove(t.id, false)}>Reject</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Freelancers List Panel */}
              <div className="db-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3>Vetted Freelancers Directory</h3>
                  {isMaster && (
                    <button className="btn-primary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => setOnboardingOpen(true)}>
                      + Onboard Freelancer
                    </button>
                  )}
                </div>
                <p className="card-sub">Currently onboarding or active on the platform.</p>
                <div className="directory-list">
                  {freelancers.map(f => (
                    <div key={f.id} className="directory-item">
                      <strong>{f.name}</strong>
                      <span className="directory-email">{f.email}</span>
                      <div className="directory-services">
                        {f.services.map(s => <span key={s} className="dir-srv-badge">{s}</span>)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Assignment Modal */}
      {assigningOrder && (
        <div className="chat-modal-backdrop" onClick={() => setAssigningOrder(null)}>
          <div className="chat-modal-content" onClick={e => e.stopPropagation()}>
            <div className="chat-header">
              <h4>Assign Task to Freelancer - Order #{assigningOrder.id}</h4>
              <button className="chat-close" onClick={() => setAssigningOrder(null)}>×</button>
            </div>
            
            <form onSubmit={handleAssignOrder} className="db-form p-6">
              <div className="form-group">
                <label htmlFor="freelancer-select">Select Freelancer</label>
                <select
                  id="freelancer-select"
                  value={selectedFreelancerId}
                  onChange={e => setSelectedFreelancerId(e.target.value === '' ? '' : Number(e.target.value))}
                  required
                >
                  <option value="">Choose freelancer...</option>
                  {freelancers
                    .filter(f => f.services.includes(assigningOrder.serviceCategory))
                    .map(f => (
                      <option key={f.id} value={f.id}>{f.name} ({f.email})</option>
                    ))
                  }
                </select>
                <small className="form-tip">Only freelancers vetted in the "{assigningOrder.serviceCategory}" service are listed.</small>
              </div>

              <div className="form-group">
                <label htmlFor="payout-fee">Freelancer Payout Fee (₹)</label>
                <input
                  id="payout-fee"
                  type="number"
                  value={payoutAmount}
                  onChange={e => setPayoutAmount(Number(e.target.value))}
                  max={assigningOrder.price}
                  required
                />
                <small className="form-tip">Specify task payout amount. Price paid by client: ₹{assigningOrder.price.toLocaleString()}</small>
              </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setAssigningOrder(null)}>Cancel</button>
                <button type="submit" className="btn-primary">Assign Task</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QA Gateway Modal */}
      {qaOrder && (
        <div className="chat-modal-backdrop" onClick={() => setQaOrder(null)}>
          <div className="chat-modal-content" onClick={e => e.stopPropagation()}>
            <div className="chat-header">
              <h4>QA Review Gateway - Order #{qaOrder.id}</h4>
              <button className="chat-close" onClick={() => setQaOrder(null)}>×</button>
            </div>

            <form onSubmit={handleQaSubmit} className="db-form p-6">
              <div className="qa-overview">
                <p><strong>Deliverables Link:</strong>{' '}</p>
                <a href={qaOrder.submissionLink} target="_blank" rel="noreferrer" className="btn-primary-link">
                  🔗 Open Freelancer Submitted Files
                </a>
              </div>

              <div className="form-group mt-4">
                <label>Choose QA Action</label>
                <div className="qa-actions-row">
                  <button
                    type="button"
                    className={`qa-btn approve ${qaAction === 'approve' ? 'selected' : ''}`}
                    onClick={() => setQaAction('approve')}
                  >
                    Approve Assets
                  </button>
                  <button
                    type="button"
                    className={`qa-btn revision ${qaAction === 'revision' ? 'selected' : ''}`}
                    onClick={() => setQaAction('revision')}
                  >
                    Request Revision
                  </button>
                  <button
                    type="button"
                    className={`qa-btn reject ${qaAction === 'reject' ? 'selected' : ''}`}
                    onClick={() => setQaAction('reject')}
                  >
                    Reject Delivery
                  </button>
                </div>
              </div>

              {qaAction === 'approve' && (
                <div className="form-group mt-3">
                  <label htmlFor="qa-curated-link">Curated Final Asset Link (Optional)</label>
                  <input
                    id="qa-curated-link"
                    type="url"
                    placeholder="Defaults to freelancer submission link if left empty..."
                    value={qaApprovedLinkInput}
                    onChange={e => setQaApprovedLinkInput(e.target.value)}
                  />
                  <small className="form-tip">Paste sanitized / rebranded Drive or Dropbox link for client delivery.</small>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="qa-comments">QA Comments / Feedback / Revision instructions</label>
                <textarea
                  id="qa-comments"
                  placeholder="Provide explicit feedback for the freelancer..."
                  value={qaComments}
                  onChange={e => setQaComments(e.target.value)}
                  rows={4}
                  required={qaAction === 'revision'}
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setQaOrder(null)}>Cancel</button>
                <button type="submit" className="btn-primary">Submit QA Decision</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Messages Relay Modal */}
      {relayOrder && (
        <div className="chat-modal-backdrop" onClick={() => setRelayOrder(null)}>
          <div className="chat-modal-content" onClick={e => e.stopPropagation()}>
            <div className="chat-header">
              <div>
                <h4>Support Relay Chat - Order #{relayOrder.id}</h4>
                <p>{relayOrder.serviceCategory} ({relayOrder.tier.toUpperCase()})</p>
              </div>
              <button className="chat-close" onClick={() => setRelayOrder(null)}>×</button>
            </div>

            <div className="chat-messages-container">
              {chatMessages.length === 0 ? (
                <div className="chat-empty">No support conversation recorded yet.</div>
              ) : (
                chatMessages.map(msg => {
                  const isSystem = msg.senderId === 0;
                  const senderName = msg.senderRole === 'client' ? 'Client' : msg.senderRole === 'freelancer' ? 'Freelancer' : 'Admin';
                  return (
                    <div key={msg.id} className={`chat-bubble-wrap chat-${msg.senderRole}`}>
                      <div className="chat-bubble">
                        <small className="chat-sender">{isSystem ? 'SYSTEM LOG' : `${senderName} (${msg.senderRole.toUpperCase()})`}</small>
                        <p>{msg.messageText}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={handleSendRelayMessage} className="chat-input-form">
              <input
                type="text"
                placeholder="Relay message to both client & freelancer..."
                value={relayText}
                onChange={e => setRelayText(e.target.value)}
                required
              />
              <button type="submit" className="btn-chat-send">Send Relay</button>
            </form>
          </div>
        </div>
      )}

      {/* Onboard Freelancer Modal */}
      {onboardingOpen && (
        <div className="chat-modal-backdrop" onClick={() => setOnboardingOpen(false)}>
          <div className="chat-modal-content" onClick={e => e.stopPropagation()}>
            <div className="chat-header">
              <h4>Onboard Vetted Freelancer</h4>
              <button className="chat-close" onClick={() => setOnboardingOpen(false)}>×</button>
            </div>

            <form onSubmit={handleCreateFreelancer} className="db-form p-6">
              <div className="form-group">
                <label htmlFor="fl-name">Full Name</label>
                <input
                  id="fl-name"
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={newFreelancerForm.name}
                  onChange={e => setNewFreelancerForm({ ...newFreelancerForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="fl-email">Email Address</label>
                <input
                  id="fl-email"
                  type="email"
                  placeholder="freelancer@workonova.com"
                  value={newFreelancerForm.email}
                  onChange={e => setNewFreelancerForm({ ...newFreelancerForm, email: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="fl-password">Initial Password</label>
                <input
                  id="fl-password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={newFreelancerForm.password}
                  onChange={e => setNewFreelancerForm({ ...newFreelancerForm, password: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="fl-portfolio">Portfolio / GitHub Link</label>
                <input
                  id="fl-portfolio"
                  type="url"
                  placeholder="https://github.com/..."
                  value={newFreelancerForm.portfolioLink}
                  onChange={e => setNewFreelancerForm({ ...newFreelancerForm, portfolioLink: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Vetted Primary Service</label>
                <select
                  value={newFreelancerForm.services[0] || ''}
                  onChange={e => setNewFreelancerForm({ ...newFreelancerForm, services: [e.target.value] })}
                  required
                >
                  <option value="">Select primary service...</option>
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

              <div className="form-actions" style={{ marginTop: '20px' }}>
                <button type="button" className="btn-secondary" onClick={() => setOnboardingOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Onboard Account</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
