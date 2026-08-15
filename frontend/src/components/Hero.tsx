import React from 'react';

export default function Hero({ onOpenSignup }: { onOpenSignup: () => void }) {
  return (
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
          <button className="watch freelancer-cta account-open" onClick={onOpenSignup}><i>✦</i> I’m a freelancer</button>
        </div>
      </div>
      <div className="hero-stat">
        <strong>4.9/5</strong>
        <span>average client rating</span>
      </div>
    </section>
  );
}
