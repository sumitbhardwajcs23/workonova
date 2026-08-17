import { useState, useEffect } from 'react';
import AuthModal from '../components/AuthModal';
import { API_BASE } from '../config.js';

/* ─── Sub-services for hover panel ─── */
const subServices: Record<string, string[]> = {
  'Graphic Designing': ['Logo Design','Brand Identity Design','Business Card Design','Letterhead Design','Flyer Design','Brochure Design','Poster Design','Banner Design','Social Media Post Design','Instagram Carousel Design','YouTube Thumbnail Design','Facebook Cover Design','LinkedIn Banner Design','Product Packaging Design','Label Design','Menu Card Design','Invitation Card Design','Certificate Design','Ebook Design','Magazine Design','Catalog Design','Infographic Design','Presentation (PPT) Design','Corporate Profile Design','UI Graphics Design','Print Design','Merchandise Design'],
  'Video Editing': ['YouTube Video Editing','Reels Editing','Shorts Editing','Podcast Editing','Corporate Video Editing','Commercial Ad Editing','Social Media Video Editing','Event Video Editing','Wedding Video Editing','Educational Video Editing','Green Screen Editing','Color Correction','Color Grading','Motion Graphics Integration','Subtitle Creation','Multi-Camera Editing','Audio Syncing','Background Music Integration','Video Compression','4K Video Editing'],
  '3D Design & Modeling': ['3D Modeling','Product Modeling','Character Modeling','Architectural Modeling','Interior Design Rendering','Exterior Rendering','3D Product Visualization','3D Animation','Industrial Design','Game Assets Creation','AR/VR Models','Furniture Modeling','3D Text Design','Environment Design','CAD Modeling'],
  'VFX': ['Green Screen Removal','CGI Effects','Object Removal','Motion Tracking','Rotoscoping','Matte Painting','Compositing','Fire Effects','Smoke Effects','Explosion Effects','Weather Effects','Screen Replacement','Visual Cleanup','3D Tracking','Particle Effects'],
  'Animation': ['2D Animation','3D Animation','Motion Graphics','Whiteboard Animation','Explainer Videos','Character Animation','Logo Animation','Product Animation','Infographic Animation','GIF Animation','Intro/Outro Animation','Educational Animation','Kids Animation','Corporate Animation'],
  'Digital Marketing': ['Search Engine Optimization (SEO)','Local SEO','Technical SEO','E-commerce SEO','Google Ads Management','Facebook Ads','Instagram Ads','YouTube Ads','LinkedIn Ads','Social Media Marketing','Social Media Management','Content Marketing','Email Marketing','WhatsApp Marketing','Influencer Marketing','Affiliate Marketing','Lead Generation','Marketing Automation','Conversion Optimization','Online Reputation Management'],
  'Website Development': ['WordPress Development','Business Website','E-commerce Website','Portfolio Website','Landing Page Design','Custom Website Development','Blog Website','Educational Website','LMS Development','Membership Website','Real Estate Website','News Portal','Job Portal','Booking Website','Website Redesign','Website Maintenance','Speed Optimization','Website Security','Website Migration','UI/UX Design'],
  'Software Development': ['ERP Software Development','CRM Development','HRMS Development','Inventory Management Software','Billing Software','School Management Software','Hospital Management Software','Accounting Software','Custom Software Development','SaaS Development','Desktop Application Development','POS Software','Automation Software','API Development','API Integration'],
  'App Development': ['Android App Development','iOS App Development','Cross-Platform Apps','Hybrid Apps','E-commerce Apps','Educational Apps','Booking Apps','Food Delivery Apps','Business Apps','Healthcare Apps','Fintech Apps','OTT Apps','Chat Applications','CRM Apps','App Maintenance','App UI/UX Design','Play Store Publishing'],
  'AI Services': ['AI Chatbot Development','AI Voice Bot','AI Automation','AI Content Generation','AI Image Generation','AI Video Generation','AI Website Builder','AI Workflow Automation','AI Customer Support','AI Data Analysis','AI Recommendation Systems','AI Marketing Tools','AI Agent Development','Custom AI Solutions','Generative AI Solutions'],
  'IT Services': ['IT Consulting','IT Support','Managed IT Services','Cloud Services','Server Management','Network Setup','Hardware Support','Software Installation','Remote IT Support','IT Infrastructure Setup','Data Backup Solutions','Disaster Recovery','Microsoft 365 Setup','Google Workspace Setup','Email Setup','Domain & Hosting Management'],
  'Cyber Security': ['Security Audit','Vulnerability Assessment','Penetration Testing (VAPT)','Website Security','Malware Removal','Firewall Setup','Network Security','Cloud Security','Email Security','Endpoint Security','Data Protection','Cyber Security Consulting','Security Monitoring','Incident Response','Security Awareness Training','SSL Setup','Backup & Recovery','Security Compliance Support'],
};

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
  { tag: 'STARTUPS & SOLO CREATORS', name: 'Starter Creative', desc: 'Ideal for early-stage startups and creators needing high-impact graphics and videos.', price: '₹14,999', period: '/ Monthly', features: ['15 Graphic Design Creatives / Month', '4 Edited Video Reels (up to 60s)', 'Basic On-Page SEO / Social Management', 'Turnaround Time: 48 Hours', 'Dedicated Slack / WhatsApp Communication'], popular: false },
  { tag: 'GROWING BUSINESSES & E-COMMERCE', name: 'Growth Tech & Ads Suite', desc: 'Our most popular bundle for scaling brands looking for full website + ads + content.', price: '₹34,999', period: '/ Monthly', features: ['30 Graphic Design Creatives & Banners', '10 Viral Video Reels / Shorts', 'Full Meta & Google Ads Campaign Setup', '1 Custom High-Speed React / WP Landing Page', 'Monthly ROI Dashboard & Weekly Strategy Call', 'Priority 24 Hours Turnaround'], popular: true },
  { tag: 'ENTERPRISES & HIGH-SCALE BRANDS', name: '3D, AI & Custom Tech Enterprise', desc: 'All-inclusive digital powerhouse for established brands needing custom software, 3D/VFX, and AI automation.', price: '₹79,999', period: '/ Monthly', features: ['Unlimited Graphic & Motion Graphics Requests', 'Full Stack Software / Mobile App / AI Bot Build', '3D Product Renders & VFX Ads Production', 'Omnichannel Digital Marketing & Lead Gen', 'Dedicated Creative Director + Lead Developer', '1-on-1 Direct Access to WORKONOVA Leadership'], popular: false },
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

const trustBrands = ['northstar', 'BLUEROOM', 'dashly', 'pixel&co', 'HORIZON', 'Streamline', 'Brandify', 'northstar', 'BLUEROOM', 'dashly', 'pixel&co', 'HORIZON', 'Streamline', 'Brandify'];

const defaultBlogs = [
  {
    title: 'The Future of Blind Workspaces: Why Anonymity Elevates Creative Projects',
    publishedAt: 'August 12, 2026',
    author: 'Workonova Editorial',
    content: `In creative fields, cognitive bias can silently sink projects. When freelancers know they are working for a Fortune 500 company versus a small startup, their designs shift. Workonova's blind-collaboration space protects identity on both ends, allowing creators to focus entirely on brief compliance and pure execution quality.`
  },
  {
    title: 'AI-Assisted Workflows: Optimizing Software Handoffs',
    publishedAt: 'July 28, 2026',
    author: 'Tech & Automation Team',
    content: `Integrating artificial intelligence into software development pipelines isn't about replacing engineers; it is about eliminating manual feedback loops. By automating branch creation, seeding test environments, and validation triggers, we reduce delivery times by 40% and secure robust production builds.`
  },
  {
    title: 'Scaling Corporate Post-Production: High-Speed Video Editing Rules',
    publishedAt: 'June 15, 2026',
    author: 'Creative Guild',
    content: `Post-production demands coordination. Our creative leads share three non-negotiable rules for scaling video assets: keeping strict brand asset folders, providing timestamped reference files during intake, and structuring multi-channel ratios early in the editing phase.`
  }
];

const defaultTeam = [
  {
    name: 'Dharmendra Sharma',
    role: 'Founder / CEO / MD',
    subtitle: 'Strategic Leadership & Agency Vision',
    description: 'Founder, CEO, and Managing Director driving WORKONOVA with a vision to build high-impact creative technology and performance marketing solutions.',
    bio: 'Dharmendra Sharma is the visionary Founder and CEO of WORKONOVA. With over a decade of leadership in software design and digital agency consulting, Dharmendra has pioneered the anonymized workspace concept to eliminate cognitive bias and bring pure project delivery quality to the forefront of creative operations. Under his leadership, WORKONOVA has scaled from a boutique design lab into a high-performance ecosystem serving startups and enterprises globally.',
    uniqueFact: 'Maintains a personal daily focus of reviewing the active QC queue to guarantee every custom client deliverable meets aesthetic thresholds.',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Sanjay Yadav',
    role: 'Co-Founder / HR',
    subtitle: 'People Strategy & Operations',
    description: 'Co-Founder & HR Director managing company culture, talent acquisition, operational efficiency, and client excellence.',
    bio: 'Sanjay Yadav is the Co-Founder and HR Director at WORKONOVA, managing organizational growth, talent retention, and operations compliance. Sanjay specializes in vetting the top 3% of creative and technical talent across India, ensuring every developer, VFX editor, and animator on the platform matches enterprise-grade expertise. He focuses on fostering a culture of ownership and client-centered excellence.',
    uniqueFact: 'Has personally vetted and interviewed over 1,200 professional creators to build our agile talent roster.',
    image: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Harshit Bhatt',
    role: 'Digital Marketing, SEO & SMM Expert',
    subtitle: 'Meta Ads, SEO & Social Media Growth',
    description: 'Performance marketing specialist driving high-ROAS Meta Ads campaigns, search engine ranking (SEO), and social media growth funnels.',
    bio: 'Harshit Bhatt leads the Digital Marketing and Growth department at WORKONOVA. A performance marketing specialist with high-velocity campaign experience, Harshit designs paid advertising setups (Meta & Google Ads) and search engine optimization maps that drive high ROAS for e-commerce, SaaS, and retail brands. He specializes in mapping conversion-led funnels and organic search ranking growth.',
    uniqueFact: 'Averaged a verified 4.2x ROAS across high-scale advertising campaigns in the last fiscal quarter.',
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Prachi',
    role: 'Creative & Graphic Design Lead',
    subtitle: 'UI/UX & Brand Identity Design',
    description: 'Leading creative graphics, brand visual identity, and aesthetic UI/UX experiences across web and mobile platforms.',
    bio: 'Prachi is the Creative and Graphic Design Lead at WORKONOVA. Possessing a deep background in fine arts and digital UI/UX design, Prachi leads the branding, design system curation, and visual direction of all premium creative assets. She collaborates closely with development teams to ensure high-fidelity layouts transition smoothly into production applications.',
    uniqueFact: 'Has designed and consulted on brand identity packages for over 80 startups worldwide.',
    image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80'
  }
];

/* ─── Service Card ─── */
function ServiceCard({ svc, onClick }: { svc: typeof services[0]; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="lp-service-wrap"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button className={`lp-service${hovered ? ' is-hovered' : ''}`} onClick={onClick}>
        <i>{svc.icon}</i>
        <h3>{svc.title}</h3>
        <p>{svc.desc}</p>
        <strong>{svc.sub}</strong>
        <span>Explore service →</span>
      </button>
    </div>
  );
}

/* ─── Main Page ─── */
export default function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [modal, setModal] = useState<{ open: boolean; mode: 'login' | 'signup' }>({ open: false, mode: 'login' });
  const [initialRole, setInitialRole] = useState<'client' | 'freelancer' | 'admin'>('client');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [liveReviews, setLiveReviews] = useState<any[]>([]);
  const [liveBlogs, setLiveBlogs] = useState<any[]>([]);
  const [liveBundles, setLiveBundles] = useState<any[]>([]);
  const [liveTeam, setLiveTeam] = useState<any[]>([]);
  const [selectedTeamMember, setSelectedTeamMember] = useState<any | null>(null);

  // State for Service and Policy Modals
  const [selectedService, setSelectedService] = useState<{ title: string; list: string[] } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const modalParam = params.get('modal');
    const roleParam = params.get('role');
    if (modalParam === 'login') {
      if (roleParam === 'admin' || roleParam === 'client' || roleParam === 'freelancer') {
        setInitialRole(roleParam as any);
      }
      openModal('login');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    // 1. Fetch Testimonials
    fetch(`${API_BASE}/api/public/testimonials`)
      .then(res => res.json())
      .then(data => {
        if (data.data && data.data.length > 0) {
          const formatted = data.data.map((item: any) => ({
            stars: '★'.repeat(item.stars || 5),
            quote: `"${item.quote}"`,
            name: item.name,
            role: item.role || 'Verified Client',
          }));
          setLiveReviews(formatted);
        }
      })
      .catch(err => console.error('Public testimonials fetch error:', err));

    // 2. Fetch Blogs
    fetch(`${API_BASE}/api/public/blogs`)
      .then(res => res.json())
      .then(data => {
        if (data.data && data.data.length > 0) {
          setLiveBlogs(data.data);
        }
      })
      .catch(err => console.error('Public blogs fetch error:', err));

    // 3. Fetch Bundles
    fetch(`${API_BASE}/api/public/bundles`)
      .then(res => res.json())
      .then(data => {
        if (data.data && data.data.length > 0) {
          setLiveBundles(data.data);
        }
      })
      .catch(err => console.error('Public bundles fetch error:', err));

    // 4. Fetch Team
    fetch(`${API_BASE}/api/public/team`)
      .then(res => res.json())
      .then(data => {
        if (data.data && data.data.length > 0) {
          setLiveTeam(data.data);
        }
      })
      .catch(err => console.error('Public team fetch error:', err));
  }, []);

  const [selectedPolicy, setSelectedPolicy] = useState<{ title: string; html: React.ReactNode } | null>(null);
  const [selectedAboutModal, setSelectedAboutModal] = useState(false);
  const [selectedBlogModal, setSelectedBlogModal] = useState(false);

  const openModal = (mode: 'login' | 'signup', role: 'client' | 'freelancer' | 'admin' = 'client') => {
    setInitialRole(role);
    setModal({ open: true, mode });
  };
  const closeModal = () => setModal(m => ({ ...m, open: false }));

  useEffect(() => {
    const header = document.querySelector('header');
    if (!header) return;
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
          <button onClick={() => setSelectedAboutModal(true)}>About Us</button>
          <button onClick={() => setSelectedBlogModal(true)}>Blog</button>
          <button onClick={() => openModal('login', 'admin')} style={{ color: '#818cf8', fontWeight: 600 }}>Admin Portal 🛡️</button>
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
        <a className="brand" href="#top" onClick={() => setMobileOpen(false)}>
          <img src="/assets/workonova-logo.webp" alt="Workonova" />
        </a>
        <nav>
          {[['#services','Services'],['#process','How it works'],['#portfolio','Portfolio'],['#why','Why Workonova']].map(([href, label]) => (
            <a key={href} href={href} onClick={() => setMobileOpen(false)}>{label}</a>
          ))}
          <button onClick={() => { setSelectedAboutModal(true); setMobileOpen(false); }}>About Us</button>
          <button onClick={() => { setSelectedBlogModal(true); setMobileOpen(false); }}>Blog</button>
          <button onClick={() => { openModal('login', 'admin'); setMobileOpen(false); }} style={{ color: '#818cf8', fontWeight: 600 }}>Admin Portal 🛡️</button>
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
              <button className="lp-watch" onClick={() => openModal('signup')}>
                <i>✦</i> I'm a freelancer
              </button>
            </div>
          </div>
          <div className="lp-hero-stat">
            <strong>4.9/5</strong>
            <span>average client rating</span>
          </div>
        </section>

        {/* ══ TRUST — horizontal marquee ══ */}
        <section className="lp-trust">
          <p className="lp-trust-label">Trusted by fast-growing startups & brands</p>
          <div className="lp-trust-track-wrap">
            <div className="lp-trust-track">
              {trustBrands.map((b, i) => <b key={i}>{b}</b>)}
            </div>
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
            <p>Creative, technology, and security expertise from one reliable partner. Hover a service to explore.</p>
          </div>
          <div className="lp-service-grid">
            {services.map(svc => (
              <ServiceCard 
                key={svc.title} 
                svc={svc} 
                onClick={() => setSelectedService({ title: svc.title, list: subServices[svc.title] || [] })} 
              />
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
            {(liveBundles.length > 0 ? liveBundles : packages).map(pkg => (
              <article key={pkg.name} className={pkg.popular ? 'lp-popular-package' : ''}>
                {pkg.popular && <span>Most Popular Choice</span>}
                <p className="lp-package-for">{pkg.tag}</p>
                <h3>{pkg.name}</h3>
                <p>{pkg.description || pkg.desc}</p>
                <strong>{pkg.price.startsWith('₹') ? pkg.price : `₹${pkg.price}`} <small>{pkg.period}</small></strong>
                <h4>What's Included:</h4>
                <ul>
                  {Array.isArray(pkg.features) 
                    ? pkg.features.map((f: string) => <li key={f}>{f}</li>)
                    : typeof pkg.features === 'string'
                      ? JSON.parse(pkg.features).map((f: string) => <li key={f}>{f}</li>)
                      : null
                  }
                </ul>
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
              <article key={p.name}
                className={`lp-project${p.tall ? ' lp-tall' : ''}${p.wide ? ' lp-wide' : ''}`}
                style={{ backgroundImage: `url('${p.img}')` }}>
                {p.featured && <span>Featured</span>}
                <div><h3>{p.name}</h3><p>{p.cat}</p></div>
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

        {/* ══ LEADERSHIP TEAM ══ */}
        <section className="lp-section lp-team" id="team">
          <div className="lp-intro" style={{ textAlign: 'center', maxWidth: 800, margin: '0 auto 40px auto' }}>
            <span style={{ background: '#e8f7e1', color: '#2e7d17', fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.5 }}>⚡ Leadership & Minds</span>
            <h2 style={{ fontSize: 36, fontFamily: "'Fraunces', Georgia, serif", color: '#172414', margin: '16px 0 12px 0' }}>Meet the Minds Behind WORKONOVA</h2>
            <p style={{ color: '#586455', fontSize: 15 }}>A passionate team of creative visionaries, senior software architects, and growth marketers.</p>
          </div>
          <div className="lp-team-grid">
            {(liveTeam.length > 0 ? liveTeam : defaultTeam).map(m => (
              <article key={m.name} className="lp-team-card" onClick={() => setSelectedTeamMember(m)}>
                <div className="lp-team-img-wrapper">
                  <img src={m.image} alt={m.name} className="lp-team-img" />
                </div>
                <span className="lp-team-label-role">{m.role}</span>
                <h3>{m.name}</h3>
                <h4>{m.subtitle}</h4>
                <p>{m.description}</p>
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
            {(liveReviews.length > 0 ? [...liveReviews, ...testimonials] : [...testimonials, ...testimonials]).map((t, i) => (
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
                  {f.q}<b>{openFaq === i ? '×' : '+'}</b>
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
          <button className="lp-footer-link" onClick={() => setSelectedPolicy(POLICIES.privacy)}>Privacy Policy</button>
          <button className="lp-footer-link" onClick={() => setSelectedPolicy(POLICIES.terms)}>Terms & Conditions</button>
          <button className="lp-footer-link" onClick={() => setSelectedPolicy(POLICIES.disclaimer)}>Disclaimer</button>
          <button className="lp-footer-link" onClick={() => setSelectedPolicy(POLICIES.refund)}>Refund & Cancellation Policy</button>
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

      <AuthModal isOpen={modal.open} onClose={closeModal} initialMode={modal.mode} initialRole={initialRole} />

      {/* ══ ABOUT US POPUP MODAL ══ */}
      {selectedAboutModal && (
        <div className="lp-modal-backdrop" onClick={() => setSelectedAboutModal(false)}>
          <div className="lp-modal-window" onClick={e => e.stopPropagation()}>
            <div className="lp-modal-header">
              <h3>About Workonova</h3>
              <button className="lp-modal-close" onClick={() => setSelectedAboutModal(false)}>×</button>
            </div>
            <div className="lp-modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
              <div className="lp-policy-content">
                <h2>Who We Are</h2>
                <p><strong>Workonova</strong> is a premium, next-generation digital agency and talent workspace matching top-tier design, software, and marketing experts with fast-growing brands. We solve the administrative overhead, delays, and poor communication issues of typical freelance marketplaces by introducing AI-orchestrated task pipelines and structured QA guardrails.</p>
                
                <h3>Our Vision & Philosophy</h3>
                <p>We believe that <i>good work feels easy</i>. By keeping client-freelancer coordination strictly secure and objective through an anonymized portal, we ensure that project decisions are driven by work quality rather than cognitive bias. Our managers oversee assignments, coordinate feedback rounds, and enforce quality checks before delivering files.</p>
                
                <h3>Everything We Do</h3>
                <ul>
                  <li><b>Premium Creative Output</b>: High-impact logo branding, complete corporate identity suites, social creatives, and customized pitch decks.</li>
                  <li><b>Cinematic Post-Production</b>: Professional video editing, 3D product animations, visual effects (VFX), and dynamic motion graphics.</li>
                  <li><b>Engineering & Automation</b>: Custom web application development, mobile apps, specialized software platforms, and generative AI agent setups.</li>
                  <li><b>Growth Marketing</b>: Meta/Google ad campaign management, SEO optimization, and data-driven client acquisition models.</li>
                </ul>

                <h3>Core Value Pillars</h3>
                <p><b>1. Strict Confidentiality:</b> Client identity is protected behind blind interfaces to eliminate talent bias and ensure privacy.</p>
                <p><b>2. Direct QA Oversight:</b> Projects pass through an internal review panel. Freelancers submit to QA admins first, ensuring only polished, brief-compliant builds reach your hands.</p>
                <p><b>3. Predictable Timelines:</b> No ghosting, no excuses. If a designer is stuck, our backup pool is automatically assigned to keep your project on track.</p>
                
                <h3>Get in Touch</h3>
                <p>Have questions or ready to launch? Speak directly with our core agency team:</p>
                <p><b>WhatsApp:</b> +91 7983264117 <br /><b>Phone:</b> +91 8077 717 422<br /><b>Email:</b> contact@workonova.com</p>
              </div>
            </div>
            <div className="lp-modal-footer">
              <button className="lp-modal-btn" onClick={() => { setSelectedAboutModal(false); openModal('signup'); }}>
                Start a project →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ BLOG POPUP MODAL ══ */}
      {selectedBlogModal && (
        <div className="lp-modal-backdrop" onClick={() => setSelectedBlogModal(false)}>
          <div className="lp-modal-window" onClick={e => e.stopPropagation()}>
            <div className="lp-modal-header">
              <h3>Workonova Insights (Blog)</h3>
              <button className="lp-modal-close" onClick={() => setSelectedBlogModal(false)}>×</button>
            </div>
            <div className="lp-modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
              <div className="lp-policy-content">
                {(liveBlogs.length > 0 ? liveBlogs : defaultBlogs).map((b, idx) => (
                  <article key={b.id || idx} style={{ borderBottom: '1px solid #e8ede6', paddingBottom: '20px', marginBottom: '20px' }}>
                    <h2 style={{ fontSize: '18px', margin: '0 0 8px' }}>{b.title}</h2>
                    <small style={{ color: '#72806e', fontSize: '12px', display: 'block', marginBottom: '10px' }}>
                      {b.publishedAt || b.published_at} • By {b.author}
                    </small>
                    <p style={{ whiteSpace: 'pre-wrap', color: '#1a1a1a', fontSize: '13px', lineHeight: '1.6' }}>{b.content}</p>
                  </article>
                ))}
              </div>
            </div>
            <div className="lp-modal-footer">
              <button className="btn-primary" onClick={() => setSelectedBlogModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ SERVICE POPUP MODAL (Matching Screenshot) ══ */}
      {selectedService && (
        <div className="lp-modal-backdrop" onClick={() => setSelectedService(null)}>
          <div className="lp-modal-window" onClick={e => e.stopPropagation()}>
            <div className="lp-modal-header">
              <h3>{selectedService.title} Services</h3>
              <button className="lp-modal-close" onClick={() => setSelectedService(null)}>×</button>
            </div>
            <div className="lp-modal-body">
              <div className="lp-service-columns">
                {selectedService.list.map(item => (
                  <div key={item} className="lp-service-item">
                    <span>✓</span> {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="lp-modal-footer">
              <button className="lp-modal-btn" onClick={() => { setSelectedService(null); openModal('signup'); }}>
                Start a project →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ LEGAL POLICIES POPUP MODAL ══ */}
      {selectedPolicy && (
        <div className="lp-modal-backdrop" onClick={() => setSelectedPolicy(null)}>
          <div className="lp-modal-window" onClick={e => e.stopPropagation()}>
            <div className="lp-modal-header">
              <h3>{selectedPolicy.title}</h3>
              <button className="lp-modal-close" onClick={() => setSelectedPolicy(null)}>×</button>
            </div>
            <div className="lp-modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {selectedPolicy.html}
            </div>
            <div className="lp-modal-footer">
              <button className="btn-primary" onClick={() => setSelectedPolicy(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ TEAM MEMBER DETAIL POPUP MODAL (Aesthetic Biography Modal) ══ */}
      {selectedTeamMember && (
        <div className="lp-modal-backdrop" onClick={() => setSelectedTeamMember(null)}>
          <div className="lp-modal-window" onClick={e => e.stopPropagation()}>
            <div className="lp-modal-header">
              <h3>Team Leadership Profile</h3>
              <button className="lp-modal-close" onClick={() => setSelectedTeamMember(null)}>×</button>
            </div>
            <div className="lp-modal-body">
              <div className="lp-team-modal-layout">
                <img src={selectedTeamMember.image} alt={selectedTeamMember.name} className="lp-team-modal-photo" />
                <div className="lp-team-modal-info">
                  <h2>{selectedTeamMember.name}</h2>
                  <h3>{selectedTeamMember.role}</h3>
                  <p style={{ color: '#586455', fontSize: '13px', fontWeight: 600, marginTop: '-10px', marginBottom: '16px' }}>{selectedTeamMember.subtitle}</p>
                  <div className="lp-team-modal-bio">{selectedTeamMember.bio}</div>
                  {selectedTeamMember.uniqueFact && (
                    <div className="lp-team-modal-fact">
                      <strong>Core Focus & Philosophy:</strong> {selectedTeamMember.uniqueFact}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="lp-modal-footer">
              <button className="btn-primary" onClick={() => setSelectedTeamMember(null)}>Close Profile</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Legal Policies Content Definitions ───
const POLICIES = {
  privacy: {
    title: 'Privacy Policy',
    html: (
      <div className="lp-policy-content">
        <h2>Privacy Policy — WORKONOVA</h2>
        <p>At WORKONOVA (operating as workonova.com), we are committed to protecting the privacy and confidentiality of our clients, freelancers, visitors, and business partners. This policy explains how we collect, process, store, and safeguard personal information when you use our website, book services, or collaborate as a partner.</p>
        <h3>1. Information We Collect</h3>
        <p>We collect information you directly provide when placing project orders, filling out forms, registering as a freelancer, or subscribing to updates.</p>
        <ul>
          <li><b>Personal identification:</b> full name, email address, phone number, WhatsApp contact, and company name.</li>
          <li><b>Project & order specifications:</b> briefs, design/video preferences, uploaded brand assets, and customised specifications.</li>
          <li><b>Payment & billing data:</b> billing address, transaction history, and payment status.</li>
          <li><b>Freelancer partner data:</b> portfolio links, skill set, experience level, rates, and resume details.</li>
          <li><b>Technical data:</b> IP address, device type, browser details, and cookie data.</li>
        </ul>
        <h3>2. How We Use Your Information</h3>
        <ul>
          <li>Deliver creative, software/web development, and AI automation projects.</li>
          <li>Communicate milestones, revisions, and confirmations by email or WhatsApp.</li>
          <li>Match qualified freelancer partners with client briefs.</li>
          <li>Generate project estimates, tax invoices, and receipts.</li>
          <li>Improve website experience, security, and customer support.</li>
        </ul>
        <h3>3. Data Protection & Confidentiality</h3>
        <ul>
          <li><b>Non-disclosure:</b> creative assets, proprietary code, unreleased marketing material, and briefs are held under strict non-disclosure obligations.</li>
          <li><b>Security:</b> we use industry-standard encryption, secure storage, and restricted access protocols.</li>
        </ul>
        <h3>4. Cookies & Web Analytics</h3>
        <p>WORKONOVA uses essential cookies and performance analytics to understand behaviour, remember preferences, and optimise site speed.</p>
        <h3>5. Your Data Protection Rights</h3>
        <p>You may request access, correction, or deletion of your stored data. Contact contact@workonova.com or WhatsApp +91 7983264117.</p>
      </div>
    )
  },
  terms: {
    title: 'Terms & Conditions',
    html: (
      <div className="lp-policy-content">
        <h2>Terms & Conditions — WORKONOVA</h2>
        <p>By accessing workonova.com, booking creative or software services, hiring freelancers through our network, or interacting with our team, you agree to these Terms & Conditions.</p>
        <h3>1. Scope of Services</h3>
        <p>WORKONOVA provides Graphic Design, Video Editing, 3D Design & Modeling, VFX, Motion Graphics, Digital Marketing, Website Development, Software Development, Mobile App Development, and AI Services & Automation. Individual scope, deliverables, and timelines are defined in invoices or service bookings.</p>
        <h3>2. Client Responsibilities & Briefing</h3>
        <ul>
          <li>Clients must provide complete specifications, copy, high-resolution logos, and required media before project initiation.</li>
          <li>Timely review and feedback are required; client delays may adjust estimated delivery dates.</li>
        </ul>
        <h3>3. Payment Terms & Billing</h3>
        <ul>
          <li>Projects require the advance deposit or full payment stated in the package or custom estimate.</li>
          <li>Invoices are issued on confirmation. Source files and software code are released after 100% payment completion.</li>
        </ul>
        <h3>4. Revisions & Scope Amendments</h3>
        <p>Packages include the stated revision rounds. Revisions cover work within the original brief; fundamental brief changes or new features are additional scope.</p>
        <h3>5. Intellectual Property Rights</h3>
        <ul>
          <li>Upon full payment, clients receive commercial ownership and usage rights of final approved deliverables.</li>
        </ul>
        <h3>6. Limitation of Liability</h3>
        <p>WORKONOVA is not liable for indirect or consequential damages, loss of profits, business interruption, third-party API outages, or improper use after handoff.</p>
        <h3>7. Governing Law & Jurisdiction</h3>
        <p>These terms are governed by Indian law. Disputes are subject to the exclusive jurisdiction of courts in Delhi/Uttarakhand, India.</p>
      </div>
    )
  },
  disclaimer: {
    title: 'Disclaimer',
    html: (
      <div className="lp-policy-content">
        <h2>Disclaimer — WORKONOVA</h2>
        <p>Information on WORKONOVA (workonova.com) is provided for general informational and commercial purposes regarding our digital agency services, creative portfolio, pricing estimates, and team capabilities.</p>
        <h3>1. Professional Service & Performance Disclaimer</h3>
        <ul>
          <li><b>Creative & marketing results:</b> performance metrics such as views, conversions, sales, and ROI depend on market variables, algorithm changes, and audience behaviour outside our control.</li>
          <li><b>AI & automation:</b> services depend on third-party model providers including OpenAI, Google Gemini, and Meta AI.</li>
        </ul>
        <h3>2. No Warranties</h3>
        <p>Content, software builds, and creative assets are provided “as is” and “as available”. WORKONOVA makes no express or implied warranties of continuous website uptime.</p>
        <h3>3. External Links & Partner Tools</h3>
        <p>We may link to third-party sites, tools, payment gateways, and platforms. WORKONOVA does not control or accept liability for their content or accuracy.</p>
      </div>
    )
  },
  refund: {
    title: 'Refund & Cancellation Policy',
    html: (
      <div className="lp-policy-content">
        <h2>Refund & Cancellation Policy — WORKONOVA</h2>
        <p>Customer satisfaction and high creative standards are priorities at WORKONOVA. This policy explains refund and project cancellation conditions.</p>
        <h3>1. Project Cancellation Eligibility</h3>
        <ul>
          <li><b>Before kick-off:</b> written cancellation within 12 hours of booking, before work begins or a specialist is assigned, receives a 100% refund less standard payment-gateway fees.</li>
          <li><b>In-progress projects:</b> requests after concepts, drafts, or work begin may receive a prorated partial refund.</li>
        </ul>
        <h3>2. Revision Guarantee & Refund Conditions</h3>
        <p>Clients are encouraged to use included revisions before seeking a refund. Refunds are not available once final source files are delivered.</p>
        <h3>3. Special Conditions for Custom Packages</h3>
        <ul>
          <li><b>Custom web/app & AI:</b> milestone-based contracts refund only unstarted future milestones upon mutual termination.</li>
          <li><b>Monthly retainers:</b> may be cancelled with seven days’ notice before the next billing cycle.</li>
        </ul>
        <h3>4. How to Request a Refund or Cancellation</h3>
        <p>Email contact@workonova.com or WhatsApp +91 7983264117 with your Order ID, client name, and reason. Approved refunds are credited within 5–7 business days.</p>
      </div>
    )
  }
};
