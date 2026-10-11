import "./HomePage.css";

export default function HomePage({ onLogin, onCreateCommittee }) {
  const goToSection = (fraction) => {
    const page = document.querySelector(".festflow-home-reference");
    if (!page) return;
    const top = page.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + page.offsetHeight * fraction, behavior: "smooth" });
  };

  const scrollToMobileSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="festflow-home" aria-label="FestFlow public home page">
      {/* Desktop keeps the approved artwork and its original clickable areas. */}
      <div className="festflow-home-reference ff-desktop-home">
        <img
          className="festflow-home-artwork"
          src="/festflow-home-reference.png"
          alt="FestFlow homepage with community festival artwork, navigation, features and celebration categories."
          draggable="false"
        />
        <nav className="festflow-home-hotspots" aria-label="Main navigation">
          <button className="ff-hotspot ff-home-link ff-nav-hit" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Home" title="Home" />
          <button className="ff-hotspot ff-features-link ff-nav-hit" onClick={() => goToSection(0.48)} aria-label="Features" title="Features" />
          <button className="ff-hotspot ff-how-link ff-nav-hit" onClick={() => goToSection(0.61)} aria-label="How It Works" title="How It Works" />
          <button className="ff-hotspot ff-about-link ff-nav-hit" onClick={() => goToSection(0.65)} aria-label="About" title="About" />
          <button className="ff-hotspot ff-contact-link ff-nav-hit" onClick={() => goToSection(0.84)} aria-label="Contact" title="Contact" />
          <button className="ff-hotspot ff-header-login ff-button-hit" onClick={onLogin} aria-label="Log In" title="Log In" />
          <button className="ff-hotspot ff-header-create ff-button-hit" onClick={onCreateCommittee} aria-label="Create Your Committee" title="Create Your Committee" />
          <button className="ff-hotspot ff-hero-create ff-button-hit" onClick={onCreateCommittee} aria-label="Create Your Committee" title="Create Your Committee" />
          <button className="ff-hotspot ff-hero-login ff-button-hit" onClick={onLogin} aria-label="Log In" title="Log In" />
          <button className="ff-hotspot ff-footer-create ff-button-hit" onClick={onCreateCommittee} aria-label="Create Your Committee" title="Create Your Committee" />
          <button className="ff-hotspot ff-hero-image-hit" onClick={() => goToSection(0.48)} aria-label="Explore festival features" title="Explore festival features" />
          <button className="ff-hotspot ff-ganesh-card-hit ff-card-hit" onClick={() => goToSection(0.65)} aria-label="Explore religious festivals" title="Explore religious festivals" />
          <button className="ff-hotspot ff-navratri-card-hit ff-card-hit" onClick={() => goToSection(0.65)} aria-label="Explore community events" title="Explore community events" />
          <button className="ff-hotspot ff-diwali-card-hit ff-card-hit" onClick={() => goToSection(0.65)} aria-label="Explore cultural celebrations" title="Explore cultural celebrations" />
          <button className="ff-hotspot ff-dussehra-card-hit ff-card-hit" onClick={() => goToSection(0.65)} aria-label="Explore temple events" title="Explore temple events" />
          <button className="ff-hotspot ff-ugadi-card-hit ff-card-hit" onClick={() => goToSection(0.65)} aria-label="Explore charity and other events" title="Explore charity and other events" />
        </nav>
      </div>

      {/* Mobile uses real, reflowing content instead of shrinking the desktop screenshot. */}
      <div className="ff-mobile-home">
        <header className="ff-mobile-header">
          <a className="ff-mobile-brand" href="#ff-mobile-home" onClick={(e) => { e.preventDefault(); scrollToMobileSection("ff-mobile-home"); }}>
            <span className="ff-brand-mark" aria-hidden="true">✦</span>
            <span><strong>FestFlow</strong><small>Every Community. Every Celebration. One Platform.</small></span>
          </a>
          <button className="ff-mobile-login" onClick={onLogin}>Log In</button>
        </header>

        <nav className="ff-mobile-nav" aria-label="Mobile navigation">
          <button onClick={() => scrollToMobileSection("ff-mobile-home")}>Home</button>
          <button onClick={() => scrollToMobileSection("ff-mobile-features")}>Features</button>
          <button onClick={() => scrollToMobileSection("ff-mobile-how")}>How It Works</button>
          <button onClick={() => scrollToMobileSection("ff-mobile-about")}>About</button>
        </nav>

        <section className="ff-mobile-hero" id="ff-mobile-home">
          <p className="ff-eyebrow">COMMUNITY FESTIVAL MANAGEMENT</p>
          <h1>Every Community.<br /><em>Every Celebration.</em><br />One Platform.</h1>
          <p className="ff-hero-copy">FestFlow helps community and festival committees collect funds, manage donations, and keep everyone informed — all in one simple platform.</p>
          <div className="ff-mobile-actions">
            <button className="ff-primary-button" onClick={onCreateCommittee}>Create Your Committee <span aria-hidden="true">→</span></button>
            <button className="ff-secondary-button" onClick={() => scrollToMobileSection("ff-mobile-features")}>Learn More</button>
          </div>
          <div className="ff-mobile-hero-image">
            <img src="/hover-images/hero-ganesh.jpg" alt="A colorful community festival celebration" onError={(e) => { e.currentTarget.style.display = "none"; }} />
            <div className="ff-image-caption"><strong>Celebrate together</strong><span>One place for your community celebrations.</span></div>
          </div>
        </section>

        <section className="ff-mobile-features" id="ff-mobile-features">
          <p className="ff-eyebrow">MADE FOR COMMUNITIES</p>
          <h2>Everything your celebration needs</h2>
          <div className="ff-feature-grid">
            <article className="ff-feature-item"><span>♧</span><h3>Manage Collections</h3><p>Keep community collection records organized.</p></article>
            <article className="ff-feature-item"><span>₹</span><h3>Easy Contributions</h3><p>Track contributions in one convenient place.</p></article>
            <article className="ff-feature-item"><span>✓</span><h3>Clear Records</h3><p>Help your committee stay informed.</p></article>
            <article className="ff-feature-item"><span>▤</span><h3>Reports & Insights</h3><p>Review collection information at a glance.</p></article>
          </div>
        </section>

        <section className="ff-mobile-festivals" id="ff-mobile-how">
          <p className="ff-eyebrow">POPULAR FESTIVALS</p>
          <h2>Celebrate what brings us together</h2>
          <div className="ff-festival-grid">
            <article className="ff-festival-card"><img src="/hover-images/ganesh-chaturthi.jpg" alt="Ganesh Chaturthi celebration" /><div><strong>Ganesh Chaturthi</strong><small>Devotion · Unity · Celebration</small></div></article>
            <article className="ff-festival-card"><img src="/hover-images/navratri.jpg" alt="Navratri dance celebration" /><div><strong>Navratri</strong><small>Dance · Culture · Community</small></div></article>
            <article className="ff-festival-card"><img src="/hover-images/diwali.jpg" alt="Diwali lamp" /><div><strong>Diwali</strong><small>Light · Joy · Togetherness</small></div></article>
            <article className="ff-festival-card"><img src="/hover-images/dussehra.jpg" alt="Dussehra celebration" /><div><strong>Dussehra</strong><small>Tradition · Hope · Unity</small></div></article>
            <article className="ff-festival-card"><img src="/hover-images/ugadi.jpg" alt="Ugadi festive arrangement" /><div><strong>Ugadi</strong><small>New beginnings · Prosperity</small></div></article>
          </div>
        </section>

        <section className="ff-mobile-about" id="ff-mobile-about">
          <p className="ff-eyebrow">SIMPLE. ORGANIZED. TOGETHER.</p>
          <h2>Perfect for every community and celebration</h2>
          <p>Bring your committee's collection records and donation tracking together in one easy-to-use place.</p>
          <button className="ff-primary-button" onClick={onCreateCommittee}>Get Started <span aria-hidden="true">→</span></button>
        </section>
        <footer className="ff-mobile-footer" id="ff-mobile-contact">
          <strong>FestFlow</strong>
          <span>Every Community. Every Celebration. One Platform.</span>
          <button onClick={onLogin}>Log In</button>
        </footer>
      </div>
    </main>
  );
}
