import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getUser, setToken } from '../utils/auth.js';
import { API_BASE } from '../config.js';
import './AdminLogin.css';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const currentUser = getUser();

  // If already logged in as admin or qa_admin, automatically redirect to admin dashboard
  useEffect(() => {
    if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'qa_admin')) {
      navigate('/admin-dashboard', { replace: true });
    }
  }, [currentUser, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password;

    if (!cleanEmail || !cleanPassword) {
      setError('Please enter both Admin ID/Email and Password.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: cleanPassword, role: 'admin' }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed. Please check your credentials.');
      }

      if (data.user?.role !== 'admin' && data.user?.role !== 'qa_admin') {
        throw new Error('Access Denied: This portal is restricted to authorized Administrative staff only.');
      }

      setToken(data.token);
      setLoading(false);
      navigate('/admin-dashboard', { replace: true });
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Failed to authenticate admin session.');
    }
  };

  return (
    <div className="al-root">
      {/* Background glowing ambience */}
      <div className="al-glow-top" />
      <div className="al-glow-bottom" />

      <div className="al-container">
        {/* Brand Header */}
        <div className="al-header">
          <Link to="/" className="al-logo-link" title="Return to Workonova Home">
            <img src="/assets/workonova-logo.webp" alt="Workonova" className="al-logo-img" />
          </Link>
          <div className="al-badge">
            <span className="al-badge-dot" />
            WORKONOVA ADMIN OS
          </div>
          <h1 className="al-title">Operational Portal Panel</h1>
          <p className="al-subtitle">
            Restricted Central Command System for authorized executive &amp; QA leadership.
          </p>
        </div>

        {/* Login Card */}
        <div className="al-card">
          {error && (
            <div className="al-alert-error" role="alert">
              <span className="al-alert-icon">⚠️</span>
              <div className="al-alert-text">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="al-form">
            <div className="al-field-group">
              <label className="al-label" htmlFor="admin-email">
                Administrative ID / Email
              </label>
              <div className="al-input-wrap">
                <span className="al-input-icon">👤</span>
                <input
                  id="admin-email"
                  type="email"
                  required
                  autoFocus
                  autoComplete="username"
                  placeholder="admin@workonova.com"
                  className="al-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="al-field-group">
              <div className="al-label-row">
                <label className="al-label" htmlFor="admin-password">
                  Security Access Key / Password
                </label>
              </div>
              <div className="al-input-wrap">
                <span className="al-input-icon">🔒</span>
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  className="al-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="al-eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`al-submit-btn ${loading ? 'loading' : ''}`}
            >
              {loading ? (
                <>
                  <span className="al-spinner" />
                  <span>Authenticating Command Clearance...</span>
                </>
              ) : (
                <>
                  <span>Authorize &amp; Access Admin OS</span>
                  <span className="al-submit-arrow">→</span>
                </>
              )}
            </button>
          </form>

          <div className="al-security-footer">
            <div className="al-sec-item">
              <span className="al-sec-icon">🛡️</span>
              <span>256-Bit SSL Encrypted Session</span>
            </div>
            <div className="al-sec-divider">•</div>
            <div className="al-sec-item">
              <span className="al-sec-icon">⚡</span>
              <span>Hardware-Isolated RBAC</span>
            </div>
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="al-foot-links">
          <Link to="/" className="al-home-link">
            ← Return to Public Marketplace Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
