import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { setToken } from '../utils/auth.js';
import { API_BASE } from '../config.js';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'signup' | 'forgot';
  initialRole?: Role;
}

type Role = 'client' | 'freelancer';
type Mode = 'login' | 'signup' | 'forgot';
type ModalView = 'form' | 'otp' | 'success';

const clientServices = [
  'Graphic Designing', 'Video Editing', '3D Design & Modeling', 'VFX',
  'Animation', 'Digital Marketing', 'Website Development', 'Software Development',
  'App Development', 'AI Services', 'IT Services', 'Cyber Security',
];

const freelancerServices = [
  'Graphic Designing', 'Video Editing', '3D Design & Modeling', 'VFX',
  'Animation', 'Digital Marketing', 'Website Development', 'Software Development',
  'App Development', 'AI Services', 'IT Services', 'Cyber Security',
];

function AuthField({ label, name, type = 'text', placeholder = '', id, value, onChange }: {
  label: string; name: string; type?: string; placeholder?: string; id?: string;
  value: string; onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPasswordType = type === 'password';
  const effectiveType = isPasswordType ? (showPassword ? 'text' : 'password') : type;

  return (
    <div>
      <label className="am-label" htmlFor={id || name}>{label}</label>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input id={id || name} className="am-input" type={effectiveType} name={name}
          placeholder={placeholder} required
          value={value} onChange={onChange}
          style={isPasswordType ? { paddingRight: '42px' } : undefined} />
        {isPasswordType && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
            style={{
              position: 'absolute',
              right: '10px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 0.2s',
            }}
            title={showPassword ? 'Hide password' : 'Show password'}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function AuthSelect({ label, name, options, value, onChange }: {
  label: string; name: string; options: string[];
  value: string; onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
}) {
  return (
    <div>
      <label className="am-label" htmlFor={name}>{label}</label>
      <select id={name} className="am-input" name={name} required
        value={value} onChange={onChange as any}>
        <option value="">Select…</option>
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
}

export default function AuthModal({ isOpen, onClose, initialMode = 'login', initialRole = 'client' }: AuthModalProps) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [role, setRole] = useState<Role>(initialRole);
  const [step, setStep] = useState(1); // Sign-up step
  const [forgotStep, setForgotStep] = useState(1); // 1: Email, 2: OTP, 3: Reset Pass
  const [view, setView] = useState<ModalView>('form');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [formData, setFormData] = useState<Record<string, any>>({ services: [] });
  const [loading, setLoading] = useState(false);

  // Forgot password specific states
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Password visibility states
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  const navigate = useNavigate();

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setRole(initialRole);
      setStep(1);
      setForgotStep(1);
      setView('form');
      setError('');
      setSuccessMsg('');
      setOtp(['', '', '', '', '', '']);
      setFormData({ services: [] });
      setLoading(false);
      setForgotEmail('');
      setResetToken('');
      setNewPassword('');
      setConfirmNewPassword('');
      setShowLoginPassword(false);
      setShowNewPassword(false);
      setShowConfirmNewPassword(false);
    }
  }, [isOpen, initialMode, initialRole]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleInput = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    let val = e.target.value;
    if (e.target.name === 'phone') {
      // Only allow digits and leading + sign
      val = val.replace(/[^\d+]/g, '');
      if (val.startsWith('+')) {
        val = '+' + val.slice(1).replace(/\+/g, '');
      } else {
        val = val.replace(/\+/g, '');
      }
    }
    setFormData(prev => ({ ...prev, [e.target.name]: val }));
  };

  const toggleService = (value: string, checked: boolean) => {
    setFormData(prev => {
      const current = prev.services || [];
      if (checked) {
        if (role === 'freelancer' && current.length >= 4) {
          return prev; // Disallow more than 4 for freelancers
        }
        return {
          ...prev,
          services: [...current, value],
        };
      } else {
        return {
          ...prev,
          services: current.filter((s: string) => s !== value),
        };
      }
    });
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    if (!/^\d{6}$/.test(pastedData)) return; // Only accept exactly 6 digits
    const digits = pastedData.split('');
    setOtp(digits);
    // Focus the last input box
    document.getElementById('otp-5')?.focus();
  };

  // ── Login ──
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const email = formData['login-email'];
    const password = formData['login-password'];

    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403 && data.error && data.error.toLowerCase().includes('verify')) {
          // It requires verification, let's trigger sending the OTP & show the OTP screen
          await fetch(`${API_BASE}/api/auth/send-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, name: 'User' }),
          });
          setFormData(prev => ({ ...prev, email }));
          setView('otp');
          setError('Email not verified. We sent a verification code to your email.');
          setLoading(false);
          return;
        }
        throw new Error(data.error || 'Login failed');
      }

      setToken(data.token);
      setLoading(false);
      onClose();

      // Navigate based on actual role returned by backend
      const userRole = data.user.role;
      if (userRole === 'admin' || userRole === 'qa_admin') {
        navigate('/admin-dashboard');
      } else if (userRole === 'freelancer') {
        navigate('/freelancer-dashboard');
      } else {
        navigate('/client-dashboard');
      }
    } catch (err: any) {
      setLoading(false);
      setError(err.message);
    }
  };

  // ── Signup steps ──
  const maxSteps = role === 'client' ? 2 : 4;

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (step === 1) {
      if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword || !formData.phone) {
        setError('Please fill in all fields.'); return;
      }
      const numericPhone = formData.phone.replace(/[^\d]/g, '');
      if (
        !(numericPhone.startsWith('91') && numericPhone.length === 12) &&
        !(/^[6-9]\d{9}$/.test(numericPhone) && numericPhone.length === 10)
      ) {
        setError('Please enter a valid 10-digit Indian mobile number starting with +91 or 91.');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match.'); return;
      }
      if (formData.password.length < 8) {
        setError('Password must be at least 8 characters.'); return;
      }
    }
    if (step === 2 && !(formData.services || []).length) {
      setError('Please select at least one service.'); return;
    }
    if (step < maxSteps) {
      setStep(s => s + 1);
    } else {
      handleRegisterSubmit();
    }
  };

  // ── Register ──
  const handleRegisterSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          phone: formData.phone,
          role,
          services: formData.services || [],
          portfolioLink: formData.portfolio || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      // Keep token for verification later
      setToken(data.token);
      setLoading(false);
      setView('otp');
    } catch (err: any) {
      setLoading(false);
      setError(err.message);
    }
  };

  // ── OTP verify (For registration) ──
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const code = otp.join('');
    if (code.length < 6) { setError('Please enter the complete 6-digit code.'); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, otp: code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');

      // Save the new fully verified token
      setToken(data.token);

      setLoading(false);
      setView('success');
    } catch (err: any) {
      setLoading(false);
      setError(err.message);
    }
  };

  // ── Forgot Password OTP request ──
  const handleForgotEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!forgotEmail) { setError('Email address is required.'); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');

      setOtp(['', '', '', '', '', '']);
      setForgotStep(2);
      setLoading(false);
    } catch (err: any) {
      setLoading(false);
      setError(err.message);
    }
  };

  // ── Forgot Password OTP verification ──
  const handleForgotOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const code = otp.join('');
    if (code.length < 6) { setError('Please enter the complete 6-digit code.'); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail, otp: code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'OTP verification failed');

      setResetToken(data.resetToken);
      setForgotStep(3);
      setLoading(false);
    } catch (err: any) {
      setLoading(false);
      setError(err.message);
    }
  };

  // ── Reset to new password ──
  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!newPassword || !confirmNewPassword) { setError('Please fill all fields.'); return; }
    if (newPassword !== confirmNewPassword) { setError('Passwords do not match.'); return; }
    if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reset password failed');

      setSuccessMsg('Your password has been successfully reset. Please log in.');
      setMode('login');
      setForgotStep(1);
      setView('form');
      setLoading(false);
    } catch (err: any) {
      setLoading(false);
      setError(err.message);
    }
  };

  const handleDone = () => {
    onClose();
    if (role === 'freelancer') {
      navigate('/freelancer-dashboard');
    } else {
      navigate('/client-dashboard');
    }
  };


  const switchMode = (m: Mode) => {
    setMode(m); setStep(1); setForgotStep(1); setView('form');
    setError(''); setSuccessMsg(''); setFormData({ services: [] }); setOtp(['', '', '', '', '', '']);
    setForgotEmail(''); setResetToken(''); setNewPassword(''); setConfirmNewPassword('');
  };

  const switchRole = (r: Role) => {
    setRole(r); setStep(1); setForgotStep(1); setView('form');
    setError(''); setSuccessMsg(''); setFormData({ services: [] }); setOtp(['', '', '', '', '', '']);
  };

  const renderProgress = () => (
    <div className="am-progress">
      {Array.from({ length: maxSteps }, (_, i) => (
        <span key={i} className={i + 1 <= step ? 'am-progress-dot active' : 'am-progress-dot'} />
      ))}
      <span className="am-step-lbl">Step {step} of {maxSteps}</span>
    </div>
  );

  const renderClientStep = () => {
    if (step === 1) return (
      <>
        <h3 className="am-heading">Basic information</h3>
        <p className="am-help">Create your account to start your first project.</p>
        <div className="am-fields">
          <div className="am-split">
            <AuthField label="Full name" name="name" placeholder="Jane Smith" value={formData['name'] || ''} onChange={handleInput} />
            <AuthField label="Email address" name="email" type="email" placeholder="you@company.com" value={formData['email'] || ''} onChange={handleInput} />
          </div>
          <AuthField label="Phone / WhatsApp" name="phone" type="tel" placeholder="+91 98765 43210" value={formData['phone'] || ''} onChange={handleInput} />
          <div className="am-split">
            <AuthField label="Password" name="password" type="password" placeholder="Minimum 8 characters" value={formData['password'] || ''} onChange={handleInput} />
            <AuthField label="Confirm password" name="confirmPassword" type="password" placeholder="Repeat password" value={formData['confirmPassword'] || ''} onChange={handleInput} />
          </div>
        </div>
      </>
    );
    return (
      <>
        <h3 className="am-heading">What do you need?</h3>
        <p className="am-help">Select services you're interested in.</p>
        <div className="am-checkgrid">
          {clientServices.map(s => (
            <label key={s} className="am-check">
              <input type="checkbox" checked={(formData.services || []).includes(s)}
                onChange={e => toggleService(s, e.target.checked)} />
              {s}
            </label>
          ))}
        </div>
      </>
    );
  };

  const renderFreelancerStep = () => {
    if (step === 1) return (
      <>
        <h3 className="am-heading">Basic information</h3>
        <p className="am-help">Tell us how we can reach you.</p>
        <div className="am-fields">
          <div className="am-split">
            <AuthField label="Full name" name="name" placeholder="Jane Smith" value={formData['name'] || ''} onChange={handleInput} />
            <AuthField label="Email" name="email" type="email" placeholder="you@example.com" value={formData['email'] || ''} onChange={handleInput} />
          </div>
          <AuthField label="Phone / WhatsApp" name="phone" type="tel" placeholder="+91 98765 43210" value={formData['phone'] || ''} onChange={handleInput} />
          <div className="am-split">
            <AuthField label="Password" name="password" type="password" placeholder="Create a password" value={formData['password'] || ''} onChange={handleInput} />
            <AuthField label="Confirm password" name="confirmPassword" type="password" placeholder="Repeat" value={formData['confirmPassword'] || ''} onChange={handleInput} />
          </div>
        </div>
      </>
    );
    if (step === 2) {
      const selectedCount = (formData.services || []).length;
      const isMaxReached = selectedCount >= 4;

      return (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
            <h3 className="am-heading" style={{ margin: 0 }}>Area of expertise</h3>
            <span style={{ fontSize: '12px', fontWeight: 600, color: isMaxReached ? '#f59e0b' : '#38bdf8' }}>
              Selected: {selectedCount}/4 (Max 4)
            </span>
          </div>
          <p className="am-help">Select up to 4 services you specialize in.</p>
          <div className="am-checkgrid">
            {freelancerServices.map(s => {
              const isSelected = (formData.services || []).includes(s);
              const isDisabled = !isSelected && isMaxReached;

              return (
                <label
                  key={s}
                  className={`am-check ${isDisabled ? 'disabled' : ''}`}
                  style={isDisabled ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={isDisabled}
                    onChange={e => toggleService(s, e.target.checked)}
                  />
                  {s}
                </label>
              );
            })}
          </div>
          {isMaxReached && (
            <p style={{ fontSize: '12px', color: '#f59e0b', margin: '8px 0 0 0' }}>
              ⚠️ Selection limit reached (4/4). Uncheck a service if you want to select another one.
            </p>
          )}
        </>
      );
    };
    if (step === 3) return (
      <>
        <h3 className="am-heading">Proof of work</h3>
        <p className="am-help">Share work that showcases your expertise.</p>
        <div className="am-fields">
          <AuthField label="Primary tech / creative stack" name="techStack" placeholder="e.g., React, After Effects, Blender" value={formData['techStack'] || ''} onChange={handleInput} />
          <AuthField label="Portfolio / GitHub URL" name="portfolio" type="url" placeholder="https://…" value={formData['portfolio'] || ''} onChange={handleInput} />
          <AuthField label="Live project links (comma-separated)" name="liveProjects" placeholder="link1, link2" value={formData['liveProjects'] || ''} onChange={handleInput} />
        </div>
      </>
    );
    return (
      <>
        <h3 className="am-heading">Availability & payout</h3>
        <p className="am-help">Help us match you with the right projects.</p>
        <div className="am-fields">
          <AuthSelect label="Years of experience" name="experience"
            options={['Fresher', '1–3 Years', '3–5 Years', '5+ Years']} value={formData['experience'] || ''} onChange={handleInput} />
          <AuthSelect label="Hours per week available" name="capacity"
            options={['< 10 hrs', '10–20 hrs', '20–40 hrs', 'Full-time (40+ hrs)']} value={formData['capacity'] || ''} onChange={handleInput} />
        </div>
      </>
    );
  };

  const handleResendOtp = async () => {
    setError('');
    setLoading(true);
    try {
      const email = mode === 'forgot' ? forgotEmail : formData.email;
      const endpoint = mode === 'forgot'
        ? '/api/auth/forgot-password/send-otp'
        : '/api/auth/send-otp';

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name: formData.name || 'User' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Resend failed');
      setSuccessMsg('A new OTP has been sent to your email.');
      setOtp(['', '', '', '', '', '']);
    } catch (err: any) {
      setError(err.message || 'Failed to resend OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="am-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`am-box${view === 'form' && mode === 'signup' ? ' am-wide' : ''}`}
        role="dialog" aria-modal="true" aria-label="Account">

        {/* Close */}
        <button className="am-close" onClick={onClose} aria-label="Close">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M1 1l11 11M12 1L1 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        {/* Logo */}
        <img className="am-logo" src="/assets/workonova-logo.webp" alt="Workonova" />

        {/* ── OTP view (Sign-up verification) ── */}
        {view === 'otp' && (
          <form onSubmit={handleVerifyOtp}>
            <p className="am-eyebrow">VERIFY ACCOUNT</p>
            <h2 className="am-title">Enter verification code</h2>
            <p className="am-sub">We sent a 6-digit code to <b>{formData.email}</b></p>
            <div className="am-otp-row">
              {otp.map((v, i) => (
                <input key={i} id={`otp-${i}`} className="am-otp-box"
                  inputMode="numeric" maxLength={1} value={v}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                  onPaste={handleOtpPaste} />
              ))}
            </div>
            {error && <p className="am-error">{error}</p>}
            {successMsg && <p style={{ color: '#10b981', fontSize: '14px', marginBottom: '8px' }}>{successMsg}</p>}
            <p className="am-resend">Didn't receive it?{' '}
              <button type="button" className="am-link" onClick={handleResendOtp} disabled={loading}>
                {loading ? 'Sending…' : 'Resend OTP'}
              </button>
            </p>
            <button className="am-submit" type="submit" disabled={loading}>
              {loading ? 'Verifying…' : 'Verify & enter portal →'}
            </button>
          </form>
        )}

        {/* ── Success view ── */}
        {view === 'success' && (
          <div className="am-success">
            <div className="am-success-icon">✓</div>
            <p className="am-eyebrow">ACCOUNT ACTIVATED</p>
            <h2 className="am-title">Verified!</h2>
            <p className="am-sub">Welcome to Workonova. Your {role} workspace is ready.</p>
            <button className="am-submit" onClick={handleDone}>Go to dashboard →</button>
          </div>
        )}

        {/* ── Main form / Forgot Password ── */}
        {view === 'form' && (
          <>
            {/* Signup Form View */}
            {mode === 'signup' && (
              <>
                <div className={`am-role-switch${role === 'freelancer' ? ' is-freelancer' : ''}`}>
                  <div className="am-role-pill" />
                  <button type="button" className={role === 'client' ? 'active' : ''}
                    onClick={() => switchRole('client')}>Client</button>
                  <button type="button" className={role === 'freelancer' ? 'active' : ''}
                    onClick={() => switchRole('freelancer')}>Freelancer</button>
                </div>

                <p className="am-eyebrow">{role === 'client' ? 'CLIENT ACCOUNT' : 'FREELANCER ACCOUNT'}</p>
                <h2 className="am-title">Create your {role} account</h2>
                <p className="am-sub">
                  {role === 'client'
                    ? 'Choose packages, submit briefs, and track every delivery.'
                    : 'Showcase your expertise and receive project opportunities.'}
                </p>

                <form onSubmit={handleSignup}>
                  {renderProgress()}
                  {role === 'client' ? renderClientStep() : renderFreelancerStep()}
                  {error && <p className="am-error" style={{ marginTop: '10px' }}>{error}</p>}
                  <div className="am-actions">
                    {step > 1
                      ? <button type="button" className="am-back"
                          onClick={() => { setStep(s => s - 1); setError(''); }}>← Back</button>
                      : <span />}
                    <button className="am-submit" type="submit" style={{ flex: 1 }}>
                      {step < maxSteps ? 'Continue →' : 'Create account & send OTP →'}
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* Login View */}
            {mode === 'login' && (
              <>
                <div className={`am-role-switch${role === 'freelancer' ? ' is-freelancer' : ''}`}
                  style={{ marginBottom: '20px' }}>
                  <div className="am-role-pill" />
                  <button type="button" className={role === 'client' ? 'active' : ''}
                    onClick={() => switchRole('client')}>Client</button>
                  <button type="button" className={role === 'freelancer' ? 'active' : ''}
                    onClick={() => switchRole('freelancer')}>Freelancer</button>
                </div>

                <p className="am-eyebrow">WELCOME BACK</p>
                <h2 className="am-title">Log in as a {role}</h2>
                <p className="am-sub">Access your projects, briefs, and deliveries in one place.</p>

                {successMsg && <p style={{ color: '#10b981', fontSize: '14px', marginBottom: '14px' }}>{successMsg}</p>}

                <form onSubmit={handleLogin}>
                  <div className="am-fields">
                    <AuthField label="Email address" name="login-email" id="login-email"
                      type="email" placeholder="you@company.com" value={formData['login-email'] || ''} onChange={handleInput} />
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <label className="am-label" htmlFor="login-password">Password</label>
                        <button type="button" className="am-link" style={{ fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer' }}
                          onClick={() => switchMode('forgot')}>Forgot password?</button>
                      </div>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input id="login-password" className="am-input" type={showLoginPassword ? 'text' : 'password'} name="login-password"
                          placeholder="••••••••" required value={formData['login-password'] || ''} onChange={handleInput}
                          style={{ paddingRight: '42px' }} />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassword(!showLoginPassword)}
                          tabIndex={-1}
                          style={{
                            position: 'absolute',
                            right: '10px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#94a3b8',
                            padding: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'color 0.2s',
                          }}
                          title={showLoginPassword ? 'Hide password' : 'Show password'}
                          aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                        >
                          {showLoginPassword ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                              <line x1="1" y1="1" x2="23" y2="23"></line>
                            </svg>
                          ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                              <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                  {error && <p className="am-error">{error}</p>}
                  <button className="am-submit" type="submit" disabled={loading} style={{ marginTop: '20px' }}>
                    {loading ? 'Logging in…' : 'Log in →'}
                  </button>
                  <div style={{ marginTop: '16px', textAlign: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '12px' }}>
                    <a
                      href="/admin"
                      onClick={(e) => {
                        e.preventDefault();
                        onClose();
                        navigate('/admin');
                      }}
                      style={{ fontSize: '12px', color: '#64748b', textDecoration: 'none', transition: 'color 0.2s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#94a3b8')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#64748b')}
                    >
                      Staff or Executive? Access Admin Portal →
                    </a>
                  </div>
                </form>
              </>
            )}

            {/* Forgot Password View */}
            {mode === 'forgot' && (
              <>
                <p className="am-eyebrow">SECURITY MANAGEMENT</p>
                <h2 className="am-title">Reset your password</h2>

                {forgotStep === 1 && (
                  <form onSubmit={handleForgotEmailSubmit}>
                    <p className="am-sub">Enter your registered email address below, and we will send you a 6-digit OTP to reset your password.</p>
                    <div className="am-fields" style={{ margin: '20px 0' }}>
                      <div>
                        <label className="am-label" htmlFor="forgot-email">Email address</label>
                        <input id="forgot-email" className="am-input" type="email" placeholder="you@company.com" required
                          value={forgotEmail} onChange={e => setForgotEmail(e.target.value.trim())} />
                      </div>
                    </div>
                    {error && <p className="am-error">{error}</p>}
                    <button className="am-submit" type="submit" disabled={loading}>
                      {loading ? 'Sending OTP…' : 'Send verification OTP →'}
                    </button>
                  </form>
                )}

                {forgotStep === 2 && (
                  <form onSubmit={handleForgotOtpSubmit}>
                    <p className="am-sub">Enter the 6-digit verification code sent to <b>{forgotEmail}</b></p>
                    <div className="am-otp-row" style={{ margin: '20px 0' }}>
                      {otp.map((v, i) => (
                        <input key={i} id={`otp-${i}`} className="am-otp-box"
                          inputMode="numeric" maxLength={1} value={v}
                          onChange={e => handleOtpChange(i, e.target.value)}
                          onKeyDown={e => handleOtpKeyDown(i, e)}
                          onPaste={handleOtpPaste} />
                      ))}
                    </div>
                    {error && <p className="am-error">{error}</p>}
                    <p className="am-resend">Didn't receive code?{' '}
                      <button type="button" className="am-link" onClick={handleResendOtp}>
                        Resend OTP
                      </button>
                    </p>
                    <button className="am-submit" type="submit" disabled={loading}>
                      {loading ? 'Verifying…' : 'Verify OTP →'}
                    </button>
                  </form>
                )}

                {forgotStep === 3 && (
                  <form onSubmit={handlePasswordResetSubmit}>
                    <p className="am-sub">Create a new secure password for your account.</p>
                    <div className="am-fields" style={{ margin: '20px 0' }}>
                      <div>
                        <label className="am-label" htmlFor="new-password">New password</label>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <input id="new-password" className="am-input" type={showNewPassword ? 'text' : 'password'} placeholder="Minimum 8 characters" required
                            value={newPassword} onChange={e => setNewPassword(e.target.value)}
                            style={{ paddingRight: '42px' }} />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            tabIndex={-1}
                            style={{
                              position: 'absolute',
                              right: '10px',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: '#94a3b8',
                              padding: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            title={showNewPassword ? 'Hide password' : 'Show password'}
                          >
                            {showNewPassword ? (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                                <line x1="1" y1="1" x2="23" y2="23"></line>
                              </svg>
                            ) : (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="am-label" htmlFor="confirm-new-password">Confirm new password</label>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <input id="confirm-new-password" className="am-input" type={showConfirmNewPassword ? 'text' : 'password'} placeholder="Repeat new password" required
                            value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)}
                            style={{ paddingRight: '42px' }} />
                          <button
                            type="button"
                            onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                            tabIndex={-1}
                            style={{
                              position: 'absolute',
                              right: '10px',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: '#94a3b8',
                              padding: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            title={showConfirmNewPassword ? 'Hide password' : 'Show password'}
                          >
                            {showConfirmNewPassword ? (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                                <line x1="1" y1="1" x2="23" y2="23"></line>
                              </svg>
                            ) : (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                    {error && <p className="am-error">{error}</p>}
                    <button className="am-submit" type="submit" disabled={loading}>
                      {loading ? 'Resetting…' : 'Update password & log in →'}
                    </button>
                  </form>
                )}

                <p className="am-switch" style={{ marginTop: '20px' }}>
                  Back to{' '}
                  <button className="am-link" onClick={() => switchMode('login')}>
                    Log in
                  </button>
                </p>
              </>
            )}

            {mode !== 'forgot' && (
              <p className="am-switch">
                {mode === 'login' ? 'New to Workonova? ' : 'Already have an account? '}
                <button className="am-link" onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}>
                  {mode === 'login' ? 'Create an account' : 'Log in'}
                </button>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
