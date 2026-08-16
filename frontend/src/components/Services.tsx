

const services = [
  { icon: '✦', title: 'Graphic Designing', desc: 'Logos, brand identity, social creatives', action: 'Brand-ready visual design' },
  { icon: '▶', title: 'Video Editing', desc: 'Reels, ads, showreels & color grading', action: 'Stories made to perform' },
  { icon: '◇', title: '3D Design & Modeling', desc: 'Models, renders & product visualization', action: 'Immersive digital visuals' },
  { icon: '✺', title: 'VFX', desc: 'Compositing, CGI & motion tracking', action: 'Polished cinematic effects' },
  { icon: '↗', title: 'Animation', desc: '2D/3D animation & motion graphics', action: 'Ideas brought to life' },
  { icon: '⌁', title: 'Digital Marketing', desc: 'SEO, ads & growth campaigns', action: 'Reach the right audience' },
  { icon: '⌘', title: 'Website Development', desc: 'Fast, conversion-led web experiences', action: 'Experiences made to scale' },
  { icon: '⌨', title: 'Software Development', desc: 'SaaS, ERP, CRM & custom platforms', action: 'Technology that works harder' },
  { icon: '▣', title: 'App Development', desc: 'Android, iOS & cross-platform apps', action: 'Build for every screen' },
  { icon: '◉', title: 'AI Services', desc: 'Chatbots, automation & AI workflows', action: 'Make work smarter' },
  { icon: '⚙', title: 'IT Services', desc: 'Cloud, infrastructure & IT support', action: 'Keep systems moving' },
  { icon: '◈', title: 'Cyber Security', desc: 'Audits, VAPT & data protection', action: 'Security you can trust' },
];

export default function Services() {
  return (
    <section className="section services" id="services">
      <div className="split-head">
        <div>
          <p className="eyebrow">OUR PREMIUM SERVICES</p>
          <h2>Everything your business needs to grow.</h2>
        </div>
        <p>Creative, technology, and security expertise from one reliable partner. Hover to explore what we offer.</p>
      </div>
      <div className="service-grid">
        {services.map(srv => (
          <button className="service" key={srv.title} data-service={srv.title}>
            <i>{srv.icon}</i>
            <h3>{srv.title}</h3>
            <p>{srv.desc}</p>
            <strong>{srv.action}</strong>
            <span>Explore →</span>
          </button>
        ))}
      </div>
    </section>
  );
}
