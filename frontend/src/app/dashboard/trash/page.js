'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../../components/AuthProvider';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.fabrik.alsek.fr';

export default function TrashPage() {
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const headers = { Authorization: `Bearer ${token}` };

  const load = async () => {
    try {
      const res = await fetch(`${API}/api/v1/trash`, { headers });
      const data = await res.json();
      setItems(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (token) load();
  }, [token]);

  const handleRestore = async (type, id) => {
    try {
      await fetch(`${API}/api/v1/trash/restore/${type}/${id}`, { method: 'POST', headers });
      load();
    } catch (e) { console.error(e); }
  };

  const handleHardDelete = async (type, id) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer DÉFINITIVEMENT cet élément ? Cette action est irréversible.")) return;
    try {
      await fetch(`${API}/api/v1/trash/hard/${type}/${id}`, { method: 'DELETE', headers });
      load();
    } catch (e) { console.error(e); }
  };

  if (loading) return <div className="dash-loading"><div className="loading-orb" /><p>Chargement de la corbeille...</p></div>;

  return (
    <div className="dash-page">
      <div className="dash-page-header">
        <div>
          <h1>🗑️ Corbeille</h1>
          <p className="dash-page-subtitle">Les éléments seront supprimés définitivement après 30 jours.</p>
        </div>
      </div>

      <div className="dash-table-wrapper">
        <table className="dash-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Nom / ID</th>
              <th>Date de suppression</th>
              <th>Expire dans</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx}>
                <td>
                  <span className={`dash-phase-badge ${item.item_type === 'client' ? 'growth' : 'setup'}`}>
                    {item.item_type === 'client' ? '👤 Client' : '📋 Audit'}
                  </span>
                </td>
                <td className="dash-table-company">{item.name}</td>
                <td>{new Date(item.deleted_at).toLocaleDateString('fr-FR')}</td>
                <td>
                  <span style={{ color: item.expires_in_days <= 3 ? 'var(--color-danger)' : 'inherit', fontWeight: 'bold' }}>
                    {item.expires_in_days} jours
                  </span>
                </td>
                <td className="dash-table-actions">
                  <button className="dash-action-btn success" onClick={() => handleRestore(item.item_type, item.id)} title="Restaurer">
                    ♻️ Restaurer
                  </button>
                  <button className="dash-action-btn" onClick={() => handleHardDelete(item.item_type, item.id)} title="Supprimer définitivement" style={{color: 'var(--color-danger)'}}>
                    ❌ Supprimer
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                  La corbeille est vide.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
