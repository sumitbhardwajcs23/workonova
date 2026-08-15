import React from 'react';

export default function Services() {
  const services = [
    { title: 'Graphic Designing', icon: '✦', desc: 'Creatives that build recognition', action: 'Brand-ready visual design' },
    { title: 'Video Editing', icon: '▶', desc: 'Reels, ads, and showreels', action: 'Stories made to perform' },
    { title: '3D Design & Modeling', icon: '◇', desc: 'Models and product renders', action: 'Immersive digital visuals' },
    { title: 'VFX', icon: '✺', desc: 'Visual effects for impact', action: 'Polished cinematic effects' },
    { title: 'Animation', icon: '↗', desc: 'Motion that holds attention', action: 'Ideas brought to life' },
    { title: 'Digital Marketing', icon: '⌁', desc: 'Campaigns built for growth', action: 'Reach the right audience' },
    { title: 'Website Development', icon: '⌘', desc: 'Fast, conversion-led websites', action: 'Experiences made to scale' },
    { title: 'Software Development', icon: '⌨', desc: 'Custom systems and platforms', action: 'Technology that works harder' },
    { title: 'App Development', icon: '▣', desc: 'Mobile apps for every idea', action: 'Build for every screen' },
    { title: 'AI Services', icon: '◉', desc: 'Intelligent automation solutions', action: 'Make work smarter' },
    { title: 'IT Services', icon: '⚙', desc: 'Reliable technology support', action: 'Keep systems moving' },
    { title: 'Cyber Security', icon: '◈', desc: 'Protect your digital business', action: 'Security you can trust' },
  ];

  return (
    <section className="section services" id="services">
      <div className="split-head">
        <div>
          <p className="eyebrow">OUR PREMIUM SERVICES</p>
          <h2>Everything your business needs to grow.</h2>
        </div>
        <p>Creative, technology, and security expertise from one reliable partner.</p>
      </div>
      <div className="service-grid">
        {services.map(srv => (
          <button className="service" data-service={srv.title} key={srv.title}>
            <i>{srv.icon}</i>
            <h3>{srv.title}</h3>
            <p>{srv.desc}</p>
            <strong>{srv.action}</strong>
            <span>Explore service →</span>
          </button>
        ))}
      </div>
    </section>
  );
}
