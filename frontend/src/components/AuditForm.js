'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.fabrik.alsek.fr';

export default function AuditForm() {
  const router = useRouter();
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    company_name: '',
    website_url: '',
    instagram_handle: '',
    contact_email: '',
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/v1/audit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new Error('Session expirée. Veuillez vous reconnecter.');
        }
        throw new Error(data.detail || `Erreur serveur (${response.status})`);
      }

      const data = await response.json();
      // Redirection vers la page de résultat
      router.push(`/audit/${data.id}`);
    } catch (err) {
      setError(err.message || 'Une erreur est survenue. Veuillez réessayer.');
      setLoading(false);
    }
  };

  return (
    <div className="audit-card" id="audit-form-card">
      <h2>Lancez votre audit 360°</h2>
      <p className="audit-card-desc">
        Renseignez les informations de votre entreprise pour obtenir votre
        diagnostic complet.
      </p>

      <form onSubmit={handleSubmit} id="audit-form">
        <div className="form-group">
          <label className="form-label" htmlFor="company_name">
            Nom de l'entreprise
          </label>
          <input
            id="company_name"
            name="company_name"
            type="text"
            className="form-input"
            placeholder="Ex : Mon Entreprise"
            value={formData.company_name}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="website_url">
              URL du site web
            </label>
            <input
              id="website_url"
              name="website_url"
              type="text"
              className="form-input"
              placeholder="https://example.com"
              value={formData.website_url}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="instagram_handle">
              Instagram
            </label>
            <input
              id="instagram_handle"
              name="instagram_handle"
              type="text"
              className="form-input"
              placeholder="@moncompte"
              value={formData.instagram_handle}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="contact_email">
            Email de contact (optionnel)
          </label>
          <input
            id="contact_email"
            name="contact_email"
            type="email"
            className="form-input"
            placeholder="contact@example.com"
            value={formData.contact_email}
            onChange={handleChange}
          />
        </div>

        {error && (
          <div className="auth-error">⚠️ {error}</div>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
          id="audit-submit-btn"
        >
          {loading ? (
            <>
              <span className="btn-spinner" />
              Analyse en cours...
            </>
          ) : (
            <>
              🚀 Lancer l'audit gratuit
            </>
          )}
        </button>
      </form>
    </div>
  );
}
