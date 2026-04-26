'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.fabrik.alsek.fr';

export default function ClientsPage() {
  const { token } = useAuth();
  const [pipeline, setPipeline] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/v1/dashboard/pipeline`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        setPipeline(data.filter(p => p.onboarding_status === 'onboarded'));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="dash-loading"><div className="loading-orb" /><p>Chargement...</p></div>;

  return (
    <div className="dash-page">
      <div className="dash-page-header">
        <div>
          <h1>👥 Clients</h1>
          <p className="dash-page-subtitle">{pipeline.length} client{pipeline.length > 1 ? 's' : ''} onboardé{pipeline.length > 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="dash-clients-grid">
        {pipeline.map(item => (
          <Link key={item.client_id} href={`/dashboard/clients/${item.client_id}`} className="dash-client-card">
            <div className="dash-client-card-header">
              <div className="dash-client-avatar">{item.company_name[0]}</div>
              <div>
                <div className="dash-client-name">{item.company_name}</div>
                <div className="dash-client-email">{item.contact_email || 'Pas d\'email'}</div>
              </div>
            </div>
            <div className="dash-client-score">
              <span className={`dash-score-badge ${getScoreClass(item.score_global)}`}>{item.score_global ?? '—'}</span>
              <span className="dash-client-score-label">Score digital</span>
            </div>
          </Link>
        ))}
        {pipeline.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem', gridColumn: '1/-1' }}>
            <p>Aucun client onboardé pour le moment.</p>
            <Link href="/dashboard/agency" className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>
              Aller au pipeline →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function getScoreClass(score) {
  if (!score) return '';
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'average';
  return 'poor';
}
