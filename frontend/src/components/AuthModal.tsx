import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'signup';
}

const clientServices = ['Graphic Designing', 'Video Editing', '3D Design & Modeling', 'VFX', 'Animation', 'Digital Marketing', 'Website Development', 'Software Development', 'App Development', 'AI Services', 'IT Services', 'Cyber Security'];
const freelancerServices = ['Graphic Designing', 'Video Editing', '3D Design & Modeling', 'VFX (Visual Effects)', 'Motion Graphics', 'Digital Marketing', 'Website Development', 'Software Development', 'Mobile App Dev', 'AI Services & Automation'];
const techServices = ['Website Development', 'Software Development', 'Mobile App Dev', 'AI Services & Automation'];
const creativeServices = ['Graphic Designing', 'Video Editing', '3D Design & Modeling', 'VFX (Visual Effects)', 'Motion Graphics'];

export default function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [role, setRole] = useState<'client' | 'freelancer'>('client');
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [isOtp, setIsOtp] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState<any>({ services: [] });

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setRole('client');
      setStep(1);
      setIsOtp(false);
      setIsSuccess(false);
      setError('');
      setFormData({ services: [] });
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    setFormData((prev: any) => {
      const services = prev.services || [];
      if (checked) return { ...prev, services: [...services, value] };
      return { ...prev, services: services.filter((s: string) => s !== value) };
    });
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (role === 'freelancer') navigate('/freelancer-dashboard');
    else navigate('/client-dashboard');
    onClose();
  };

  const handleClientSignup = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (step === 1) {
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!formData.services?.length) {
        setError('Please select at least one service.');
        return;
      }
      setIsOtp(true);
    }
  };

  const handleFreelancerSignup = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (step === 1) {
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!formData.services?.length) {
        setError('Please select at least one service.');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    } else if (step === 4) {
      setIsOtp(true);
    }
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsOtp(false);
    setIsSuccess(true);
  };

  const handleDone = () => {
    if (role === 'freelancer') navigate('/freelancer-dashboard');
    else navigate('/client-dashboard');
    onClose();
  };

  const renderProgress = (total: number) => (
    <>
      <div className="freelancer-progress">
        {Array.from({ length: total }, (_, i) => i + 1).map(s => (
          <span key={s} className={s <= step ? 'is-active' : ''}>{s}</span>
        ))}
      </div>
      <p className="freelancer-step-label">STEP {step} OF {total}</p>
    </>
  );

  return (
    <dialog open id="accountModal" className="react-modal" style={{ display: 'block', position: 'fixed', zIndex: 1000, top: '50%', left: '50%', transform: 'translate(-50%, -50%)', margin: 0 }}>
      <button className="close account-close" onClick={onClose} aria-label="Close">×</button>
      <img className="account-logo" src="/assets/workonova-logo.webp" alt="Workonova" />
      
      {!isOtp && !isSuccess && (
        <div className="role-switch" style={{ marginBottom: '20px' }}>
          <button type="button" className={role === 'client' ? 'is-active' : ''} onClick={() => { setRole('client'); setStep(1); }}>Client</button>
          <button type="button" className={role === 'freelancer' ? 'is-active' : ''} onClick={() => { setRole('freelancer'); setStep(1); }}>Freelancer</button>
        </div>
      )}

      {isSuccess ? (
        <>
          <p className="eyebrow" id="accountEyebrow">ACCOUNT VERIFIED</p>
          <h2 id="accountTitle">You're all set!</h2>
          <p className="modal-text" id="accountText">Your {role} account has been created successfully.</p>
          <form className="account-form">
            <button className="pill bright account-finish" type="button" onClick={handleDone}>Done <span>→</span></button>
          </form>
        </>
      ) : isOtp ? (
        <>
          <p className="eyebrow" id="accountEyebrow">VERIFY YOUR ACCOUNT</p>
          <h2 id="accountTitle">Enter your OTP</h2>
          <p className="modal-text" id="accountText">We sent a 6-digit verification code to your email.</p>
          <form className="account-form" onSubmit={handleOtpSubmit}>
            <div className="otp-inputs">
              {[1,2,3,4,5,6].map(i => <input key={i} required maxLength={1} style={{ width: '40px', textAlign: 'center' }} />)}
            </div>
            <p className="freelancer-help">Didn’t receive a code? <button type="button" style={{ color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer' }}>Resend OTP</button></p>
            <button className="pill bright" type="submit">Verify & create account <span>→</span></button>
          </form>
        </>
      ) : mode === 'login' ? (
        <>
          <p className="eyebrow" id="accountEyebrow">WELCOME BACK</p>
          <h2 id="accountTitle">Log in as a {role === 'client' ? 'Client' : 'Freelancer'}</h2>
          <p className="modal-text" id="accountText">Log in to manage your Workonova projects.</p>
          <form className="account-form" onSubmit={handleLogin}>
            <label>Email address<input type="email" required placeholder="you@company.com" /></label>
            <label>Password<input type="password" required placeholder="••••••••" /></label>
            <button className="pill bright" type="submit">Log in <span>→</span></button>
          </form>
        </>
      ) : (
        <>
          <p className="eyebrow" id="accountEyebrow">{role === 'client' ? 'CLIENT' : 'FREELANCER'} ACCOUNT</p>
          <h2 id="accountTitle">Create your {role === 'client' ? 'Client' : 'Freelancer'} account</h2>
          <p className="modal-text" id="accountText">Create an account to get started.</p>
          <form className="account-form" onSubmit={role === 'client' ? handleClientSignup : handleFreelancerSignup}>
            {role === 'client' && (
              <>
                {step === 1 && (
                  <>
                    {renderProgress(2)}
                    <h3>Basic information</h3>
                    <label>Full name<input type="text" name="name" required onChange={handleInputChange} /></label>
                    <label>Email address<input type="email" name="email" required onChange={handleInputChange} /></label>
                    <label>Password<input type="password" name="password" required onChange={handleInputChange} /></label>
                    <label>Confirm Password<input type="password" name="confirmPassword" required onChange={handleInputChange} /></label>
                    {error && <p style={{ color: 'red' }}>{error}</p>}
                    <button className="pill bright" type="submit">Continue <span>→</span></button>
                  </>
                )}
                {step === 2 && (
                  <>
                    {renderProgress(2)}
                    <h3>What do you need?</h3>
                    <div className="service-options" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '20px' }}>
                      {clientServices.map(s => (
                        <label key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                          <input type="checkbox" name="services" value={s} onChange={handleCheckboxChange} />
                          <span style={{ fontSize: '0.85rem' }}>{s}</span>
                        </label>
                      ))}
                    </div>
                    {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
                    <div className="form-actions" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                      <button type="button" onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>← Back</button>
                      <button className="pill bright" type="submit">Create My Account <span>→</span></button>
                    </div>
                  </>
                )}
              </>
            )}

            {role === 'freelancer' && (
              <>
                {step === 1 && (
                  <>
                    {renderProgress(4)}
                    <h3>Basic information</h3>
                    <label>Full name<input type="text" name="name" required onChange={handleInputChange} /></label>
                    <label>Email address<input type="email" name="email" required onChange={handleInputChange} /></label>
                    <label>Phone<input type="tel" name="phone" required onChange={handleInputChange} /></label>
                    <label>Password<input type="password" name="password" required onChange={handleInputChange} /></label>
                    <label>Confirm Password<input type="password" name="confirmPassword" required onChange={handleInputChange} /></label>
                    {error && <p style={{ color: 'red' }}>{error}</p>}
                    <button className="pill bright" type="submit">Continue <span>→</span></button>
                  </>
                )}
                {step === 2 && (
                  <>
                    {renderProgress(4)}
                    <h3>Area of expertise</h3>
                    <div className="service-options" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '20px' }}>
                      {freelancerServices.map(s => (
                        <label key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                          <input type="checkbox" name="services" value={s} onChange={handleCheckboxChange} />
                          <span style={{ fontSize: '0.85rem' }}>{s}</span>
                        </label>
                      ))}
                    </div>
                    {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
                    <div className="form-actions" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                      <button type="button" onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>← Back</button>
                      <button className="pill bright" type="submit">Continue <span>→</span></button>
                    </div>
                  </>
                )}
                {step === 3 && (
                  <>
                    {renderProgress(4)}
                    <h3>Proof of work</h3>
                    <label>Portfolio / work samples URL<input type="url" name="portfolio" required onChange={handleInputChange} /></label>
                    <div className="form-actions" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                      <button type="button" onClick={() => setStep(2)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>← Back</button>
                      <button className="pill bright" type="submit">Continue <span>→</span></button>
                    </div>
                  </>
                )}
                {step === 4 && (
                  <>
                    {renderProgress(4)}
                    <h3>Availability & payout onboarding</h3>
                    <label>Years of experience
                      <select name="experience" required onChange={handleInputChange} style={{ width: '100%', padding: '10px', marginTop: '5px', background: '#222', color: '#fff', border: '1px solid #333', borderRadius: '4px' }}>
                        <option value="">Select experience</option>
                        <option>Fresher</option><option>1-3 Years</option><option>3-5 Years</option><option>5+ Years</option>
                      </select>
                    </label>
                    <div className="form-actions" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                      <button type="button" onClick={() => setStep(3)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>← Back</button>
                      <button className="pill bright" type="submit">Create freelancer account <span>→</span></button>
                    </div>
                  </>
                )}
              </>
            )}
          </form>
        </>
      )}

      {!isOtp && !isSuccess && (
        <p className="switch-account" id="switchAccount" style={{ marginTop: '20px', textAlign: 'center' }}>
          {mode === 'login' ? 'New to Workonova? ' : 'Already have an account? '}
          <button type="button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} style={{ color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
            {mode === 'login' ? 'Create an account' : 'Log in'}
          </button>
        </p>
      )}
    </dialog>
  );
}
