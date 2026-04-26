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

  return (
    <>
      <Header />
      <main className="main-content">
        <div className="report-page">
          {loading && <LoadingState />}
          {error && <ErrorState message={error} />}
          {audit && (
            <>
              <div className="report-header">
                <h1>
                  Audit 360° — <span className="gradient-text">{audit.company_name}</span>
                </h1>
                <p>
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
                </p>
              </div>
              <AuditReport audit={audit} />
            </>
          )}
        </div>

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

function LoadingState() {
  return (
    <div className="loading-container">
      <div className="loading-orb" />
      <div className="loading-text">
        <strong>Analyse en cours...</strong>
        <div className="loading-steps">
          <div className="loading-step active">
            <span className="loading-step-icon">🔍</span>
            Scraping du profil Instagram
          </div>
          <div className="loading-step">
            <span className="loading-step-icon">⚡</span>
            Analyse technique du site web
          </div>
          <div className="loading-step">
            <span className="loading-step-icon">🧠</span>
            Synthèse stratégique par l'IA
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorState({ message }) {
  return (
    <div className="error-container">
      <div className="error-icon">😵</div>
      <h2>Oups, une erreur est survenue</h2>
      <p>{message}</p>
      <a href="/" className="btn btn-primary" style={{ maxWidth: '250px', marginTop: '1rem' }}>
        Retour à l'accueil
      </a>
    </div>
  );
}
