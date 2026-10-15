import React from 'react';

function BrandHero() {
  return (
    <div className="brand-hero">
      <div className="brand-mark" aria-hidden="true">
        <span className="brand-bubble brand-bubble-primary" />
        <span className="brand-bubble brand-bubble-secondary" />
        <span className="brand-spark brand-spark-one" />
        <span className="brand-spark brand-spark-two" />
      </div>

      <div className="brand-copy">
        {/* <span className="brand-kicker">Elegant private messaging</span> */}
        <h1>Confabulate</h1>
        <p>Clear conversations with friends, teams, and groups.</p>
      </div>
    </div>
  );
}

export default BrandHero;
