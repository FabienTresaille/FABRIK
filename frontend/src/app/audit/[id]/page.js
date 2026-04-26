'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Header from '../../../components/Header';
import AuditReport from '../../../components/AuditReport';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.fabrik.alsek.fr';

export default function AuditPage() {
  const params = useParams();
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAudit = async () => {
      try {
        const response = await fetch(`${API_URL}/api/v1/audit/${params.id}`);
        if (!response.ok) {
          throw new Error(
            response.status === 404
              ? 'Audit non trouvé'
              : `Erreur serveur (${response.status})`
          );
        }
        const data = await response.json();
        setAudit(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (params.id) fetchAudit();
  }, [params.id]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!audit) return null;

  const score = audit.scores?.score_global ?? 0;
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (score / 100) * circumference;
  const ratingText = getRating(score);

  return (
    <>
      <Header />
      <main className="main-content">
        {/* ═══ HERO — Score Global ═══ */}
        <section className="rpt-hero" id="report-hero">
          <div className="rpt-hero-badge">
            <span className="badge-violet">AUDIT DIGITAL 360°</span>
          </div>
          <div className="rpt-hero-company">{audit.company_name}</div>
          <h1 className="rpt-hero-title">
            <span className="gradient-text">Votre Score Digital</span>
          </h1>

          <div className="rpt-hero-score">
            <div className={`rpt-score-circle rpt-score-circle-lg ${getScoreClass(score)}`}>
              <svg viewBox="0 0 100 100">
                <circle className="rpt-score-bg" cx="50" cy="50" r="42" />
                <circle
                  className="rpt-score-fill rpt-score-fill-animated"
                  cx="50"
                  cy="50"
                  r="42"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                />
              </svg>
              <span className="rpt-score-value rpt-score-value-lg">{score}</span>
              <span className="rpt-score-label">/ 100</span>
            </div>
          </div>

          <div className={`rpt-hero-rating ${getScoreClass(score)}`}>
            {ratingText}
          </div>

          <div className="rpt-hero-date">
            Généré le{' '}
            {audit.created_at
              ? new Date(audit.created_at).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'N/A'}
          </div>

          <div className="rpt-hero-scroll no-print">
            <span>Découvrir le rapport</span>
            <div className="rpt-scroll-arrow" />
          </div>
        </section>

        {/* ═══ RAPPORT COMPLET ═══ */}
        <div className="rpt-container">
          <AuditReport audit={audit} />
        </div>

        {/* ═══ FOOTER ═══ */}
        <footer className="rpt-footer">
          <div className="rpt-footer-logo gradient-text">FABRIK</div>
          <div>Audit Digital Automatisé — Rapport confidentiel</div>
          <div style={{ marginTop: '0.5rem' }}>
            © {new Date().getFullYear()} FABRIK by{' '}
            <a href="https://alsek.fr" target="_blank" rel="noopener noreferrer">
              Alsek
            </a>
          </div>
        </footer>
      </main>
    </>
  );
}

/* ── Loading State ── */
function LoadingState() {
  return (
    <>
      <Header />
      <main className="main-content">
        <div className="rpt-loading">
          <div className="rpt-loading-orb" />
          <div className="rpt-loading-text">
            <h2>Analyse en cours...</h2>
            <div className="rpt-loading-steps">
              <Step icon="🔍" text="Scraping du profil Instagram" active />
              <Step icon="⚡" text="Analyse technique du site web" />
              <Step icon="🧠" text="Synthèse stratégique par l'IA" />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

function Step({ icon, text, active }) {
  return (
    <div className={`rpt-loading-step ${active ? 'active' : ''}`}>
      <span className="rpt-loading-step-icon">{icon}</span>
      {text}
    </div>
  );
}

/* ── Error State ── */
function ErrorState({ message }) {
  return (
    <>
      <Header />
      <main className="main-content">
        <div className="rpt-error">
          <div className="rpt-error-icon">😵</div>
          <h2>Oups, une erreur est survenue</h2>
          <p>{message}</p>
          <a href="/" className="btn btn-primary" style={{ maxWidth: '250px', marginTop: '1rem' }}>
            Retour à l&apos;accueil
          </a>
        </div>
      </main>
    </>
  );
}

/* ── Helpers ── */
function getScoreClass(score) {
  if (score >= 80) return 'score-excellent';
  if (score >= 60) return 'score-good';
  if (score >= 40) return 'score-average';
  return 'score-poor';
}

function getRating(score) {
  if (score >= 90) return '🏆 Excellent — Votre présence digitale est exemplaire';
  if (score >= 75) return '✅ Bon — Quelques optimisations feront la différence';
  if (score >= 50) return '⚠️ Moyen — Des améliorations significatives sont nécessaires';
  return '🚨 Critique — Votre présence digitale nécessite une refonte';
}
