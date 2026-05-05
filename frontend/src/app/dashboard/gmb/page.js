'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../components/AuthProvider';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.fabrik.alsek.fr';

const DAYS_OPTIONS = [
  { value: 'monday', label: 'Lundi' },
  { value: 'tuesday', label: 'Mardi' },
  { value: 'wednesday', label: 'Mercredi' },
  { value: 'thursday', label: 'Jeudi' },
  { value: 'friday', label: 'Vendredi' },
  { value: 'saturday', label: 'Samedi' },
  { value: 'sunday', label: 'Dimanche' },
];

export default function GMBConfigPage() {
  const { token } = useAuth();
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Form state
  const [gmbActive, setGmbActive] = useState(false);
  const [megaFolderUrl, setMegaFolderUrl] = useState('');
  const [gmbLocationId, setGmbLocationId] = useState('');
  const [scheduleDays, setScheduleDays] = useState(['tuesday', 'friday']);
  const [scheduleTime, setScheduleTime] = useState('10:00');

  // Charger la liste des clients
  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/v1/clients`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setClients(data);
        if (data.length > 0 && !selectedClientId) {
          setSelectedClientId(data[0].id);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token]);

  // Charger la config GMB du client sélectionné
  const loadConfig = useCallback(async () => {
    if (!selectedClientId || !token) return;
    try {
      const res = await fetch(`${API_URL}/api/v1/gmb/config/${selectedClientId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        setGmbActive(data.gmb_active || false);
        setMegaFolderUrl(data.mega_folder_url || '');
        setGmbLocationId(data.gmb_location_id || '');
        setScheduleDays(data.gmb_schedule?.days || ['tuesday', 'friday']);
        setScheduleTime(data.gmb_schedule?.time || '10:00');
      }
    } catch (err) {
      console.error('Erreur chargement config GMB:', err);
    }
  }, [selectedClientId, token]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Sauvegarder la config
  const handleSave = async () => {
    if (!selectedClientId) return;
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`${API_URL}/api/v1/gmb/config/${selectedClientId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gmb_active: gmbActive,
          mega_folder_url: megaFolderUrl || null,
          gmb_location_id: gmbLocationId || null,
          gmb_schedule: { days: scheduleDays, time: scheduleTime },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        setMessage({ type: 'success', text: 'Configuration sauvegardée avec succès !' });
      } else {
        setMessage({ type: 'error', text: 'Erreur lors de la sauvegarde.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Erreur réseau.' });
    }
    setSaving(false);
  };

  const toggleDay = (day) => {
    setScheduleDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const nextFileIndex = (config?.last_posted_index || 0) + 1;
  const nextFileName = `${String(nextFileIndex).padStart(2, '0')}.jpg`;

  if (loading) {
    return (
      <div className="dash-loading">
        <div className="loading-orb" />
        <div className="loading-text">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="gmb-page" id="gmb-config-page">
      {/* Header */}
      <div className="gmb-header">
        <div className="gmb-header-left">
          <img src="/logo.png" alt="FABRIK" className="gmb-logo" />
          <div>
            <h1 className="gmb-title">📡 GMB Auto-Poster</h1>
            <p className="gmb-subtitle">
              Publication automatique sur Google My Business depuis MEGA
            </p>
          </div>
        </div>
      </div>

      {/* Client Selector */}
      <div className="gmb-selector">
        <label className="gmb-label">Client</label>
        <select
          id="gmb-client-select"
          className="gmb-select"
          value={selectedClientId || ''}
          onChange={(e) => setSelectedClientId(Number(e.target.value))}
        >
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.company_name}
            </option>
          ))}
        </select>
      </div>

      {/* Config Card */}
      <div className="gmb-config-grid">
        {/* Activation */}
        <div className="gmb-card">
          <div className="gmb-card-header">
            <h3>Activation</h3>
            <div
              className={`gmb-toggle ${gmbActive ? 'active' : ''}`}
              onClick={() => setGmbActive(!gmbActive)}
              id="gmb-toggle-active"
            >
              <div className="gmb-toggle-thumb" />
            </div>
          </div>
          <p className="gmb-card-desc">
            {gmbActive
              ? '✅ La publication automatique est activée'
              : '⏸️ La publication automatique est désactivée'}
          </p>

          {/* Status badges */}
          <div className="gmb-status-badges">
            <div className={`gmb-badge ${config?.google_connected ? 'connected' : 'disconnected'}`}>
              {config?.google_connected ? '🟢 Google connecté' : '🔴 Google non connecté'}
            </div>
            <div className="gmb-badge info">
              📂 Prochain fichier : <strong>{nextFileName}</strong>
            </div>
            <div className="gmb-badge info">
              📊 Total publié : <strong>{config?.last_posted_index || 0}</strong>
            </div>
          </div>
        </div>

        {/* MEGA Config */}
        <div className="gmb-card">
          <h3>📂 Dossier MEGA</h3>
          <p className="gmb-card-desc">
            URL publique du dossier MEGA contenant les fichiers numérotés (01.jpg, 02.jpg...)
          </p>
          <input
            id="gmb-mega-url"
            type="url"
            className="gmb-input"
            placeholder="https://mega.nz/folder/..."
            value={megaFolderUrl}
            onChange={(e) => setMegaFolderUrl(e.target.value)}
          />
        </div>

        {/* Google Location */}
        <div className="gmb-card">
          <h3>📍 Google Business Profile</h3>
          <p className="gmb-card-desc">
            Identifiant de l'emplacement Google Business Profile du client
          </p>
          <input
            id="gmb-location-id"
            type="text"
            className="gmb-input"
            placeholder="locations/1234567890"
            value={gmbLocationId}
            onChange={(e) => setGmbLocationId(e.target.value)}
          />
          <p className="gmb-helper">
            💡 La connexion OAuth2 se fait via les credentials n8n
          </p>
        </div>

        {/* Schedule */}
        <div className="gmb-card gmb-card-wide">
          <h3>📅 Planning de publication</h3>
          <p className="gmb-card-desc">
            Sélectionnez les jours et l'heure de publication automatique
          </p>

          <div className="gmb-schedule-grid">
            <div className="gmb-days">
              {DAYS_OPTIONS.map((day) => (
                <button
                  key={day.value}
                  className={`gmb-day-btn ${scheduleDays.includes(day.value) ? 'active' : ''}`}
                  onClick={() => toggleDay(day.value)}
                >
                  {day.label}
                </button>
              ))}
            </div>
            <div className="gmb-time-picker">
              <label className="gmb-label">Heure</label>
              <input
                id="gmb-schedule-time"
                type="time"
                className="gmb-input gmb-time-input"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="gmb-actions">
        {message && (
          <div className={`gmb-message ${message.type}`}>{message.text}</div>
        )}
        <button
          id="gmb-save-btn"
          className="gmb-save-btn"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? '⏳ Sauvegarde...' : '💾 Sauvegarder la configuration'}
        </button>
      </div>
    </div>
  );
}
