'use client';

import Header from '../components/Header';
import AuditForm from '../components/AuditForm';

export default function HomePage() {
  return (
    <>
      <Header />
      <main className="main-content">
        <section className="hero">
          {/* Badge */}
          <div className="hero-badge">
            <span className="hero-badge-dot" />
            Propulsé par l'Intelligence Artificielle
          </div>

          {/* Title */}
          <h1>
            Votre présence digitale,
            <br />
            <span className="gradient-text">analysée en profondeur.</span>
          </h1>

          {/* Subtitle */}
          <p className="hero-subtitle">
            FABRIK scanne votre site web et vos réseaux sociaux pour générer un
            audit stratégique 360° personnalisé, en quelques secondes.
          </p>

          {/* Audit Form */}
          <AuditForm />
        </section>

        {/* Footer */}
        <footer className="footer">
          <p>
            © {new Date().getFullYear()} FABRIK by{' '}
            <a href="https://alsek.fr" target="_blank" rel="noopener noreferrer">
              Alsek
            </a>{' '}
            — Business Partner IA
          </p>
        </footer>
      </main>
    </>
  );
}
