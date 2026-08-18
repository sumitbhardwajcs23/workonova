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
  const [mobileOpen, setMobileOpen] = useState(false);

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
        throw new Error(data.error || 'Authentication failed. Please verify your credentials.');
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
    <div className="al-page">
      {/* ══ HEADER (Exact Landing Page Style) ══ */}
      <header>
        <Link to="/" className="brand">
          <img src="/assets/workonova-logo.webp" alt="Workonova" />
        </Link>
        <nav>
          <Link to="/">Home</Link>
          <Link to="/#services">Services</Link>
          <Link to="/#process">How it works</Link>
          <Link to="/#gallery">Gallery</Link>
          <Link to="/#portfolio">Portfolio</Link>
          <Link to="/#why">Why Workonova</Link>
        </nav>
        <div className="head-actions">
          <Link to="/" className="btn-ghost">← Back to Site</Link>
          <Link to="/?modal=login" className="btn-pill">Client Login</Link>
          <button className="hamburger" aria-label="Open menu" onClick={() => setMobileOpen(true)}>☰</button>
        </div>
      </header>

      {/* ══ MOBILE MENU ══ */}
      {mobileOpen && <div className="menu-backdrop is-open" onClick={() => setMobileOpen(false)} />}
      <aside className={`mobile-menu${mobileOpen ? ' is-open' : ''}`}>
        <button className="menu-close" onClick={() => setMobileOpen(false)}>×</button>
        <Link to="/" className="brand" onClick={() => setMobileOpen(false)}>
          <img src="/assets/workonova-logo.webp" alt="Workonova" />
        </Link>
        <nav>
          <Link to="/" onClick={() => setMobileOpen(false)}>Home</Link>
          <Link to="/#services" onClick={() => setMobileOpen(false)}>Services</Link>
          <Link to="/#process" onClick={() => setMobileOpen(false)}>How it works</Link>
          <Link to="/#gallery" onClick={() => setMobileOpen(false)}>Gallery</Link>
          <Link to="/#portfolio" onClick={() => setMobileOpen(false)}>Portfolio</Link>
          <Link to="/#why" onClick={() => setMobileOpen(false)}>Why Workonova</Link>
        </nav>
        <div className="mobile-account">
          <Link to="/" className="btn-ghost" onClick={() => setMobileOpen(false)}>← Back to Site</Link>
          <Link to="/?modal=login" className="btn-pill" onClick={() => setMobileOpen(false)}>Client Login</Link>
        </div>
      </aside>

      {/* ══ MAIN ADMIN LOGIN SECTION (Landing Page Aesthetic) ══ */}
      <main className="al-main">
        <div className="al-hero-wrap">
          {/* Eyebrow badge matching landing page */}
          <div className="al-badge-wrap">
            <span className="al-badge-pill">🔒 RESTRICTED ACCESS • CENTRAL COMMAND</span>
          </div>

          <h1 className="al-page-title">Admin Portal Panel</h1>
          <p className="al-page-desc">
            Authorized administrative &amp; QA management portal for WORKONOVA operational systems.
          </p>

          {/* Clean Card matching landing page palette */}
          <div className="al-form-card">
            {error && (
              <div className="al-error-callout" role="alert">
                <span className="al-error-icon">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="al-form-inner">
              <div className="al-input-group">
                <label className="al-form-label" htmlFor="admin-email">
                  Admin ID / Registered Email
                </label>
                <div className="al-input-box">
                  <span className="al-box-icon">👤</span>
                  <input
                    id="admin-email"
                    type="email"
                    required
                    autoFocus
                    autoComplete="username"
                    placeholder="admin@workonova.com"
                    className="al-text-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="al-input-group">
                <div className="al-label-flex">
                  <label className="al-form-label" htmlFor="admin-password">
                    Admin Password / Security Key
                  </label>
                </div>
                <div className="al-input-box">
                  <span className="al-box-icon">🔑</span>
                  <input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    className="al-text-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="al-toggle-eye"
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
                className={`al-submit-pill ${loading ? 'is-loading' : ''}`}
              >
                {loading ? (
                  <>
                    <span className="al-spinner-leaf" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Authorize &amp; Sign In</span>
                    <span className="al-arrow-icon">→</span>
                  </>
                )}
              </button>
            </form>

            <div className="al-sec-row">
              <div className="al-sec-badge">
                <span className="al-dot-green" />
                <span>256-Bit SSL Encrypted</span>
              </div>
              <span className="al-sec-dot">•</span>
              <div className="al-sec-badge">
                <span>⚡ Hardware-Isolated RBAC</span>
              </div>
            </div>
          </div>

          <div className="al-back-wrap">
            <Link to="/" className="al-home-return">
              ← Return to Workonova Public Homepage
            </Link>
          </div>
        </div>
      </main>

      {/* ══ FOOTER (Exact Landing Page Style) ══ */}
      <footer className="lp-footer">
        <div>
          <Link className="brand lp-footer-brand" to="/"><img src="/assets/workonova-logo.webp" alt="Workonova" /></Link>
          <p>Premium creative and tech solutions, delivered without the usual hassle.</p>
          <div className="lp-socials">
            <a href="https://instagram.com/workonova_com" target="_blank" rel="noopener noreferrer">Instagram @workonova_com</a>
            <a href="https://facebook.com/workonovaofficial" target="_blank" rel="noopener noreferrer">Facebook /workonovaofficial</a>
            <a href="https://youtube.com/@workonova_com" target="_blank" rel="noopener noreferrer">YouTube @workonova_com</a>
          </div>
        </div>
        <div>
          <h4>Contact</h4>
          <a href="tel:+918077717422">Call: +91 8077 717 422</a>
          <a href="https://wa.me/917983264117">WhatsApp: 7983264117</a>
          <a href="mailto:contact@workonova.com">contact@workonova.com</a>
        </div>
        <div>
          <h4>Legal Policies</h4>
          <Link to="/#top" className="lp-footer-link">Privacy Policy</Link>
          <Link to="/#top" className="lp-footer-link">Terms &amp; Conditions</Link>
          <Link to="/#top" className="lp-footer-link">Disclaimer</Link>
          <Link to="/#top" className="lp-footer-link">Refund &amp; Cancellation Policy</Link>
        </div>
        <div>
          <h4>Our Services</h4>
          <Link to="/#services">Graphic Designing</Link>
          <Link to="/#services">Video Editing</Link>
          <Link to="/#services">3D Design &amp; Modeling</Link>
          <Link to="/#services">VFX &amp; Motion Graphics</Link>
          <Link to="/#services">Digital Marketing</Link>
          <Link to="/#services">Website, Software, Mobile &amp; AI</Link>
        </div>
        <small>Copyright 2026 Workonova. All rights reserved.</small>
      </footer>
    </div>
  );
}
