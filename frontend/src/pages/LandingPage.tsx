import React, { useState } from 'react';
import Hero from '../components/Hero';
import Services from '../components/Services';
import AuthModal from '../components/AuthModal';

const trustBrands = ['northstar', 'BLUEROOM', 'dashly', 'pixel & co', 'HORIZON', 'northstar', 'BLUEROOM', 'dashly', 'pixel & co', 'HORIZON'];

const steps = [
  { num: '01', label: 'STEP 01 OF 05', title: 'Discovery & Requirement Mapping', desc: 'We analyze your business goals, target audience, brand guidelines, and technical parameters to craft a tailored blueprint.' },
  { num: '02', label: 'STEP 02 OF 05', title: 'Creative Concepts & Architecture', desc: 'Our design and engineering leads create moodboards, storyboards, wireframes, or database schemas for your approval.' },
  { num: '03', label: 'STEP 03 OF 05', title: 'Execution & High-Velocity Production', desc: 'Our specialists edit video reels, render 3D scenes, write clean Next.js/React code, or build Gemini AI workflows.' },
  { num: '04', label: 'STEP 04 OF 05', title: 'Quality Assurance & Revisions', desc: 'Rigorous testing for visual perfection, mobile responsiveness, color grading accuracy, and API performance.' },
  { num: '05', label: 'STEP 05 OF 05', title: 'Final Delivery & Scale Growth', desc: 'Hassle-free deployment, source code and project asset handover, and continuous support for ads or software.' },
];

export default function LandingPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [modal, setModal] = useState<{ isOpen: boolean; mode: 'login' | 'signup' }>({ isOpen: false, mode: 'login' });

  const openModal = (mode: 'login' | 'signup') => setModal({ isOpen: true, mode });
  const closeModal = () => setModal(m => ({ ...m, isOpen: false }));

  return (
    <>
      {/* ── HEADER ── */}
      <header>
        <a className="brand" href="#top" aria-label="Workonova home">
          <img src="/assets/workonova-logo.webp" alt="Workonova logo" />
        </a>
        <nav aria-label="Main navigation">
          <a href="#services">Services</a>
          <a href="#process">How it works</a>
          <a href="#why">Why Workonova</a>
        </nav>
        <div className="head-actions">
          <button className="btn-ghost" onClick={() => openModal('login')}>Log in</button>
          <button className="btn-pill" onClick={() => openModal('signup')}>Get started</button>
          <button
            className="hamburger"
            aria-label="Open menu"
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen(true)}
          >
            ☰
          </button>
        </div>
      </header>

      {/* ── MOBILE MENU ── */}
      <div
        className={`menu-backdrop${isMobileMenuOpen ? ' is-open' : ''}`}
        onClick={() => setIsMobileMenuOpen(false)}
        aria-hidden="true"
      />
      <aside className={`mobile-menu${isMobileMenuOpen ? ' is-open' : ''}`} aria-label="Mobile navigation">
        <button
          className="menu-close"
          aria-label="Close menu"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          ✕
        </button>
        <a className="brand" href="#top" onClick={() => setIsMobileMenuOpen(false)}>
          <img src="/assets/workonova-logo.webp" alt="Workonova" />
        </a>
        <nav>
          <a href="#services" onClick={() => setIsMobileMenuOpen(false)}>Services</a>
          <a href="#process" onClick={() => setIsMobileMenuOpen(false)}>How it works</a>
          <a href="#why" onClick={() => setIsMobileMenuOpen(false)}>Why Workonova</a>
        </nav>
        <div className="mobile-account">
          <button className="btn-ghost" onClick={() => { openModal('login'); setIsMobileMenuOpen(false); }}>Log in</button>
          <button className="btn-pill" onClick={() => { openModal('signup'); setIsMobileMenuOpen(false); }}>Get started</button>
        </div>
      </aside>

      <main id="top">
        {/* ── HERO ── */}
        <Hero onOpenSignup={() => openModal('signup')} />

        {/* ── TRUST STRIP ── */}
        <section className="trust" aria-label="Trusted by">
          <p className="trust-label">Trusted by</p>
          <div className="trust-logos" aria-hidden="true">
            {trustBrands.map((b, i) => <b key={i}>{b}</b>)}
          </div>
        </section>

        {/* ── PROCESS ── */}
        <section className="section process" id="process">
          <div className="section-header">
            <p className="eyebrow">HOW WE EXECUTE</p>
            <h2>Our 5-step streamlined process.</h2>
            <p>From initial concept to final delivery — complete transparency at every stage.</p>
          </div>
          <div className="execution-grid">
            {steps.map(s => (
              <article key={s.num}>
                <span>{s.num}</span>
                <div>
                  <p className="step-label">{s.label}</p>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ── SERVICES ── */}
        <Services />

        {/* ── CLOSING CTA ── */}
        <section className="closing" aria-label="Get started">
          <div>
            <p className="eyebrow">READY TO CREATE BETTER?</p>
            <h2>Bring your next big idea to life.</h2>
          </div>
          <button className="cta-primary" onClick={() => openModal('signup')}>
            Start a project
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </section>
      </main>

      {/* ── FOOTER ── */}
      <footer>
        <div>
          <a className="brand footer-brand" href="#top" aria-label="Workonova home">
            <img src="/assets/workonova-logo.webp" alt="Workonova" />
          </a>
          <p className="footer-desc">Premium creative and tech solutions, delivered without the usual hassle.</p>
        </div>
        <div>
          <h4>Product</h4>
          <a href="#services">Services</a>
          <a href="#process">How it works</a>
          <button className="btn-ghost" style={{ textAlign: 'left', padding: 0, fontSize: '13.5px', color: 'var(--ink-muted)' }} onClick={() => openModal('signup')}>Get started</button>
        </div>
        <div>
          <h4>Company</h4>
          <a href="#">About</a>
          <a href="#">Careers</a>
          <a href="#">Blog</a>
        </div>
        <div>
          <h4>Contact</h4>
          <a href="mailto:contact@workonova.com">contact@workonova.com</a>
          <a href="https://instagram.com/workonova" target="_blank" rel="noopener noreferrer">Instagram</a>
          <a href="https://linkedin.com/company/workonova" target="_blank" rel="noopener noreferrer">LinkedIn</a>
        </div>
        <small>© 2026 Workonova. All rights reserved.</small>
      </footer>

      {/* ── AUTH MODAL ── */}
      <AuthModal
        isOpen={modal.isOpen}
        onClose={closeModal}
        initialMode={modal.mode}
      />
    </>
  );
}
