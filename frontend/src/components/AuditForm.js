'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.fabrik.alsek.fr';
const TOTAL_STEPS = 5;

export default function AuditForm() {
  const router = useRouter();
  const { token } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    company_name: '', website_url: '', company_sector: '', site_age: '',
    instagram_handle: '', facebook_url: '', linkedin_url: '', tiktok_url: '', google_business_url: '',
    ads_active: '', budget: '', conversion_tracking: '', acquisition_strategy: '', reviews: '', visual_coherence: '1',
    contact_firstname: '', contact_lastname: '', contact_email: '', contact_phone: '', contact_notes: '', client_objective: '',
  });

  const set = (key, val) => { setFormData(prev => ({ ...prev, [key]: val })); if (error) setError(null); };
  const handleChange = (e) => set(e.target.name, e.target.value);

  const nextStep = () => { if (validateStep()) setStep(s => Math.min(s + 1, TOTAL_STEPS)); };
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const validateStep = () => {
    if (step === 1 && !formData.company_name.trim()) { setError('Le nom de l\'entreprise est requis'); return false; }
    if (step === 1 && !formData.website_url.trim()) { setError('L\'URL du site web est requise'); return false; }
    return true;
  };

  const handleSubmit = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || `Erreur (${res.status})`);
      }
      const data = await res.json();
      router.push(`/audit/${data.id}`);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="wizard-container" id="audit-wizard">
      <div className="wizard-header">
        <h1 className="gradient-text">FABRIK</h1>
        <p className="wizard-subtitle">Création d&apos;audit digital personnalisé</p>
      </div>

      {/* Progress Bar */}
      <div className="wizard-progress">
        {[1,2,3,4,5].map(s => (
          <div key={s} className="wizard-progress-item">
            {s > 1 && <div className={`wizard-progress-line ${s <= step ? 'completed' : ''}`} />}
            <div className={`wizard-progress-dot ${s === step ? 'active' : s < step ? 'completed' : ''}`}>
              {s}
            </div>
          </div>
        ))}
      </div>

      {/* Steps */}
      <div className="wizard-body">
        {step === 1 && <Step1 data={formData} onChange={handleChange} set={set} />}
        {step === 2 && <Step2 data={formData} onChange={handleChange} />}
        {step === 3 && <Step3 data={formData} onChange={handleChange} set={set} />}
        {step === 4 && <Step4 data={formData} onChange={handleChange} set={set} />}
        {step === 5 && <Step5 data={formData} />}
      </div>

      {error && <div className="auth-error" style={{ marginTop: '1rem' }}>⚠️ {error}</div>}

      {/* Navigation */}
      <div className="wizard-nav">
        {step > 1 && <button type="button" className="btn btn-secondary" onClick={prevStep}>← Retour</button>}
        <div style={{ flex: 1 }} />
        {step < TOTAL_STEPS ? (
          <button type="button" className="btn btn-primary" onClick={nextStep}>Suivant →</button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={loading} id="audit-submit-btn">
            {loading ? <><span className="btn-spinner" /> Analyse en cours...</> : <>🚀 Lancer l&apos;audit</>}
          </button>
        )}
      </div>
    </div>
  );
}

/* ═══ Step 1 — Entreprise ═══ */
function Step1({ data, onChange, set }) {
  return (
    <div className="wizard-step">
      <h2>Informations de l&apos;entreprise</h2>
      <p className="wizard-step-desc">Informations générales de la société à auditer.</p>
      <div className="form-group">
        <label className="form-label" htmlFor="company_name">Nom de l&apos;entreprise *</label>
        <input id="company_name" name="company_name" className="form-input" placeholder="Ex : Ô Fines Bouchées" value={data.company_name} onChange={onChange} required />
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="website_url">URL du site web *</label>
        <input id="website_url" name="website_url" className="form-input" placeholder="https://www.example.com" value={data.website_url} onChange={onChange} required />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="company_sector">Secteur d&apos;activité</label>
          <select id="company_sector" name="company_sector" className="form-input" value={data.company_sector} onChange={onChange}>
            <option value="">— Sélectionner —</option>
            <option value="restauration">Restauration</option>
            <option value="e-commerce">E-commerce</option>
            <option value="services">Services</option>
            <option value="beauté">Beauté & Bien-être</option>
            <option value="santé">Santé</option>
            <option value="immobilier">Immobilier</option>
            <option value="sport">Sport & Loisirs</option>
            <option value="éducation">Éducation</option>
            <option value="technologie">Technologie</option>
            <option value="autre">Autre</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="site_age">Âge du site web</label>
          <select id="site_age" name="site_age" className="form-input" value={data.site_age} onChange={onChange}>
            <option value="">— Sélectionner —</option>
            <option value="moins_1an">Moins d&apos;1 an</option>
            <option value="1_3ans">1 à 3 ans</option>
            <option value="3_5ans">3 à 5 ans</option>
            <option value="plus_5ans">Plus de 5 ans</option>
          </select>
        </div>
      </div>
    </div>
  );
}

/* ═══ Step 2 — Réseaux Sociaux ═══ */
function Step2({ data, onChange }) {
  return (
    <div className="wizard-step">
      <h2>Réseaux Sociaux</h2>
      <p className="wizard-step-desc">Renseignez les liens des réseaux sociaux du client.</p>
      <div className="form-group">
        <label className="form-label" htmlFor="instagram_handle">Instagram *</label>
        <input id="instagram_handle" name="instagram_handle" className="form-input" placeholder="@moncompte ou URL" value={data.instagram_handle} onChange={onChange} />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="facebook_url">Facebook</label>
          <input id="facebook_url" name="facebook_url" className="form-input" placeholder="https://www.facebook.com/..." value={data.facebook_url} onChange={onChange} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="linkedin_url">LinkedIn</label>
          <input id="linkedin_url" name="linkedin_url" className="form-input" placeholder="https://www.linkedin.com/..." value={data.linkedin_url} onChange={onChange} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="tiktok_url">TikTok</label>
          <input id="tiktok_url" name="tiktok_url" className="form-input" placeholder="https://www.tiktok.com/@..." value={data.tiktok_url} onChange={onChange} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="google_business_url">Google Business</label>
          <input id="google_business_url" name="google_business_url" className="form-input" placeholder="URL Google Business Profile" value={data.google_business_url} onChange={onChange} />
        </div>
      </div>
    </div>
  );
}

/* ═══ Step 3 — Publicité & Marketing ═══ */
function Step3({ data, onChange, set }) {
  return (
    <div className="wizard-step">
      <h2>Publicité & Marketing</h2>
      <p className="wizard-step-desc">Évaluez la stratégie publicitaire actuelle du client.</p>

      <fieldset className="wizard-fieldset">
        <legend>Publicité en ligne active ?</legend>
        <div className="wizard-radio-grid">
          <RadioCard name="ads_active" value="oui_suivi" label="Oui, avec suivi des performances" sub="Google Ads, Meta Ads avec KPIs suivis" checked={data.ads_active} onChange={set} />
          <RadioCard name="ads_active" value="oui_sans_suivi" label="Oui, mais sans vrai suivi" sub="Des pubs tournent mais pas de tableau de bord" checked={data.ads_active} onChange={set} />
          <RadioCard name="ads_active" value="interesse" label="Non, mais intéressé" sub="Souhaite commencer la publicité en ligne" checked={data.ads_active} onChange={set} />
          <RadioCard name="ads_active" value="non" label="Non, pas de publicité" sub="Aucune publicité en ligne actuellement" checked={data.ads_active} onChange={set} />
        </div>
      </fieldset>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Budget mensuel marketing</label>
          <select name="budget" className="form-input" value={data.budget} onChange={onChange}>
            <option value="">— Sélectionner —</option>
            <option value="moins_500">Moins de 500€</option>
            <option value="500_1000">500€ - 1 000€</option>
            <option value="1000_2000">1 000€ - 2 000€</option>
            <option value="plus_2000">Plus de 2 000€</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Suivi des conversions</label>
          <select name="conversion_tracking" className="form-input" value={data.conversion_tracking} onChange={onChange}>
            <option value="">Pas de suivi</option>
            <option value="basique">Basique (Analytics)</option>
            <option value="complet">Complet (Pixels + Events)</option>
          </select>
        </div>
      </div>

      <fieldset className="wizard-fieldset">
        <legend>Stratégie d&apos;acquisition</legend>
        <div className="wizard-radio-grid">
          <RadioCard name="acquisition_strategy" value="multi_canal" label="Multi-canal" sub="SEO + Ads + Social + Email" checked={data.acquisition_strategy} onChange={set} />
          <RadioCard name="acquisition_strategy" value="mono_canal" label="Un seul canal" sub="Un canal principal uniquement" checked={data.acquisition_strategy} onChange={set} />
          <RadioCard name="acquisition_strategy" value="organique" label="Organique seulement" sub="Pas de budget publicitaire" checked={data.acquisition_strategy} onChange={set} />
          <RadioCard name="acquisition_strategy" value="aucune" label="Pas de stratégie" sub="Aucune stratégie définie" checked={data.acquisition_strategy} onChange={set} />
        </div>
      </fieldset>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Avis clients visibles</label>
          <select name="reviews" className="form-input" value={data.reviews} onChange={onChange}>
            <option value="">Aucun avis visible</option>
            <option value="quelques">Quelques avis</option>
            <option value="nombreux">Nombreux avis</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Cohérence visuelle du branding (1-5)</label>
          <select name="visual_coherence" className="form-input" value={data.visual_coherence} onChange={onChange}>
            <option value="1">1 — Pas de charte graphique</option>
            <option value="2">2 — Basique</option>
            <option value="3">3 — Correcte</option>
            <option value="4">4 — Bonne</option>
            <option value="5">5 — Excellente</option>
          </select>
        </div>
      </div>
    </div>
  );
}

/* ═══ Step 4 — Contact ═══ */
function Step4({ data, onChange, set }) {
  return (
    <div className="wizard-step">
      <h2>Contact du client</h2>
      <p className="wizard-step-desc">Coordonnées du contact principal chez le client.</p>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="contact_firstname">Prénom</label>
          <input id="contact_firstname" name="contact_firstname" className="form-input" placeholder="Jean" value={data.contact_firstname} onChange={onChange} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="contact_lastname">Nom</label>
          <input id="contact_lastname" name="contact_lastname" className="form-input" placeholder="Dupont" value={data.contact_lastname} onChange={onChange} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="contact_email">✉️ Email</label>
          <input id="contact_email" name="contact_email" type="email" className="form-input" placeholder="jean@exemple.fr" value={data.contact_email} onChange={onChange} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="contact_phone">📞 Téléphone</label>
          <input id="contact_phone" name="contact_phone" className="form-input" placeholder="06 12 34 56 78" value={data.contact_phone} onChange={onChange} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="contact_notes">Notes additionnelles</label>
        <textarea id="contact_notes" name="contact_notes" className="form-input" rows="3" placeholder="Informations complémentaires sur le client, objectifs, contexte..." value={data.contact_notes} onChange={onChange} />
      </div>
      <fieldset className="wizard-fieldset">
        <legend>Objectif principal du client</legend>
        <div className="wizard-radio-grid">
          <RadioCard name="client_objective" value="leads" label="🎯 Générer des leads" checked={data.client_objective} onChange={set} />
          <RadioCard name="client_objective" value="visibilite" label="👁 Augmenter la visibilité" checked={data.client_objective} onChange={set} />
          <RadioCard name="client_objective" value="image" label="💎 Améliorer l&apos;image" checked={data.client_objective} onChange={set} />
          <RadioCard name="client_objective" value="produit" label="🚀 Lancer un produit" checked={data.client_objective} onChange={set} />
        </div>
      </fieldset>
    </div>
  );
}

/* ═══ Step 5 — Résumé ═══ */
function Step5({ data }) {
  const analyses = [
    { icon: '🌐', label: 'Analyse site web (Google PageSpeed + SEO)', active: !!data.website_url },
    { icon: '📸', label: 'Analyse Instagram (Apify)', active: !!data.instagram_handle },
    { icon: '🔗', label: 'Vérification présence réseaux sociaux', active: true },
    { icon: '📊', label: 'Calcul des scores & recommandations', active: true },
  ];

  return (
    <div className="wizard-step">
      <h2>Lancer l&apos;audit</h2>
      <p className="wizard-step-desc">Vérifiez les informations et lancez l&apos;analyse automatisée.</p>

      <div className="wizard-review-card">
        <h3>📋 Résumé</h3>
        <div className="wizard-review-grid">
          <ReviewRow label="Entreprise" value={data.company_name} />
          <ReviewRow label="Site web" value={data.website_url} />
          <ReviewRow label="Instagram" value={data.instagram_handle} />
          {data.facebook_url && <ReviewRow label="Facebook" value={data.facebook_url} />}
          {data.linkedin_url && <ReviewRow label="LinkedIn" value={data.linkedin_url} />}
          {data.contact_firstname && <ReviewRow label="Contact" value={`${data.contact_firstname} ${data.contact_lastname}`.trim()} />}
        </div>
      </div>

      <div className="wizard-review-card" style={{ marginTop: '1.5rem' }}>
        <h3>⚡ Analyses automatiques</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          Les analyses suivantes seront lancées automatiquement :
        </p>
        {analyses.map((a, i) => (
          <div key={i} className="wizard-analysis-item">
            <span>{a.icon}</span>
            <span style={{ color: a.active ? 'var(--color-success)' : 'var(--text-muted)' }}>{a.label}</span>
            <span style={{ marginLeft: 'auto' }}>{a.active ? '✅' : '⬜'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══ Shared Components ═══ */
function RadioCard({ name, value, label, sub, checked, onChange }) {
  return (
    <label className={`wizard-radio-card ${checked === value ? 'selected' : ''}`}>
      <input type="radio" name={name} value={value} checked={checked === value} onChange={() => onChange(name, value)} />
      <div>
        <strong>{label}</strong>
        {sub && <span className="wizard-radio-sub">{sub}</span>}
      </div>
    </label>
  );
}

function ReviewRow({ label, value }) {
  return (
    <div className="wizard-review-row">
      <strong>{label} :</strong> <span>{value || 'Non renseigné'}</span>
    </div>
  );
}
