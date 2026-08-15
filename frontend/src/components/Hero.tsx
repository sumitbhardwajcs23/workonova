import React, { useEffect, useRef } from 'react';

interface HeroProps {
  onOpenSignup: () => void;
}

export default function Hero({ onOpenSignup }: HeroProps) {
  const headerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Scroll effect for header
    const header = document.querySelector('header');
    headerRef.current = header as HTMLElement;

    const handleScroll = () => {
      if (header) {
        header.classList.toggle('scrolled', window.scrollY > 30);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <section className="hero" id="top">
      <video
        className="hero-video"
        autoPlay muted loop playsInline
        aria-hidden="true"
      >
        <source src="/assets/workonova-hero.mp4" type="video/mp4" />
      </video>
      
      {/* Decorative orbs */}
      <div className="hero-orb hero-orb-1" aria-hidden="true" />
      <div className="hero-orb hero-orb-2" aria-hidden="true" />
      
      {/* Grid overlay */}
      <div className="hero-grid" aria-hidden="true" />
      
      {/* Gradient overlay */}
      <div className="hero-gradient" aria-hidden="true" />

      <div className="hero-content">
        <p className="eyebrow">
          Workonova · Talent Meets Opportunity
        </p>
        <h1>
          Scale your brand with{' '}
          <span>premium creative</span>{' '}
          & tech solutions.
        </h1>
        <h2>
          Vetted specialists, a dedicated QA team, and clear fixed-price packages. 
          No freelancer chasing. No delivery surprises.
        </h2>
        <div className="cta-row">
          <a className="cta-primary" href="#services">
            I'm a client
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
          <button className="cta-secondary" onClick={onOpenSignup}>
            <span className="cta-icon">✦</span>
            I'm a freelancer
          </button>
        </div>
      </div>

      <div className="hero-badge" role="complementary" aria-label="Client rating">
        <strong>4.9/5</strong>
        <span>average client rating</span>
      </div>
    </section>
  );
}
