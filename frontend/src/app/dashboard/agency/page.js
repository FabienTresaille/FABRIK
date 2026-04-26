'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.fabrik.alsek.fr';

export default function AgencyPage() {
  const { token } = useAuth();
  const [stats, setStats] = useState(null);
  const [pipeline, setPipeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const load = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([
        fetch(`${API}/api/v1/dashboard/agency`, { headers }).then(r => r.json()),
        fetch(`${API}/api/v1/dashboard/pipeline`, { headers }).then(r => r.json()),
      ]);
      setStats(s);
      setPipeline(p);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [token]);

  useEffect(() => { if (token) load(); }, [token, load]);

  if (loading) return <div className="dash-loading"><div className="loading-orb" /><p>Chargement...</p></div>;

  return (
    <div className="dash-page">
      <div className="dash-page-header">
        <div>
          <h1>Vue d&apos;ensemble</h1>
          <p className="dash-page-subtitle">Performance globale — Alsek Marketing</p>
        </div>
        <div className="dash-page-badge">
          <span className="dash-live-dot" /> Live
        </div>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="dash-kpi-grid">
          <KpiCard icon="📋" label="Audits réalisés" value={stats.total_audits} />
          <KpiCard icon="✅" label="Clients onboardés" value={stats.clients_onboarded} />
          <KpiCard icon="⭐" label="Score moyen" value={stats.avg_score ? `${stats.avg_score}/100` : '—'} />
          <KpiCard icon="⏳" label="En attente" value={stats.pending_audits} highlight={stats.pending_audits > 0} />
          <KpiCard icon="💰" label="CA total" value={`${(stats.total_revenue || 0).toLocaleString('fr-FR')} €`} />
          <KpiCard icon="🎯" label="Leads total" value={(stats.total_leads || 0).toLocaleString('fr-FR')} />
        </div>
      )}

      {/* Pipeline */}
      <div className="dash-section" id="pipeline">
        <h2>🚀 Pipeline Onboarding</h2>
        <div className="dash-table-wrapper">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Client</th>
                <th>Score</th>
                <th>Email</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pipeline.map(item => (
                <tr key={item.audit_id}>
                  <td>{item.created_at ? new Date(item.created_at).toLocaleDateString('fr-FR') : '—'}</td>
                  <td className="dash-table-company">{item.company_name}</td>
                  <td><span className={`dash-score-badge ${getScoreClass(item.score_global)}`}>{item.score_global ?? '—'}</span></td>
                  <td>{item.contact_email || '—'}</td>
                  <td>
                    <span className={`dash-status-badge ${item.onboarding_status}`}>
                      {item.onboarding_status === 'onboarded' ? '✅ Onboardé' : '⏳ En attente'}
                    </span>
                  </td>
                  <td className="dash-table-actions">
                    <Link href={`/audit/${item.audit_id}`} target="_blank" className="dash-action-btn">📋</Link>
                    {item.onboarding_status !== 'onboarded' && (
                      <button className="dash-action-btn success" onClick={() => setModal(item)}>✅</button>
                    )}
                    {item.onboarding_status === 'onboarded' && (
                      <Link href={`/dashboard/clients/${item.client_id}`} className="dash-action-btn">👁</Link>
                    )}
                  </td>
                </tr>
              ))}
              {pipeline.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Aucun audit en pipeline</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Onboarding */}
      {modal && (
        <OnboardingModal item={modal} headers={headers} onClose={() => setModal(null)} onSuccess={() => { setModal(null); load(); }} />
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, highlight }) {
  return (
    <div className={`dash-kpi-card ${highlight ? 'highlight' : ''}`}>
      <div className="dash-kpi-icon">{icon}</div>
      <div className="dash-kpi-value">{value}</div>
      <div className="dash-kpi-label">{label}</div>
    </div>
  );
}

function OnboardingModal({ item, headers, onClose, onSuccess }) {
  const [form, setForm] = useState({ current_revenue: '', allocated_budget: '', objectives: '', notes: '', company_sector: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/v1/dashboard/onboard/${item.audit_id}`, {
        method: 'POST', headers, body: JSON.stringify(form),
      });
      if (res.ok) onSuccess();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  return (
    <div className="dash-modal-overlay" onClick={onClose}>
      <div className="dash-modal" onClick={e => e.stopPropagation()}>
        <div className="dash-modal-header">
          <h3>✅ Onboarding — {item.company_name}</h3>
          <button className="dash-modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">CA mensuel actuel (€)</label>
            <input className="form-input" type="number" value={form.current_revenue} onChange={e => setForm(p => ({ ...p, current_revenue: parseInt(e.target.value) || 0 }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Budget alloué (€/mois)</label>
            <input className="form-input" type="number" value={form.allocated_budget} onChange={e => setForm(p => ({ ...p, allocated_budget: parseInt(e.target.value) || 0 }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Secteur</label>
            <select className="form-input" value={form.company_sector} onChange={e => setForm(p => ({ ...p, company_sector: e.target.value }))}>
              <option value="">— Sélectionner —</option>
              <option value="restauration">Restauration</option>
              <option value="e-commerce">E-commerce</option>
              <option value="services">Services</option>
              <option value="beauté">Beauté</option>
              <option value="immobilier">Immobilier</option>
              <option value="autre">Autre</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Objectifs</label>
            <textarea className="form-input" rows={3} value={form.objectives} onChange={e => setForm(p => ({ ...p, objectives: e.target.value }))} placeholder="Objectifs du client pour les prochains mois..." />
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-input" rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
          <div className="dash-modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Validation...' : '✅ Valider l\'onboarding'}
            </button>
          </div>
        </form>
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
