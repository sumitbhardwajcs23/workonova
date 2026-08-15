import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'signup';
}

type Role = 'client' | 'freelancer';
type Mode = 'login' | 'signup';
type ModalView = 'form' | 'otp' | 'success';

const clientServices = [
  'Graphic Designing', 'Video Editing', '3D Design & Modeling', 'VFX', 
  'Animation', 'Digital Marketing', 'Website Development', 'Software Development', 
  'App Development', 'AI Services', 'IT Services', 'Cyber Security',
];

const freelancerServices = [
  'Graphic Designing', 'Video Editing', '3D Design & Modeling', 'VFX (Visual Effects)',
  'Motion Graphics', 'Digital Marketing', 'Website Development', 'Software Development',
  'Mobile App Dev', 'AI Services & Automation',
];

export default function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [role, setRole] = useState<Role>('client');
  const [step, setStep] = useState(1);
  const [view, setView] = useState<ModalView>('form');
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<Record<string, any>>({ services: [] });
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setRole('client');
      setStep(1);
      setView('form');
      setError('');
      setFormData({ services: [] });
    }
  }, [isOpen, initialMode]);

  // Lock body scroll when modal open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleInput = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleCheck = (value: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      services: checked
        ? [...(prev.services || []), value]
        : (prev.services || []).filter((s: string) => s !== value),
    }));
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(role === 'freelancer' ? '/freelancer-dashboard' : '/client-dashboard');
    onClose();
  };

  const maxSteps = role === 'client' ? 2 : 4;

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (step === 1 && formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if ((step === 2) && !formData.services?.length) {
      setError('Please select at least one service.');
      return;
    }
    if (step < maxSteps) {
      setStep(s => s + 1);
    } else {
      setView('otp');
    }
  };

  const handleOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setView('success');
  };

  const handleDone = () => {
    navigate(role === 'freelancer' ? '/freelancer-dashboard' : '/client-dashboard');
    onClose();
  };

  const switchMode = (newMode: Mode) => {
    setMode(newMode);
    setStep(1);
    setView('form');
    setError('');
    setFormData({ services: [] });
  };

  const switchRole = (newRole: Role) => {
    setRole(newRole);
    setStep(1);
    setView('form');
    setError('');
    setFormData({ services: [] });
  };

  const renderProgress = () => (
    <div style={{ marginBottom: '20px' }}>
      <div className="freelancer-progress">
        {Array.from({ length: maxSteps }, (_, i) => (
          <span key={i + 1} className={i + 1 <= step ? 'is-active' : ''}>{i + 1}</span>
        ))}
        <span className="freelancer-step-label" style={{ marginLeft: 'auto' }}>
          STEP {step} OF {maxSteps}
        </span>
      </div>
    </div>
  );

  const InputField = ({
    label, name, type = 'text', placeholder = '', required = true,
  }: { label: string; name: string; type?: string; placeholder?: string; required?: boolean }) => (
    <div>
      <label className="form-label" htmlFor={name}>{label}</label>
      <input
        id={name}
        className="form-input"
        type={type}
        name={name}
        placeholder={placeholder}
        required={required}
        value={formData[name] || ''}
        onChange={handleInput}
      />
    </div>
  );

  const SelectField = ({
    label, name, options,
  }: { label: string; name: string; options: string[] }) => (
    <div>
      <label className="form-label" htmlFor={name}>{label}</label>
      <select
        id={name}
        className="form-input"
        name={name}
        required
        value={formData[name] || ''}
        onChange={handleInput}
      >
        <option value="">Select…</option>
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  );

  const renderClientForm = () => (
    <>
      {renderProgress()}
      {step === 1 && (
        <>
          <h3 className="form-heading">Basic information</h3>
          <p className="form-help">Create your account to start your first project.</p>
          <div className="form-group">
            <InputField label="Full name" name="name" placeholder="Jane Smith" />
            <InputField label="Email address" name="email" type="email" placeholder="you@company.com" />
            <InputField label="Password" name="password" type="password" placeholder="Minimum 8 characters" />
            <InputField label="Confirm password" name="confirmPassword" type="password" placeholder="Repeat your password" />
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <h3 className="form-heading">What do you need?</h3>
          <p className="form-help">Select the services you are interested in. You can always change this later.</p>
          <div className="service-options">
            {clientServices.map(s => (
              <label key={s} className="service-option-label">
                <input
                  type="checkbox"
                  checked={(formData.services || []).includes(s)}
                  onChange={e => handleCheck(s, e.target.checked)}
                />
                {s}
              </label>
            ))}
          </div>
        </>
      )}
    </>
  );

  const renderFreelancerForm = () => (
    <>
      {renderProgress()}
      {step === 1 && (
        <>
          <h3 className="form-heading">Basic information</h3>
          <p className="form-help">Tell us how we can contact you about suitable projects.</p>
          <div className="form-group">
            <div className="form-split">
              <InputField label="Full name" name="name" placeholder="Jane Smith" />
              <InputField label="Email address" name="email" type="email" placeholder="you@example.com" />
            </div>
            <InputField label="Phone / WhatsApp" name="phone" type="tel" placeholder="+91 98765 43210" />
            <div className="form-split">
              <InputField label="Password" name="password" type="password" placeholder="Create a password" />
              <InputField label="Confirm password" name="confirmPassword" type="password" placeholder="Repeat your password" />
            </div>
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <h3 className="form-heading">Area of expertise</h3>
          <p className="form-help">What services can you provide? Select all that apply.</p>
          <div className="service-options">
            {freelancerServices.map(s => (
              <label key={s} className="service-option-label">
                <input
                  type="checkbox"
                  checked={(formData.services || []).includes(s)}
                  onChange={e => handleCheck(s, e.target.checked)}
                />
                {s}
              </label>
            ))}
          </div>
        </>
      )}
      {step === 3 && (
        <>
          <h3 className="form-heading">Proof of work</h3>
          <p className="form-help">Share work that helps our team assess your expertise.</p>
          <div className="form-group">
            <InputField label="Primary tech / creative stack" name="techStack" placeholder="e.g., React, After Effects, Blender" />
            <InputField label="Portfolio / GitHub URL" name="portfolio" type="url" placeholder="https://…" />
            <InputField label="Live project links (min. 2, comma-separated)" name="liveProjects" placeholder="link1, link2" />
          </div>
        </>
      )}
      {step === 4 && (
        <>
          <h3 className="form-heading">Availability & payout</h3>
          <p className="form-help">Help us match you with projects that fit your schedule.</p>
          <div className="form-group">
            <SelectField label="Years of experience" name="experience" options={['Fresher', '1–3 Years', '3–5 Years', '5+ Years']} />
            <SelectField label="Hours per week available" name="capacity" options={['< 10 hrs', '10–20 hrs', '20–40 hrs', 'Full-time (40+ hrs)']} />
          </div>
        </>
      )}
    </>
  );

  return (
    <div className="react-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`react-modal${view === 'form' && mode === 'signup' ? ' wide' : ''}`} role="dialog" aria-modal="true">
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </button>

        <img className="modal-logo" src="/assets/workonova-logo.webp" alt="Workonova" />

        {/* OTP view */}
        {view === 'otp' && (
          <form onSubmit={handleOtp}>
            <p className="modal-eyebrow">VERIFY YOUR ACCOUNT</p>
            <h2 className="modal-title">Enter your OTP</h2>
            <p className="modal-subtitle">We sent a 6-digit code to your email. Please check your inbox.</p>
            <div className="otp-inputs">
              {[1,2,3,4,5,6].map(i => (
                <input
                  key={i}
                  aria-label={`OTP digit ${i}`}
                  inputMode="numeric"
                  maxLength={1}
                  required
                  onInput={e => {
                    const next = (e.target as HTMLInputElement).nextElementSibling as HTMLInputElement;
                    if ((e.target as HTMLInputElement).value && next) next.focus();
                  }}
                />
              ))}
            </div>
            <p style={{ fontSize: '13px', color: 'var(--ink-muted)', marginBottom: '16px' }}>
              Didn't receive it?{' '}
              <button type="button" style={{ background: 'none', border: 'none', color: 'var(--lime)', cursor: 'pointer', fontWeight: 700 }}>
                Resend OTP
              </button>
            </p>
            <button className="btn-submit" type="submit">Verify & create account →</button>
          </form>
        )}

        {/* Success view */}
        {view === 'success' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div className="success-icon">✓</div>
            <p className="modal-eyebrow" style={{ justifyContent: 'center' }}>ACCOUNT VERIFIED</p>
            <h2 className="modal-title">You're all set!</h2>
            <p className="modal-subtitle">Your {role} account has been created successfully. Welcome to Workonova!</p>
            <button className="btn-submit" onClick={handleDone}>
              Go to dashboard →
            </button>
          </div>
        )}

        {/* Main form view */}
        {view === 'form' && (
          <>
            {/* Role switch (signup only) */}
            {mode === 'signup' && (
              <div className={`role-switch${role === 'freelancer' ? ' is-freelancer' : ''}`}>
                <div className="role-switch-indicator" />
                <button
                  type="button"
                  className={role === 'client' ? 'is-active' : ''}
                  onClick={() => switchRole('client')}
                >
                  Client
                </button>
                <button
                  type="button"
                  className={role === 'freelancer' ? 'is-active' : ''}
                  onClick={() => switchRole('freelancer')}
                >
                  Freelancer
                </button>
              </div>
            )}

            {/* Header */}
            <p className="modal-eyebrow">
              {mode === 'login'
                ? 'WELCOME BACK'
                : role === 'client' ? 'CLIENT ACCOUNT' : 'FREELANCER ACCOUNT'}
            </p>
            <h2 className="modal-title">
              {mode === 'login'
                ? `Log in as a ${role}`
                : `Create your ${role} account`}
            </h2>
            <p className="modal-subtitle">
              {mode === 'login'
                ? `Log in to manage your Workonova projects and deliveries.`
                : role === 'client'
                  ? 'Create an account to choose packages, submit briefs, and track every delivery.'
                  : 'Create an account to showcase your expertise and receive project opportunities.'}
            </p>

            {/* Login form */}
            {mode === 'login' && (
              <form onSubmit={handleLogin}>
                <div className="form-group">
                  <div>
                    <label className="form-label" htmlFor="email-login">Email address</label>
                    <input id="email-login" className="form-input" type="email" placeholder="you@company.com" required />
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <label className="form-label" htmlFor="password-login">Password</label>
                      <a href="#" style={{ fontSize: '12px', color: 'var(--lime)', fontWeight: 600 }}>Forgot?</a>
                    </div>
                    <input id="password-login" className="form-input" type="password" placeholder="••••••••" required />
                  </div>
                </div>
                <button className="btn-submit" type="submit" style={{ marginTop: '20px' }}>
                  Log in →
                </button>
              </form>
            )}

            {/* Signup form */}
            {mode === 'signup' && (
              <form onSubmit={handleSignup}>
                {role === 'client' ? renderClientForm() : renderFreelancerForm()}
                
                {error && <p className="form-error" style={{ marginTop: '12px' }}>{error}</p>}
                
                <div className="form-actions" style={{ marginTop: '20px' }}>
                  {step > 1 ? (
                    <button
                      type="button"
                      className="btn-back"
                      onClick={() => { setStep(s => s - 1); setError(''); }}
                    >
                      ← Back
                    </button>
                  ) : <div />}
                  <button className="btn-submit" type="submit" style={{ flex: 1, maxWidth: step > 1 ? '65%' : '100%' }}>
                    {step < maxSteps ? 'Continue →' : 'Create account →'}
                  </button>
                </div>
              </form>
            )}

            <p className="switch-text">
              {mode === 'login' ? 'New to Workonova? ' : 'Already have an account? '}
              <button onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}>
                {mode === 'login' ? 'Create an account' : 'Log in'}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
