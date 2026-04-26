'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.fabrik.alsek.fr';
const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '';

export default function RegisterPage() {
  const router = useRouter();
  const recaptchaRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaLoaded, setCaptchaLoaded] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    password_confirm: '',
  });

  // Charger le script reCAPTCHA
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.grecaptcha) {
      const script = document.createElement('script');
      script.src = 'https://www.google.com/recaptcha/api.js';
      script.async = true;
      script.defer = true;
      script.onload = () => setCaptchaLoaded(true);
      document.head.appendChild(script);
    } else if (window.grecaptcha) {
      setCaptchaLoaded(true);
    }

    // Callback globale pour reCAPTCHA
    window.onRecaptchaRegisterSuccess = (token) => {
      setCaptchaToken(token);
    };
    window.onRecaptchaRegisterExpired = () => {
      setCaptchaToken('');
    };

    return () => {
      delete window.onRecaptchaRegisterSuccess;
      delete window.onRecaptchaRegisterExpired;
    };
  }, []);

  // Rendre le widget reCAPTCHA
  useEffect(() => {
    if (captchaLoaded && recaptchaRef.current && RECAPTCHA_SITE_KEY) {
      const timer = setTimeout(() => {
        if (window.grecaptcha && window.grecaptcha.render && recaptchaRef.current.childElementCount === 0) {
          window.grecaptcha.render(recaptchaRef.current, {
            sitekey: RECAPTCHA_SITE_KEY,
            callback: 'onRecaptchaRegisterSuccess',
            'expired-callback': 'onRecaptchaRegisterExpired',
            theme: 'dark',
          });
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [captchaLoaded]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError(null);
  };

  const [success, setSuccess] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation locale
    if (formData.password !== formData.password_confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    if (formData.password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    if (RECAPTCHA_SITE_KEY && !captchaToken) {
      setError('Veuillez compléter le CAPTCHA.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          captcha_token: captchaToken || 'dev-bypass',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Erreur lors de l\'inscription.');
      }

      // Vérifier si le compte est en attente d'approbation
      if (data.pending_approval) {
        setSuccess(data.message);
      } else {
        // Admin → connexion immédiate
        localStorage.setItem('fabrik_token', data.access_token);
        localStorage.setItem('fabrik_user', JSON.stringify(data.user));
        router.push('/');
      }
    } catch (err) {
      setError(err.message);
      if (window.grecaptcha) {
        window.grecaptcha.reset();
        setCaptchaToken('');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header />
      <main className="main-content">
        <section className="auth-page">
          <div className="auth-card" id="register-card">
            {success ? (
              <div className="auth-success" id="register-success">
                <div className="auth-success-icon">✅</div>
                <h2>Inscription enregistrée !</h2>
                <p className="auth-success-message">{success}</p>
                <a href="/login" className="btn btn-primary" style={{ marginTop: '1.5rem' }}>
                  ← Retour à la connexion
                </a>
              </div>
            ) : (
            <>
            <h2>Créer un compte</h2>
            <p className="auth-card-desc">
              Inscrivez-vous pour lancer votre premier audit 360°.
            </p>

            <form onSubmit={handleSubmit} id="register-form">
              <div className="form-group">
                <label className="form-label" htmlFor="register-name">
                  Nom complet
                </label>
                <input
                  id="register-name"
                  name="full_name"
                  type="text"
                  className="form-input"
                  placeholder="Jean Dupont"
                  value={formData.full_name}
                  onChange={handleChange}
                  required
                  autoComplete="name"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="register-email">
                  Email
                </label>
                <input
                  id="register-email"
                  name="email"
                  type="email"
                  className="form-input"
                  placeholder="votre@email.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="register-password">
                    Mot de passe
                  </label>
                  <input
                    id="register-password"
                    name="password"
                    type="password"
                    className="form-input"
                    placeholder="Min. 6 caractères"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    autoComplete="new-password"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="register-password-confirm">
                    Confirmer
                  </label>
                  <input
                    id="register-password-confirm"
                    name="password_confirm"
                    type="password"
                    className="form-input"
                    placeholder="Confirmer"
                    value={formData.password_confirm}
                    onChange={handleChange}
                    required
                    autoComplete="new-password"
                  />
                </div>
              </div>

              {/* reCAPTCHA v2 */}
              <div className="form-group captcha-container">
                <div ref={recaptchaRef} id="register-recaptcha"></div>
                {!RECAPTCHA_SITE_KEY && (
                  <div className="captcha-dev-notice">
                    ℹ️ CAPTCHA désactivé (mode développement)
                  </div>
                )}
              </div>

              {error && (
                <div className="auth-error">⚠️ {error}</div>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                id="register-submit-btn"
              >
                {loading ? (
                  <>
                    <span className="btn-spinner" />
                    Inscription...
                  </>
                ) : (
                  '🚀 Créer mon compte'
                )}
              </button>
            </form>

            <div className="auth-switch">
              Déjà un compte ?{' '}
              <a href="/login">Se connecter</a>
            </div>
            </>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
