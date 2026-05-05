'use client';

import { useState } from 'react';

export default function ReviewCard({
  review,
  showClientName = false,
  onRegenerate,
  onMarkRead,
  onUpdateStatus,
}) {
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);

  const ratingClass =
    review.rating >= 4
      ? 'rating-positive'
      : review.rating === 3
      ? 'rating-neutral'
      : 'rating-negative';

  const handleCopy = async () => {
    if (!review.reply_suggestion) return;
    try {
      await navigator.clipboard.writeText(review.reply_suggestion);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = review.reply_suggestion;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    await onRegenerate?.(review.id);
    setRegenerating(false);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div
      className={`review-card ${!review.is_read ? 'unread' : ''} ${ratingClass}`}
      id={`review-card-${review.id}`}
    >
      {/* Header */}
      <div className="review-card-header">
        <div className="review-card-meta">
          {showClientName && (
            <span className="review-client-badge">{review.company_name}</span>
          )}
          <span className="review-author">{review.author_name || 'Anonyme'}</span>
          <span className="review-date">{formatDate(review.created_at)}</span>
        </div>
        <div className="review-card-right">
          <span className={`review-stars ${ratingClass}`}>{stars}</span>
          {!review.is_read && (
            <button
              className="review-mark-read-btn"
              onClick={() => onMarkRead?.(review.id)}
              title="Marquer comme lu"
            >
              👁️
            </button>
          )}
        </div>
      </div>

      {/* Status badge */}
      <div className="review-status-row">
        <span className={`review-status-badge status-${review.reply_status}`}>
          {review.reply_status === 'pending' && '⏳ En attente'}
          {review.reply_status === 'replied' && '✅ Répondu'}
          {review.reply_status === 'dismissed' && '❌ Ignoré'}
        </span>
        <span className="review-lang-badge">
          {review.language === 'en' ? '🇬🇧 EN' : '🇫🇷 FR'}
        </span>
        {!review.is_read && <span className="review-unread-dot" />}
      </div>

      {/* Review text */}
      {review.text && (
        <div className="review-text">
          <p>"{review.text}"</p>
        </div>
      )}

      {/* AI Suggestion */}
      {review.reply_suggestion && (
        <div className="review-ai-block">
          <div className="review-ai-header">
            <span className="review-ai-label">🤖 Suggestion IA</span>
          </div>
          <div className="review-ai-text">
            <p>{review.reply_suggestion}</p>
          </div>
          <div className="review-ai-actions">
            <button
              className={`review-ai-btn copy ${copied ? 'copied' : ''}`}
              onClick={handleCopy}
              id={`review-copy-${review.id}`}
            >
              {copied ? '✅ Copié !' : '📋 Copier la réponse'}
            </button>
            <button
              className={`review-ai-btn regenerate ${regenerating ? 'loading' : ''}`}
              onClick={handleRegenerate}
              disabled={regenerating}
              id={`review-regenerate-${review.id}`}
            >
              {regenerating ? '⏳ Régénération...' : '🔄 Régénérer'}
            </button>
          </div>
        </div>
      )}

      {/* Status Actions */}
      {review.reply_status === 'pending' && (
        <div className="review-action-row">
          <button
            className="review-action-btn replied"
            onClick={() => onUpdateStatus?.(review.id, 'replied')}
          >
            ✅ Marquer comme répondu
          </button>
          <button
            className="review-action-btn dismissed"
            onClick={() => onUpdateStatus?.(review.id, 'dismissed')}
          >
            ❌ Ignorer
          </button>
        </div>
      )}
    </div>
  );
}
