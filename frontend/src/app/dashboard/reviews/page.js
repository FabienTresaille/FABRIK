'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import ReviewCard from '../../../components/ReviewCard';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.fabrik.alsek.fr';

export default function ReviewsPage() {
  const { token } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterClient, setFilterClient] = useState('');
  const [filterRating, setFilterRating] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Load data
  useEffect(() => {
    if (!token) return;
    Promise.all([
      fetch(`${API_URL}/api/v1/reviews/global`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
      fetch(`${API_URL}/api/v1/reviews/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
      fetch(`${API_URL}/api/v1/clients`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
    ])
      .then(([reviewsData, statsData, clientsData]) => {
        setReviews(reviewsData);
        setStats(statsData);
        setClients(clientsData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token]);

  // Apply filters
  const loadFiltered = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterClient) params.append('client_id', filterClient);
    if (filterRating) params.append('rating_filter', filterRating);
    if (filterStatus) params.append('status_filter', filterStatus);

    try {
      const res = await fetch(`${API_URL}/api/v1/reviews/global?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setReviews(data);
      }
    } catch (err) {
      console.error('Erreur filtrage:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (token) loadFiltered();
  }, [filterClient, filterRating, filterStatus]);

  const handleRegenerate = async (reviewId) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/reviews/${reviewId}/suggestion`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setReviews((prev) =>
          prev.map((r) =>
            r.id === reviewId
              ? { ...r, reply_suggestion: data.reply_suggestion, language: data.language }
              : r
          )
        );
      }
    } catch (err) {
      console.error('Erreur régénération:', err);
    }
  };

  const handleMarkRead = async (reviewId) => {
    try {
      await fetch(`${API_URL}/api/v1/reviews/${reviewId}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      setReviews((prev) =>
        prev.map((r) => (r.id === reviewId ? { ...r, is_read: true } : r))
      );
    } catch (err) {
      console.error('Erreur marquage lu:', err);
    }
  };

  const handleUpdateStatus = async (reviewId, status) => {
    try {
      await fetch(`${API_URL}/api/v1/reviews/${reviewId}/status?status=${status}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      setReviews((prev) =>
        prev.map((r) => (r.id === reviewId ? { ...r, reply_status: status } : r))
      );
    } catch (err) {
      console.error('Erreur mise à jour statut:', err);
    }
  };

  if (loading && reviews.length === 0) {
    return (
      <div className="dash-loading">
        <div className="loading-orb" />
        <div className="loading-text">Chargement des avis...</div>
      </div>
    );
  }

  return (
    <div className="reviews-page" id="reviews-page">
      {/* Header */}
      <div className="reviews-header">
        <div className="reviews-header-left">
          <img src="/logo.png" alt="FABRIK" className="reviews-logo" />
          <div>
            <h1 className="reviews-title">⭐ Flux Global des Avis</h1>
            <p className="reviews-subtitle">
              Tous les avis Google de vos clients, centralisés avec suggestions IA
            </p>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="reviews-stats-bar">
          <div className="reviews-stat">
            <span className="reviews-stat-value">{stats.total_reviews}</span>
            <span className="reviews-stat-label">Total avis</span>
          </div>
          <div className="reviews-stat">
            <span className="reviews-stat-value">
              {stats.avg_rating ? `${stats.avg_rating}★` : '—'}
            </span>
            <span className="reviews-stat-label">Note moyenne</span>
          </div>
          <div className="reviews-stat">
            <span className="reviews-stat-value highlight-warning">
              {stats.pending_replies}
            </span>
            <span className="reviews-stat-label">En attente</span>
          </div>
          <div className="reviews-stat">
            <span className="reviews-stat-value highlight-info">{stats.unread_count}</span>
            <span className="reviews-stat-label">Non lus</span>
          </div>
          <div className="reviews-stat">
            <span className="reviews-stat-value highlight-danger">
              {stats.low_rating_count}
            </span>
            <span className="reviews-stat-label">Notes ≤ 2★</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="reviews-filters">
        <select
          className="reviews-filter-select"
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
          id="reviews-filter-client"
        >
          <option value="">Tous les clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.company_name}
            </option>
          ))}
        </select>

        <select
          className="reviews-filter-select"
          value={filterRating}
          onChange={(e) => setFilterRating(e.target.value)}
          id="reviews-filter-rating"
        >
          <option value="">Toutes les notes</option>
          <option value="5">★★★★★ (5)</option>
          <option value="4">★★★★☆ (4)</option>
          <option value="3">★★★☆☆ (3)</option>
          <option value="2">★★☆☆☆ (2)</option>
          <option value="1">★☆☆☆☆ (1)</option>
        </select>

        <select
          className="reviews-filter-select"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          id="reviews-filter-status"
        >
          <option value="">Tous les statuts</option>
          <option value="pending">⏳ En attente</option>
          <option value="replied">✅ Répondu</option>
          <option value="dismissed">❌ Ignoré</option>
        </select>
      </div>

      {/* Reviews Feed */}
      <div className="reviews-feed">
        {reviews.length === 0 ? (
          <div className="reviews-empty">
            <div className="reviews-empty-icon">⭐</div>
            <h3>Aucun avis pour le moment</h3>
            <p>Les avis apparaîtront ici dès qu'ils seront synchronisés depuis Google Business Profile via n8n.</p>
          </div>
        ) : (
          reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              showClientName={true}
              onRegenerate={handleRegenerate}
              onMarkRead={handleMarkRead}
              onUpdateStatus={handleUpdateStatus}
            />
          ))
        )}
      </div>
    </div>
  );
}
