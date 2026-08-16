import { useState, useEffect } from 'react';
import { getUser } from '../utils/auth.js';

interface WelcomePopupProps {
  role: 'client' | 'freelancer';
}

export default function WelcomePopup({ role }: WelcomePopupProps) {
  const [isOpen, setIsOpen] = useState(false);
  const user = getUser();

  useEffect(() => {
    if (user) {
      const storageKey = `worknova_welcomed_${user.id}`;
      const alreadyWelcomed = localStorage.getItem(storageKey);
      if (!alreadyWelcomed) {
        setIsOpen(true);
      }
    }
  }, [user]);

  const handleClose = () => {
    if (user) {
      localStorage.setItem(`worknova_welcomed_${user.id}`, 'true');
    }
    setIsOpen(false);
  };

  if (!isOpen || !user) return null;

  return (
    <div className="wp-overlay" onClick={handleClose}>
      <div className="wp-box" onClick={e => e.stopPropagation()}>
        {/* Glow Effects */}
        <div className="wp-glow-1"></div>
        <div className="wp-glow-2"></div>

        {/* Close Button */}
        <button className="wp-close" onClick={handleClose} aria-label="Close welcome message">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        {/* Icon & Welcome */}
        <div className="wp-badge">
          {role === 'client' ? '💼 Client Workspace' : '🚀 Partner Network'}
        </div>
        
        <h2 className="wp-title">
          Welcome to WORKONOVA,<br />
          <span className="wp-highlight">{user.name}</span>!
        </h2>
        
        <p className="wp-text">
          {role === 'client' ? (
            "We're thrilled to have you here. This is your personal hub where you can browse premium curated creative and tech services, coordinate files, view live project milestones, and securely manage invoicing."
          ) : (
            "Welcome to our elite team of creators, developers, and designers. In this workspace, you can manage your task ledger, view brief details, submit deliverables, and monitor your payouts in real-time."
          )}
        </p>

        <div className="wp-action-container">
          <button className="wp-btn" onClick={handleClose}>
            Let's get started →
          </button>
        </div>
      </div>
    </div>
  );
}
