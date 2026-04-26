'use client';

export default function Header() {
  return (
    <header className="header" id="main-header">
      <div className="header-logo">
        <img src="/logo.png" alt="FABRIK Logo" width={36} height={36} />
        <div>
          <div className="header-logo-text">FABRIK</div>
          <div className="header-tagline">Business Partner IA</div>
        </div>
      </div>
      <nav className="header-nav" id="main-nav">
        <a href="/">Accueil</a>
        <a href="https://alsek.fr" target="_blank" rel="noopener noreferrer">
          Alsek Agency
        </a>
      </nav>
    </header>
  );
}
