'use client';

import { useState, useEffect, useRef } from 'react';
import Header from '../../components/Header';
import { useAuth } from '../../components/AuthProvider';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.fabrik.alsek.fr';
const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '';

export default function LoginPage() {
  const { login: authLogin } = useAuth();
  const recaptchaRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaLoaded, setCaptchaLoaded] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
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
    window.onRecaptchaLoginSuccess = (token) => {
      setCaptchaToken(token);
    };
    window.onRecaptchaLoginExpired = () => {
      setCaptchaToken('');
    };

    return () => {
      delete window.onRecaptchaLoginSuccess;
      delete window.onRecaptchaLoginExpired;
    };
  }, []);

  // Rendre le widget reCAPTCHA quand le script est chargé
  useEffect(() => {
    if (captchaLoaded && recaptchaRef.current && RECAPTCHA_SITE_KEY) {
      // Petit délai pour s'assurer que grecaptcha est prêt
      const timer = setTimeout(() => {
        if (window.grecaptcha && window.grecaptcha.render && recaptchaRef.current.childElementCount === 0) {
          window.grecaptcha.render(recaptchaRef.current, {
            sitekey: RECAPTCHA_SITE_KEY,
            callback: 'onRecaptchaLoginSuccess',
            'expired-callback': 'onRecaptchaLoginExpired',
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Vérifier CAPTCHA (sauf en dev sans clé)
    if (RECAPTCHA_SITE_KEY && !captchaToken) {
      setError('Veuillez compléter le CAPTCHA.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          captcha_token: captchaToken || 'dev-bypass',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Identifiants incorrects.');
      }

      // Mettre à jour l'état auth et rediriger
      authLogin(data.access_token, data.user);
    } catch (err) {
      setError(err.message);
      // Reset le CAPTCHA
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
          <div className="auth-card" id="login-card">
            <h2>Connexion</h2>
            <p className="auth-card-desc">
              Connectez-vous pour accéder à votre espace FABRIK.
            </p>

            <form onSubmit={handleSubmit} id="login-form">
              <div className="form-group">
                <label className="form-label" htmlFor="login-email">
                  Email
                </label>
                <input
                  id="login-email"
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

              <div className="form-group">
                <label className="form-label" htmlFor="login-password">
                  Mot de passe
                </label>
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  autoComplete="current-password"
                />
              </div>

              {/* reCAPTCHA v2 */}
              <div className="form-group captcha-container">
                <div ref={recaptchaRef} id="login-recaptcha"></div>
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
                id="login-submit-btn"
              >
                {loading ? (
                  <>
                    <span className="btn-spinner" />
                    Connexion...
                  </>
                ) : (
                  '🔑 Se connecter'
                )}
              </button>
            </form>

            <div className="auth-switch">
              Pas encore de compte ?{' '}
              <a href="/register">Créer un compte</a>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
