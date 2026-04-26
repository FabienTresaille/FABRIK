'use client';

import { useAuth } from './AuthProvider';

export default function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="header" id="main-header">
      <div className="header-logo">
        <img src="/logo.png" alt="FABRIK Logo" width={36} height={36} />
        <div>
          <div className="header-logo-text">FABRIK</div>
          <div className="header-tagline">Business Partner IA</div>
        </div>
      </div>
      <nav className="header-nav" id="main-nav">
        <a href="/">Accueil</a>
        <a href="https://alsek.fr" target="_blank" rel="noopener noreferrer">
          Alsek Agency
        </a>
        {user ? (
          <>
            {user.role === 'admin' && (
              <>
                <a href="/dashboard" className="btn-header-admin" id="dashboard-link">
                  📊 Dashboard
                </a>
                <a href="/admin" className="btn-header-admin" id="admin-link">
                  ⚙️ Admin
                </a>
              </>
            )}
            <span className="header-user">
              {user.full_name || user.email}
            </span>
            <button
              onClick={logout}
              className="btn-header-logout"
              id="logout-btn"
            >
              Déconnexion
            </button>
          </>
        ) : (
          <a href="/login" className="btn-header-login">
            Se connecter
          </a>
        )}
      </nav>
    </header>
  );
}
