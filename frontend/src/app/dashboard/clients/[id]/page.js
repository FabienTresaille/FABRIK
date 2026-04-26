'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '../../../../components/AuthProvider';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.fabrik.alsek.fr';

export default function ClientDashboardPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [client, setClient] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMetricForm, setShowMetricForm] = useState(false);

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const load = useCallback(async () => {
    try {
      const [c, m] = await Promise.all([
        fetch(`${API}/api/v1/dashboard/client/${id}`, { headers }).then(r => r.json()),
        fetch(`${API}/api/v1/dashboard/client/${id}/metrics`, { headers }).then(r => r.json()),
      ]);
      setClient(c);
      setMetrics(Array.isArray(m) ? m : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [id, token]);

  useEffect(() => { if (token) load(); }, [token, load]);

  if (loading) return <div className="dash-loading"><div className="loading-orb" /><p>Chargement...</p></div>;
  if (!client) return <div className="dash-page"><p>Client non trouvé</p></div>;

  const sd = client.scores_data;
  const pillars = sd?.pillars || [];
  const recos = sd?.recommendations || [];

  // Totaux
  const totals = metrics.reduce((acc, m) => ({
    revenue: acc.revenue + (m.revenue || 0),
    ads_spend: acc.ads_spend + (m.ads_spend || 0),
    leads: acc.leads + (m.leads || 0),
    deals: acc.deals + (m.deals || 0),
    ia_tasks: acc.ia_tasks + (m.ia_tasks || 0),
  }), { revenue: 0, ads_spend: 0, leads: 0, deals: 0, ia_tasks: 0 });

  const avgRoas = totals.ads_spend > 0 ? (totals.revenue / totals.ads_spend).toFixed(2) : '—';
  const avgCpl = totals.leads > 0 ? Math.round(totals.ads_spend / totals.leads) : '—';

  return (
    <div className="dash-page">
      {/* Header */}
      <div className="dash-page-header">
        <div>
          <h1>{client.company_name}</h1>
          <p className="dash-page-subtitle">
            Dashboard de croissance — {client.onboarding_status === 'onboarded' ? '✅ Onboardé' : '⏳ En attente'}
          </p>
        </div>
        <div className="dash-page-badge">
          <span className="dash-live-dot" /> Live
        </div>
      </div>

      {/* KPI Cards */}
      <div className="dash-kpi-grid">
        <KpiCard icon="⭐" label="Score Digital" value={client.score_global ?? '—'} />
        {pillars.map((p, i) => (
          <KpiCard key={i} icon={p.icon} label={p.name} value={`${p.score}/${p.max}`} />
        ))}
        <KpiCard icon="💰" label="CA total" value={`${totals.revenue.toLocaleString('fr-FR')} €`} />
        <KpiCard icon="🎯" label="Leads total" value={totals.leads.toLocaleString('fr-FR')} />
        <KpiCard icon="📊" label="ROAS moyen" value={`${avgRoas}x`} />
        <KpiCard icon="💸" label="CPL moyen" value={`${avgCpl} €`} />
      </div>

      {/* Plan d'action */}
      {recos.length > 0 && (
        <div className="dash-section">
          <h2>🎯 Plan d&apos;action</h2>
          <div className="dash-recos">
            {recos.map((r, i) => (
              <div key={i} className={`dash-reco-item priority-${r.priority}`}>
                <span className="dash-reco-num">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <strong>{r.title}</strong>
                  <span className={`dash-reco-badge ${r.priority}`}>
                    {r.priority === 'high' ? '🔴' : r.priority === 'medium' ? '🟡' : '🟢'} {r.score_display}
                  </span>
                  <p className="dash-reco-desc">{r.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Détail Mensuel */}
      <div className="dash-section">
        <div className="dash-section-header-flex">
          <h2>📅 Détail mensuel</h2>
          <button className="btn btn-primary btn-sm" onClick={() => setShowMetricForm(!showMetricForm)}>
            {showMetricForm ? '✕ Fermer' : '+ Ajouter un mois'}
          </button>
        </div>

        {showMetricForm && (
          <MetricForm clientId={id} headers={headers} onSuccess={() => { setShowMetricForm(false); load(); }} />
        )}

        <div className="dash-table-wrapper">
          <table className="dash-table dash-table-metrics">
            <thead>
              <tr>
                <th>MOIS</th><th>PHASE</th><th>CA</th><th>ADS</th><th>ROAS</th>
                <th>LEADS</th><th>CPL</th><th>DEALS</th><th>COÛT/DEAL</th>
                <th>PANIER</th><th>CONV.</th><th>PIPELINE</th><th>GOOGLE</th>
                <th>MAINT.</th><th>IA TÂCHES</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m, i) => (
                <tr key={i}>
                  <td className="dash-table-month">{formatMonth(m.month)}</td>
                  <td><span className={`dash-phase-badge ${m.phase || 'setup'}`}>{m.phase || 'setup'}</span></td>
                  <td className="dash-table-money">{(m.revenue || 0).toLocaleString('fr-FR')} €</td>
                  <td>{(m.ads_spend || 0).toLocaleString('fr-FR')} €</td>
                  <td><strong>{m.roas?.toFixed(2) || '0'}x</strong></td>
                  <td>{m.leads || 0}</td>
                  <td>{m.cpl || 0} €</td>
                  <td><strong>{m.deals || 0}</strong></td>
                  <td>{m.cost_per_deal || 0} €</td>
                  <td>{(m.avg_basket || 0).toLocaleString('fr-FR')} €</td>
                  <td>{m.conversion_rate?.toFixed(1) || '0'}%</td>
                  <td>{m.pipeline || 0}</td>
                  <td>{m.google_rating ? `${m.google_rating}⭐` : '—'}</td>
                  <td>{m.maintenance_tasks || 0}</td>
                  <td>{m.ia_tasks || 0}</td>
                </tr>
              ))}
              {/* Total Row */}
              {metrics.length > 0 && (
                <tr className="dash-table-total">
                  <td colSpan={2}><strong>TOTAL</strong></td>
                  <td className="dash-table-money"><strong>{totals.revenue.toLocaleString('fr-FR')} €</strong></td>
                  <td><strong>{totals.ads_spend.toLocaleString('fr-FR')} €</strong></td>
                  <td><strong>{avgRoas}x</strong></td>
                  <td><strong>{totals.leads}</strong></td>
                  <td><strong>{avgCpl} €</strong></td>
                  <td><strong>{totals.deals}</strong></td>
                  <td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>
                  <td><strong>{totals.ia_tasks}</strong></td>
                </tr>
              )}
              {metrics.length === 0 && (
                <tr><td colSpan={15} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                  Aucune donnée mensuelle. Cliquez sur &quot;+ Ajouter un mois&quot; pour commencer.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Client Info */}
      <div className="dash-section">
        <h2>📋 Informations client</h2>
        <div className="dash-info-grid">
          <InfoRow label="Site web" value={client.website_url} link />
          <InfoRow label="Instagram" value={client.instagram_handle} />
          <InfoRow label="Email" value={client.contact_email} />
          <InfoRow label="Téléphone" value={client.contact_phone} />
          {client.onboarding_data?.objectives && <InfoRow label="Objectifs" value={client.onboarding_data.objectives} />}
          {client.onboarding_data?.allocated_budget && <InfoRow label="Budget alloué" value={`${client.onboarding_data.allocated_budget} €/mois`} />}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value }) {
  return (
    <div className="dash-kpi-card">
      <div className="dash-kpi-icon">{icon}</div>
      <div className="dash-kpi-value">{value}</div>
      <div className="dash-kpi-label">{label}</div>
    </div>
  );
}

function InfoRow({ label, value, link }) {
  return (
    <div className="dash-info-row">
      <span className="dash-info-label">{label}</span>
      {link && value ? <a href={value} target="_blank" rel="noopener noreferrer">{value}</a> : <span>{value || '—'}</span>}
    </div>
  );
}

function MetricForm({ clientId, headers, onSuccess }) {
  const [form, setForm] = useState({
    month: new Date().toISOString().slice(0, 7) + '-01',
    phase: 'setup', revenue: 0, ads_spend: 0, roas: 0, leads: 0, cpl: 0,
    deals: 0, cost_per_deal: 0, avg_basket: 0, conversion_rate: 0,
    pipeline: 0, google_rating: 0, google_reviews: 0, maintenance_tasks: 0, ia_tasks: 0,
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch(`${API}/api/v1/dashboard/client/${clientId}/metrics`, {
        method: 'POST', headers, body: JSON.stringify(form),
      });
      onSuccess();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  return (
    <form className="dash-metric-form" onSubmit={submit}>
      <div className="dash-metric-form-grid">
        <div className="form-group">
          <label className="form-label">Mois</label>
          <input type="month" className="form-input" value={form.month.slice(0, 7)} onChange={e => set('month', e.target.value + '-01')} />
        </div>
        <div className="form-group">
          <label className="form-label">Phase</label>
          <select className="form-input" value={form.phase} onChange={e => set('phase', e.target.value)}>
            <option value="setup">Setup</option>
            <option value="growth">Growth</option>
            <option value="plateau">Plateau</option>
          </select>
        </div>
        <NumField label="CA (€)" value={form.revenue} onChange={v => set('revenue', v)} />
        <NumField label="Ads (€)" value={form.ads_spend} onChange={v => set('ads_spend', v)} />
        <NumField label="ROAS" value={form.roas} onChange={v => set('roas', v)} float />
        <NumField label="Leads" value={form.leads} onChange={v => set('leads', v)} />
        <NumField label="CPL (€)" value={form.cpl} onChange={v => set('cpl', v)} />
        <NumField label="Deals" value={form.deals} onChange={v => set('deals', v)} />
        <NumField label="Coût/Deal (€)" value={form.cost_per_deal} onChange={v => set('cost_per_deal', v)} />
        <NumField label="Panier (€)" value={form.avg_basket} onChange={v => set('avg_basket', v)} />
        <NumField label="Conv. (%)" value={form.conversion_rate} onChange={v => set('conversion_rate', v)} float />
        <NumField label="Pipeline" value={form.pipeline} onChange={v => set('pipeline', v)} />
        <NumField label="Google ⭐" value={form.google_rating} onChange={v => set('google_rating', v)} float />
        <NumField label="Avis Google" value={form.google_reviews} onChange={v => set('google_reviews', v)} />
        <NumField label="Maintenance" value={form.maintenance_tasks} onChange={v => set('maintenance_tasks', v)} />
        <NumField label="IA Tâches" value={form.ia_tasks} onChange={v => set('ia_tasks', v)} />
      </div>
      <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: '1rem' }}>
        {saving ? 'Enregistrement...' : '💾 Enregistrer'}
      </button>
    </form>
  );
}

function NumField({ label, value, onChange, float }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input type="number" step={float ? '0.01' : '1'} className="form-input" value={value}
        onChange={e => onChange(float ? parseFloat(e.target.value) || 0 : parseInt(e.target.value) || 0)} />
    </div>
  );
}

function formatMonth(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }).replace('.', '');
}
