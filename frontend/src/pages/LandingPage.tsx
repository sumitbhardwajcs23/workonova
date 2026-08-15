import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function LandingPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [accountModalState, setAccountModalState] = useState<{ isOpen: boolean; mode: 'login' | 'signup' }>({ isOpen: false, mode: 'login' });

  return (
    <>
      <header>
        <a className="brand" href="#top">
          <img src="/assets/workonova-logo.webp" alt="Workonova" />
        </a>
        <nav>
          <a href="#services">Services</a>
          <a href="#process">How it works</a>
          <a href="#portfolio">Portfolio</a>
          <a href="#why">Why Workonova</a>
        </nav>
        <div className="head-actions">
          <button className="login account-open" onClick={() => setAccountModalState({ isOpen: true, mode: 'login' })}>Log in</button>
          <button className="pill account-open" onClick={() => setAccountModalState({ isOpen: true, mode: 'signup' })}>Sign up</button>
          <button className="hamburger" aria-label="Open menu" aria-expanded={isMobileMenuOpen} onClick={() => setIsMobileMenuOpen(true)}>☰</button>
        </div>
      </header>
      
      {isMobileMenuOpen && (
        <>
          <div className="menu-backdrop is-open" onClick={() => setIsMobileMenuOpen(false)}></div>
          <aside className="mobile-menu is-open" aria-label="Mobile navigation">
            <button className="menu-close" aria-label="Close menu" onClick={() => setIsMobileMenuOpen(false)}>×</button>
            <a className="brand" href="#top" onClick={() => setIsMobileMenuOpen(false)}>
              <img src="/assets/workonova-logo.webp" alt="Workonova" />
            </a>
            <nav>
              <a href="#services" onClick={() => setIsMobileMenuOpen(false)}>Services</a>
              <a href="#process" onClick={() => setIsMobileMenuOpen(false)}>How it works</a>
              <a href="#portfolio" onClick={() => setIsMobileMenuOpen(false)}>Portfolio</a>
              <a href="#why" onClick={() => setIsMobileMenuOpen(false)}>Why Workonova</a>
            </nav>
            <div className="mobile-account">
              <button className="login account-open" onClick={() => setAccountModalState({ isOpen: true, mode: 'login' })}>Log in</button>
              <button className="pill account-open" onClick={() => setAccountModalState({ isOpen: true, mode: 'signup' })}>Sign up</button>
            </div>
          </aside>
        </>
      )}

      <main id="top">
        {/* HERO SECTION */}
        <section className="hero">
          <video className="hero-video" autoPlay muted loop playsInline aria-hidden="true">
            <source src="/assets/workonova-hero.mp4" type="video/mp4" />
          </video>
          <div className="hero-shade"></div>
          <div className="hero-content">
            <p className="eyebrow light">Workonova — Talent Meets Opportunity, Powered by AI. ⭐⭐⭐</p>
            <h1>Scale your brand with premium, hassle-free creative & tech solutions.</h1>
            <h2>Vetted specialists, a dedicated QA team, and clear fixed-price packages. No freelancer chasing. No delivery surprises.</h2>
            <div className="cta-row">
              <a className="pill bright" href="#services">I’m a client <span>→</span></a>
              <button className="watch freelancer-cta account-open" onClick={() => setAccountModalState({ isOpen: true, mode: 'signup' })}><i>✦</i> I’m a freelancer</button>
            </div>
          </div>
          <div className="hero-stat">
            <strong>4.9/5</strong>
            <span>average client rating</span>
          </div>
        </section>

        {/* TRUST SECTION */}
        <section className="trust">
          <p>Trusted by fast-growing startups & brands</p>
          <div>
            <b>northstar</b>
            <b>BLUEROOM</b>
            <b>dashly</b>
            <b>pixel&amp;co</b>
            <b>HORIZON</b>
          </div>
        </section>

        {/* PROCESS SECTION */}
        <section className="section process" id="process">
          <div className="intro">
            <p className="eyebrow">HOW WE EXECUTE</p>
            <h2>Our 5-step streamlined process.</h2>
            <p>From initial concept to final delivery, experience seamless project execution with complete transparency.</p>
          </div>
          <div className="execution-grid">
            <article>
              <span>01</span>
              <div>
                <p className="step-label">STEP 01 OF 05</p>
                <h3>Discovery &amp; Requirement Mapping</h3>
                <p>We analyze your business goals, target audience, brand guidelines, and technical parameters to craft a tailored blueprint.</p>
              </div>
            </article>
            <article>
              <span>02</span>
              <div>
                <p className="step-label">STEP 02 OF 05</p>
                <h3>Creative Concepts &amp; Architecture</h3>
                <p>Our design and engineering leads create moodboards, storyboards, wireframes, or database schemas for your approval.</p>
              </div>
            </article>
            <article>
              <span>03</span>
              <div>
                <p className="step-label">STEP 03 OF 05</p>
                <h3>Execution &amp; High-Velocity Production</h3>
                <p>Our specialists edit video reels, render 3D scenes, write clean Next.js/React code, or build Gemini AI workflows.</p>
              </div>
            </article>
            <article>
              <span>04</span>
              <div>
                <p className="step-label">STEP 04 OF 05</p>
                <h3>Quality Assurance &amp; Revisions</h3>
                <p>Rigorous testing for visual perfection, mobile responsiveness, color grading accuracy, and API performance.</p>
              </div>
            </article>
            <article>
              <span>05</span>
              <div>
                <p className="step-label">STEP 05 OF 05</p>
                <h3>Final Delivery &amp; Scale Growth</h3>
                <p>Hassle-free deployment, source code and project asset handover, and continuous ad or software support.</p>
              </div>
            </article>
          </div>
        </section>

        {/* CLOSING SECTION */}
        <section className="closing">
          <div>
            <p className="eyebrow light">READY TO CREATE BETTER?</p>
            <h2>Bring your next big idea to life.</h2>
          </div>
          <a className="pill bright" href="#pricing">View pricing bundles <span>→</span></a>
        </section>
      </main>

      <footer>
        <div>
          <a className="brand footer-brand" href="#top">
            <img src="/assets/workonova-logo.webp" alt="Workonova" />
          </a>
          <p>Premium creative and tech solutions, delivered without the usual hassle.</p>
        </div>
        <div>
          <h4>Contact</h4>
          <a href="mailto:contact@workonova.com">contact@workonova.com</a>
        </div>
        <small>Copyright 2026 Workonova. All rights reserved.</small>
      </footer>
    </>
  );
}
