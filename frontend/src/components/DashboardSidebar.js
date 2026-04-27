'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';
import Link from 'next/link';

export default function DashboardSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const isAgency = pathname.startsWith('/dashboard/agency');

  return (
    <aside className="dash-sidebar" id="dashboard-sidebar">
      {/* Logo */}
      <div className="dash-sidebar-logo">
        <div className="dash-sidebar-logo-icon">BP</div>
        <div>
          <div className="dash-sidebar-logo-text">Business Partner IA</div>
        </div>
      </div>

      {/* Toggle */}
      <div className="dash-toggle">
        <Link
          href="/dashboard/clients"
          className={`dash-toggle-btn ${!isAgency ? 'active' : ''}`}
        >
          Vue Client
        </Link>
        <Link
          href="/dashboard/agency"
          className={`dash-toggle-btn ${isAgency ? 'active' : ''}`}
        >
          Vue Agence
        </Link>
      </div>

      {/* Nav */}
      <div className="dash-sidebar-section">
        <div className="dash-sidebar-label">TABLEAU DE BORD</div>
        <NavItem href="/dashboard/agency" icon="📊" label="Vue d'ensemble" active={pathname === '/dashboard/agency'} />
        <NavItem href="/dashboard/agency#pipeline" icon="🚀" label="Pipeline" active={false} />
        <NavItem href="/dashboard/clients" icon="👥" label="Clients" active={pathname === '/dashboard/clients'} />
      </div>

      <div className="dash-sidebar-section">
        <div className="dash-sidebar-label">OUTILS</div>
        <NavItem href="/" icon="🔍" label="Nouvel audit" active={false} />
        <NavItem href="/admin" icon="⚙️" label="Administration" active={false} />
        <NavItem href="/dashboard/trash" icon="🗑️" label="Corbeille" active={pathname === '/dashboard/trash'} />
      </div>

      {/* User */}
      <div className="dash-sidebar-footer">
        <div className="dash-sidebar-user">
          <div className="dash-sidebar-user-avatar">{user?.full_name?.[0] || '?'}</div>
          <div>
            <div className="dash-sidebar-user-name">{user?.full_name || user?.email}</div>
            <div className="dash-sidebar-user-role">{user?.role === 'admin' ? 'Administrateur' : 'Client'}</div>
          </div>
        </div>
        <button className="dash-sidebar-logout" onClick={logout}>↪</button>
      </div>
    </aside>
  );
}

function NavItem({ href, icon, label, active }) {
  return (
    <Link href={href} className={`dash-nav-item ${active ? 'active' : ''}`}>
      <span className="dash-nav-icon">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
