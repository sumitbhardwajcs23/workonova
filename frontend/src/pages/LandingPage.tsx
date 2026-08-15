import React, { useState, useEffect } from 'react';
import AuthModal from '../components/AuthModal';

/* ─── Data ─── */
const services = [
  { icon: '✦', title: 'Graphic Designing', desc: 'Creatives that build recognition', sub: 'Brand-ready visual design' },
  { icon: '▶', title: 'Video Editing', desc: 'Reels, ads, and showreels', sub: 'Stories made to perform' },
  { icon: '◇', title: '3D Design & Modeling', desc: 'Models and product renders', sub: 'Immersive digital visuals' },
  { icon: '✺', title: 'VFX', desc: 'Visual effects for impact', sub: 'Polished cinematic effects' },
  { icon: '↗', title: 'Animation', desc: 'Motion that holds attention', sub: 'Ideas brought to life' },
  { icon: '⌁', title: 'Digital Marketing', desc: 'Campaigns built for growth', sub: 'Reach the right audience' },
  { icon: '⌘', title: 'Website Development', desc: 'Fast, conversion-led websites', sub: 'Experiences made to scale' },
  { icon: '⌨', title: 'Software Development', desc: 'Custom systems and platforms', sub: 'Technology that works harder' },
  { icon: '▣', title: 'App Development', desc: 'Mobile apps for every idea', sub: 'Build for every screen' },
  { icon: '◉', title: 'AI Services', desc: 'Intelligent automation solutions', sub: 'Make work smarter' },
  { icon: '⚙', title: 'IT Services', desc: 'Reliable technology support', sub: 'Keep systems moving' },
  { icon: '◈', title: 'Cyber Security', desc: 'Protect your digital business', sub: 'Security you can trust' },
];

const steps = [
  { n: '01', title: 'Discovery & Requirement Mapping', desc: 'We analyze your business goals, target audience, brand guidelines, and technical parameters to craft a tailored blueprint.' },
  { n: '02', title: 'Creative Concepts & Architecture', desc: 'Our design and engineering leads create moodboards, storyboards, wireframes, or database schemas for your approval.' },
  { n: '03', title: 'Execution & High-Velocity Production', desc: 'Our specialists edit video reels, render 3D scenes, write clean Next.js/React code, or build Gemini AI workflows.' },
  { n: '04', title: 'Quality Assurance & Revisions', desc: 'Rigorous testing for visual perfection, mobile responsiveness, color grading accuracy, and API performance.' },
  { n: '05', title: 'Final Delivery & Scale Growth', desc: 'Hassle-free deployment, source code and project asset handover, and continuous ad or software support.' },
];

const packages = [
  {
    tag: 'STARTUPS & SOLO CREATORS',
    name: 'Starter Creative',
    desc: 'Ideal for early-stage startups and creators needing high-impact graphics and videos.',
    price: '₹14,999',
    period: '/ Monthly',
    features: ['15 Graphic Design Creatives / Month', '4 Edited Video Reels (up to 60s)', 'Basic On-Page SEO / Social Management', 'Turnaround Time: 48 Hours', 'Dedicated Slack / WhatsApp Communication'],
    popular: false,
  },
  {
    tag: 'GROWING BUSINESSES & E-COMMERCE',
    name: 'Growth Tech & Ads Suite',
    desc: 'Our most popular bundle for scaling brands looking for full website + ads + content.',
    price: '₹34,999',
    period: '/ Monthly',
    features: ['30 Graphic Design Creatives & Banners', '10 Viral Video Reels / Shorts', 'Full Meta & Google Ads Campaign Setup', '1 Custom High-Speed React / WP Landing Page', 'Monthly ROI Dashboard & Weekly Strategy Call', 'Priority 24 Hours Turnaround'],
    popular: true,
  },
  {
    tag: 'ENTERPRISES & HIGH-SCALE BRANDS',
    name: '3D, AI & Custom Tech Enterprise',
    desc: 'All-inclusive digital powerhouse for established brands needing custom software, 3D/VFX, and AI automation.',
    price: '₹79,999',
    period: '/ Monthly',
    features: ['Unlimited Graphic & Motion Graphics Requests', 'Full Stack Software / Mobile App / AI Bot Build', '3D Product Renders & VFX Ads Production', 'Omnichannel Digital Marketing & Lead Gen', 'Dedicated Creative Director + Lead Developer', '1-on-1 Direct Access to WORKONOVA Leadership'],
    popular: false,
  },
];

const portfolio = [
  { name: 'Orbit Finance', cat: 'SaaS Website Development', tall: true, featured: true, img: 'https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&w=1000&q=85' },
  { name: 'Reframe', cat: 'E-commerce Promo Video', img: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=800&q=85' },
  { name: 'Kinfolk', cat: 'Brand Identity & Packaging', img: 'https://images.unsplash.com/photo-1559028012-481c04fa702d?auto=format&fit=crop&w=800&q=85' },
  { name: 'Porter', cat: 'Product Design System', wide: true, img: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1100&q=85' },
];

const reasons = [
  { icon: '✓', title: 'Strict quality assurance', desc: 'Every deliverable is reviewed by in-house experts before it reaches you.' },
  { icon: '⌁', title: 'Zero freelancer hassle', desc: 'No bargaining or follow-ups. Your managed dashboard keeps every detail moving.' },
  { icon: '♢', title: 'Enterprise-grade security', desc: 'Your ideas and files are protected with strict NDAs and secure cloud encryption.' },
  { icon: '◷', title: 'Fixed deadlines', desc: 'Delivery you can plan around, backed by our transparent refund policy.' },
];

const testimonials = [
  { stars: '★★★★★', quote: '"The process was absurdly simple. We submitted a brief on Monday and had polished product visuals by Friday."', name: 'Ananya Shah', role: 'Growth Lead, Nova Labs' },
  { stars: '★★★★★', quote: '"It\'s the first time outsourcing has felt as reliable as working with an internal team. The QA is genuinely excellent."', name: 'Rohit Mehra', role: 'Founder, Metrik' },
  { stars: '★★★★★', quote: '"Clear packages, exceptional quality, zero back-and-forth. Workonova has become our creative unfair advantage."', name: 'Sarah Chen', role: 'Marketing Director, Relay' },
  { stars: '★★★★★', quote: '"The team understood our brand on day one. Every creative felt considered, on-brand, and ready to publish."', name: 'Vikram Kapoor', role: 'Co-founder, Fieldnote' },
  { stars: '★★★★★', quote: '"Their landing-page build was quick, technically clean, and noticeably improved our campaign conversions."', name: 'Meera Iyer', role: 'Marketing Manager, Loomly' },
  { stars: '★★★★★', quote: '"From video editing to ad creatives, they gave us a reliable extension of our own in-house team."', name: 'Arjun Nair', role: 'Director, Mercato' },
];

const faqs = [
  { q: 'How many revisions are included?', a: 'Every service package includes the stated revision rounds—typically two to three standard rounds, or unlimited revisions where explicitly specified. Revisions cover changes within the original approved brief; new features or major brief changes are quoted separately.' },
  { q: 'When are final files and source code delivered?', a: 'Final high-resolution assets, editable source files, and software source code are released after full payment is complete. On settlement, you receive commercial ownership and usage rights for the final approved deliverables.' },
  { q: 'Can I cancel a project or request a refund?', a: 'A written cancellation submitted within 12 hours of booking—before work begins or a specialist is assigned—qualifies for a full refund less payment-gateway fees. Once work has started, any eligible refund is calculated according to completed milestones.' },
  { q: 'How is my project information protected?', a: 'Client briefs, brand assets, proprietary code, and unreleased marketing materials are handled under strict non-disclosure obligations. We use secure storage, encryption, and restricted access protocols.' },
  { q: 'How can I request data deletion or a refund?', a: 'Email contact@workonova.com or WhatsApp +91 7983264117 with your Order ID, client name, and request. Approved refunds are credited to the original payment method within 5–7 business days.' },
];

/* ─── Component ─── */
export default function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [modal, setModal] = useState<{ open: boolean; mode: 'login' | 'signup' }>({ open: false, mode: 'login' });
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    const header = document.querySelector('header');
    if (!header) return;
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const openModal = (mode: 'login' | 'signup') => setModal({ open: true, mode });
  const closeModal = () => setModal(m => ({ ...m, open: false }));

  return (
    <>
      {/* ══ HEADER ══ */}
      <header>
        <a className="brand" href="#top"><img src="/assets/workonova-logo.webp" alt="Workonova" /></a>
        <nav>
          <a href="#services">Services</a>
          <a href="#process">How it works</a>
          <a href="#portfolio">Portfolio</a>
          <a href="#why">Why Workonova</a>
        </nav>
        <div className="head-actions">
          <button className="btn-ghost" onClick={() => openModal('login')}>Log in</button>
          <button className="btn-pill" onClick={() => openModal('signup')}>Sign up</button>
          <button className="hamburger" aria-label="Open menu" onClick={() => setMobileOpen(true)}>☰</button>
        </div>
      </header>

      {/* ══ MOBILE MENU ══ */}
      {mobileOpen && <div className="menu-backdrop is-open" onClick={() => setMobileOpen(false)} />}
      <aside className={`mobile-menu${mobileOpen ? ' is-open' : ''}`}>
        <button className="menu-close" onClick={() => setMobileOpen(false)}>×</button>
        <a className="brand" href="#top" onClick={() => setMobileOpen(false)}><img src="/assets/workonova-logo.webp" alt="Workonova" /></a>
        <nav>
          {['#services', '#process', '#portfolio', '#why'].map((href, i) => (
            <a key={href} href={href} onClick={() => setMobileOpen(false)}>
              {['Services', 'How it works', 'Portfolio', 'Why Workonova'][i]}
            </a>
          ))}
        </nav>
        <div className="mobile-account">
          <button className="btn-ghost" onClick={() => { openModal('login'); setMobileOpen(false); }}>Log in</button>
          <button className="btn-pill" onClick={() => { openModal('signup'); setMobileOpen(false); }}>Sign up</button>
        </div>
      </aside>

      <main id="top">
        {/* ══ HERO ══ */}
        <section className="lp-hero">
          <video className="lp-hero-video" autoPlay muted loop playsInline disablePictureInPicture aria-hidden="true">
            <source src="/assets/hero.mp4" type="video/mp4" />
          </video>
          <div className="lp-hero-shade" />
          <div className="lp-hero-content">
            <p className="lp-eyebrow lp-eyebrow-light">Workonova — Talent Meets Opportunity, Powered by AI. ⭐⭐⭐</p>
            <h1>Scale your brand with premium, hassle-free creative & tech solutions.</h1>
            <h2>Vetted specialists, a dedicated QA team, and clear fixed-price packages. No freelancer chasing. No delivery surprises.</h2>
            <div className="lp-cta-row">
              <a className="lp-pill lp-bright" href="#services">I'm a client <span>→</span></a>
              <button className="lp-watch" onClick={() => openModal('signup')}><i>✦</i> I'm a freelancer</button>
            </div>
          </div>
          <div className="lp-hero-stat">
            <strong>4.9/5</strong>
            <span>average client rating</span>
          </div>
        </section>

        {/* ══ TRUST ══ */}
        <section className="lp-trust">
          <p>Trusted by fast-growing startups & brands</p>
          <div>
            <b>northstar</b><b>BLUEROOM</b><b>dashly</b><b>pixel&co</b><b>HORIZON</b>
            <b>northstar</b><b>BLUEROOM</b><b>dashly</b><b>pixel&co</b><b>HORIZON</b>
          </div>
        </section>

        {/* ══ PROCESS ══ */}
        <section className="lp-section lp-process" id="process">
          <div className="lp-intro">
            <p className="lp-eyebrow">HOW WE EXECUTE</p>
            <h2>Our 5-step streamlined process.</h2>
            <p>From initial concept to final delivery, experience seamless project execution with complete transparency.</p>
          </div>
          <div className="lp-execution-grid">
            {steps.map(s => (
              <article key={s.n}>
                <span>{s.n}</span>
                <div>
                  <p className="lp-step-label">STEP {s.n} OF 05</p>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ══ SERVICES ══ */}
        <section className="lp-section lp-services" id="services">
          <div className="lp-split-head">
            <div>
              <p className="lp-eyebrow">OUR PREMIUM SERVICES</p>
              <h2>Everything your business needs to grow.</h2>
            </div>
            <p>Creative, technology, and security expertise from one reliable partner.</p>
          </div>
          <div className="lp-service-grid">
            {services.map(s => (
              <button className="lp-service" key={s.title}>
                <i>{s.icon}</i>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
                <strong>{s.sub}</strong>
                <span>Explore service →</span>
              </button>
            ))}
          </div>
        </section>

        {/* ══ PRICING ══ */}
        <section className="lp-section lp-packages" id="pricing">
          <div className="lp-package-intro">
            <p className="lp-eyebrow">TRANSPARENT INR PRICING</p>
            <h2>Flexible packages in Indian Rupees (₹).</h2>
            <p>No hidden costs. Choose a monthly retainer or order custom standalone deliverables.</p>
          </div>
          <div className="lp-package-grid">
            {packages.map(pkg => (
              <article key={pkg.name} className={pkg.popular ? 'lp-popular-package' : ''}>
                {pkg.popular && <span>Most Popular Choice</span>}
                <p className="lp-package-for">{pkg.tag}</p>
                <h3>{pkg.name}</h3>
                <p>{pkg.desc}</p>
                <strong>{pkg.price} <small>{pkg.period}</small></strong>
                <h4>What's Included:</h4>
                <ul>{pkg.features.map(f => <li key={f}>{f}</li>)}</ul>
                <button className={`lp-pill${pkg.popular ? ' lp-bright' : ''}`} onClick={() => openModal('signup')}>
                  Book {pkg.name}
                </button>
              </article>
            ))}
          </div>
        </section>

        {/* ══ PORTFOLIO ══ */}
        <section className="lp-portfolio" id="portfolio">
          <div className="lp-section lp-portfolio-heading">
            <p className="lp-eyebrow lp-eyebrow-light">THE WORK SPEAKS</p>
            <h2>Made to look like it belongs at the top.</h2>
            <p>Selected projects crafted by our specialist network and quality-checked by our in-house team.</p>
          </div>
          <div className="lp-project-grid">
            {portfolio.map(p => (
              <article
                key={p.name}
                className={`lp-project${p.tall ? ' lp-tall' : ''}${p.wide ? ' lp-wide' : ''}`}
                style={{ backgroundImage: `url('${p.img}')` }}
              >
                {p.featured && <span>Featured</span>}
                <div>
                  <h3>{p.name}</h3>
                  <p>{p.cat}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ══ WHY WORKONOVA ══ */}
        <section className="lp-section lp-reasons" id="why">
          <div className="lp-intro">
            <p className="lp-eyebrow">WHY WORKONOVA</p>
            <h2>The quality of an agency. The ease of a product.</h2>
          </div>
          <div className="lp-reason-grid">
            {reasons.map(r => (
              <article key={r.title}>
                <i>{r.icon}</i>
                <h3>{r.title}</h3>
                <p>{r.desc}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ══ TESTIMONIALS ══ */}
        <section className="lp-section lp-testimonials">
          <div className="lp-review-heading">
            <div>
              <p className="lp-eyebrow">CURATED CLIENT FEEDBACK</p>
              <h2>Good work feels easy.</h2>
            </div>
            <div className="lp-review-score">
              <strong>4.9</strong>
              <span>★★★★★</span>
              <small>Based on verified client reviews</small>
            </div>
          </div>
          <div className="lp-testimonial-grid">
            {[...testimonials, ...testimonials].map((t, i) => (
              <article key={i}>
                <div>{t.stars}</div>
                <blockquote>{t.quote}</blockquote>
                <p><b>{t.name}</b><br />{t.role}</p>
              </article>
            ))}
          </div>
          <p className="lp-review-foot"><span>●</span> Only approved reviews from completed Workonova projects are published.</p>
        </section>

        {/* ══ FAQ ══ */}
        <section className="lp-section lp-faq" id="faq">
          <div className="lp-intro">
            <p className="lp-eyebrow">FREQUENTLY ASKED QUESTIONS</p>
            <h2>Answers, without the fine print.</h2>
          </div>
          <div className="lp-faq-list">
            {faqs.map((f, i) => (
              <div key={i} className={`lp-faq-item${openFaq === i ? ' is-open' : ''}`}>
                <button className="lp-faq-summary" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  {f.q}
                  <b>{openFaq === i ? '×' : '+'}</b>
                </button>
                {openFaq === i && <p>{f.a}</p>}
              </div>
            ))}
          </div>
        </section>

        {/* ══ CLOSING CTA ══ */}
        <section className="lp-closing">
          <div>
            <p className="lp-eyebrow lp-eyebrow-light">READY TO CREATE BETTER?</p>
            <h2>Bring your next big idea to life.</h2>
          </div>
          <a className="lp-pill lp-bright" href="#pricing">View pricing bundles <span>→</span></a>
        </section>
      </main>

      {/* ══ FOOTER ══ */}
      <footer className="lp-footer">
        <div>
          <a className="brand lp-footer-brand" href="#top"><img src="/assets/workonova-logo.webp" alt="Workonova" /></a>
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
          <a href="/legal.html#privacy">Privacy Policy</a>
          <a href="/legal.html#terms">Terms & Conditions</a>
          <a href="/legal.html#disclaimer">Disclaimer</a>
          <a href="/legal.html#refund">Refund & Cancellation Policy</a>
        </div>
        <div>
          <h4>Our Services</h4>
          <a href="#services">Graphic Designing</a>
          <a href="#services">Video Editing</a>
          <a href="#services">3D Design & Modeling</a>
          <a href="#services">VFX & Motion Graphics</a>
          <a href="#services">Digital Marketing</a>
          <a href="#services">Website, Software, Mobile & AI</a>
        </div>
        <small>Copyright 2026 Workonova. All rights reserved.</small>
      </footer>

      <AuthModal isOpen={modal.open} onClose={closeModal} initialMode={modal.mode} />
    </>
  );
}
