'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.fabrik.alsek.fr';

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('fabrik_user');
    const storedToken = localStorage.getItem('fabrik_token');
    if (storedUser && storedToken) {
      const parsed = JSON.parse(storedUser);
      if (parsed.role !== 'admin') {
        router.push('/');
        return;
      }
      setUser(parsed);
      setToken(storedToken);
    } else {
      router.push('/login');
    }
  }, [router]);

  const fetchUsers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/api/v1/admin/users?status_filter=${filter}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (err) {
      console.error('Erreur chargement users:', err);
    } finally {
      setLoading(false);
    }
  }, [token, filter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const approveUser = async (userId) => {
    setActionLoading(userId);
    try {
      const response = await fetch(
        `${API_URL}/api/v1/admin/users/${userId}/approve`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.ok) {
        await fetchUsers();
      }
    } catch (err) {
      console.error('Erreur approbation:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const rejectUser = async (userId) => {
    if (!confirm('Êtes-vous sûr de vouloir rejeter cette inscription ?')) return;
    setActionLoading(userId);
    try {
      const response = await fetch(
        `${API_URL}/api/v1/admin/users/${userId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.ok) {
        await fetchUsers();
      }
    } catch (err) {
      console.error('Erreur rejet:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <>
      <Header />
      <main className="main-content">
        <div className="admin-page">
          <div className="admin-header">
            <h1>
              <span className="icon">⚙️</span> Administration
            </h1>
            <p className="admin-subtitle">
              Gérez les inscriptions et les utilisateurs de FABRIK.
            </p>
          </div>

          {/* Filtres */}
          <div className="admin-filters">
            {[
              { key: 'pending', label: '⏳ En attente', },
              { key: 'active', label: '✅ Actifs' },
              { key: 'all', label: '📋 Tous' },
            ].map((f) => (
              <button
                key={f.key}
                className={`admin-filter-btn ${filter === f.key ? 'active' : ''}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Liste */}
          <div className="admin-card">
            {loading ? (
              <div className="admin-loading">
                <span className="btn-spinner" /> Chargement...
              </div>
            ) : users.length === 0 ? (
              <div className="admin-empty">
                {filter === 'pending'
                  ? '🎉 Aucune inscription en attente.'
                  : 'Aucun utilisateur trouvé.'}
              </div>
            ) : (
              <table className="admin-table" id="users-table">
                <thead>
                  <tr>
                    <th>Utilisateur</th>
                    <th>Email</th>
                    <th>Rôle</th>
                    <th>Statut</th>
                    <th>Inscrit le</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="admin-user-name">
                        {u.full_name || '—'}
                      </td>
                      <td className="admin-user-email">{u.email}</td>
                      <td>
                        <span className={`admin-badge ${u.role === 'admin' ? 'admin-badge-admin' : 'admin-badge-client'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td>
                        <span className={`admin-badge ${u.is_active ? 'admin-badge-active' : 'admin-badge-pending'}`}>
                          {u.is_active ? 'Actif' : 'En attente'}
                        </span>
                      </td>
                      <td className="admin-date">{formatDate(u.created_at)}</td>
                      <td className="admin-actions">
                        {!u.is_active && u.role !== 'admin' && (
                          <>
                            <button
                              className="admin-btn admin-btn-approve"
                              onClick={() => approveUser(u.id)}
                              disabled={actionLoading === u.id}
                              id={`approve-btn-${u.id}`}
                            >
                              {actionLoading === u.id ? '...' : '✅ Approuver'}
                            </button>
                            <button
                              className="admin-btn admin-btn-reject"
                              onClick={() => rejectUser(u.id)}
                              disabled={actionLoading === u.id}
                              id={`reject-btn-${u.id}`}
                            >
                              🗑️ Rejeter
                            </button>
                          </>
                        )}
                        {u.is_active && u.role !== 'admin' && (
                          <button
                            className="admin-btn admin-btn-reject"
                            onClick={() => rejectUser(u.id)}
                            disabled={actionLoading === u.id}
                            id={`delete-btn-${u.id}`}
                          >
                            🗑️ Supprimer
                          </button>
                        )}
                        {u.role === 'admin' && (
                          <span className="admin-protected">🔒 Protégé</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
