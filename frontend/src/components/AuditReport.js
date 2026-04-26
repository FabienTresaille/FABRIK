'use client';

/**
 * AuditReport — Rapport d'audit 360° client-ready.
 * Sections : Vue d'ensemble, Synthèse IA, Site Web, Instagram, Recommandations, CTA.
 * Inspiré de la maquette audit-app (alsek).
 */

export default function AuditReport({ audit }) {
  if (!audit) return null;

  const { scores, pagespeed_data, apify_data, gemini_synthesis } = audit;
  const parsed = parseGeminiSynthesis(gemini_synthesis);

  return (
    <div id="audit-report">
      {/* ═══ VUE D'ENSEMBLE — 3 Piliers ═══ */}
      <section className="rpt-section">
        <div className="rpt-section-header">
          <div className="rpt-section-icon">📊</div>
          <h2 className="rpt-section-title">Vue d&apos;ensemble</h2>
          <div className="rpt-divider" />
          <p className="rpt-section-subtitle">
            Votre présence digitale analysée sur 3 piliers fondamentaux
          </p>
        </div>

        <div className="rpt-pillars">
          <PillarCard
            icon="🌐"
            title="Performance Web"
            score={scores?.score_performance}
          />
          <PillarCard
            icon="🔍"
            title="Référencement SEO"
            score={scores?.score_seo}
          />
          <PillarCard
            icon="📱"
            title="Réseaux Sociaux"
            score={scores?.score_social}
          />
        </div>
      </section>

      {/* ═══ SYNTHÈSE IA ═══ */}
      {parsed && (
        <section className="rpt-section">
          <div className="rpt-section-header">
            <div className="rpt-section-icon">📋</div>
            <h2 className="rpt-section-title">Synthèse Stratégique</h2>
            <div className="rpt-divider" />
          </div>

          <div className="rpt-summary-grid">
            <SummaryCard
              type="strengths"
              icon="💪"
              title="Points Forts"
              items={parsed.strengths}
            />
            <SummaryCard
              type="weaknesses"
              icon="⚠️"
              title="Axes d'Amélioration"
              items={parsed.weaknesses}
            />
            <SummaryCard
              type="opportunities"
              icon="🚀"
              title="Opportunités"
              items={parsed.opportunities}
            />
          </div>

          {/* Texte complet si parsing partiel */}
          {parsed.rawContent && (
            <div className="rpt-synthesis-raw">
              <div
                dangerouslySetInnerHTML={{ __html: formatMarkdown(parsed.rawContent) }}
              />
            </div>
          )}
        </section>
      )}

      {/* ═══ PILIER 1 — SITE WEB ═══ */}
      {pagespeed_data?.success && (
        <section className="rpt-section">
          <div className="rpt-section-header">
            <div className="rpt-section-icon">🌐</div>
            <h2 className="rpt-section-title">Pilier 1 — Site Web</h2>
            <div className="rpt-divider" />
            <p className="rpt-section-subtitle">
              Analyse technique de votre site via Google PageSpeed Insights
            </p>
          </div>

          <PageSpeedSection data={pagespeed_data} />
        </section>
      )}

      {/* ═══ PILIER 2 — INSTAGRAM ═══ */}
      {apify_data?.found && (
        <section className="rpt-section">
          <div className="rpt-section-header">
            <div className="rpt-section-icon">📸</div>
            <h2 className="rpt-section-title">Pilier 2 — Contenu & Image</h2>
            <div className="rpt-divider" />
            <p className="rpt-section-subtitle">
              Analyse de votre présence Instagram et stratégie de contenu
            </p>
          </div>

          <InstagramSection data={apify_data} />
        </section>
      )}

      {/* ═══ RECOMMANDATIONS ═══ */}
      {parsed?.recommendations?.length > 0 && (
        <section className="rpt-section">
          <div className="rpt-section-header">
            <div className="rpt-section-icon">🎯</div>
            <h2 className="rpt-section-title">Actions Prioritaires</h2>
            <div className="rpt-divider" />
            <p className="rpt-section-subtitle">
              Les améliorations à fort impact pour transformer votre présence digitale
            </p>
          </div>

          <div className="rpt-recommendations">
            {parsed.recommendations.map((reco, idx) => (
              <RecommendationCard key={idx} index={idx + 1} reco={reco} />
            ))}
          </div>
        </section>
      )}

      {/* ═══ CTA — Prochaine étape ═══ */}
      <section className="rpt-cta">
        <h2 className="rpt-cta-title">
          <span className="gradient-text">Prochaine étape</span>
        </h2>
        <p className="rpt-cta-desc">
          Transformez ces recommandations en résultats concrets.<br />
          Réservez votre <strong>appel stratégique gratuit de 30 minutes</strong> avec notre équipe.
        </p>
        <div className="rpt-cta-buttons">
          <a
            href="https://alsek.fr"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            id="cta-book-btn"
          >
            📞 Réserver un appel
          </a>
          <button
            className="btn btn-secondary"
            onClick={() => window.print()}
            id="cta-print-btn"
          >
            🖨️ Imprimer le rapport
          </button>
        </div>
      </section>

      {/* ═══ Toolbar flottante ═══ */}
      <div className="rpt-toolbar no-print">
        <button
          className="rpt-toolbar-btn"
          onClick={() => window.print()}
          title="Imprimer"
        >
          🖨️
        </button>
        <button
          className="rpt-toolbar-btn"
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            alert('Lien copié !');
          }}
          title="Partager"
        >
          🔗
        </button>
        <button
          className="rpt-toolbar-btn"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          title="Haut de page"
        >
          ⬆️
        </button>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════ */

/* ── Pillar Card ── */
function PillarCard({ icon, title, score }) {
  const s = score ?? 0;
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (s / 100) * circumference;
  const cls = getScoreClass(s);

  return (
    <div className={`rpt-pillar-card ${cls}`}>
      <div className="rpt-pillar-icon">{icon}</div>
      <div className="rpt-pillar-title">{title}</div>
      <div className="rpt-score-circle">
        <svg viewBox="0 0 100 100">
          <circle className="rpt-score-bg" cx="50" cy="50" r="42" />
          <circle
            className="rpt-score-fill"
            cx="50"
            cy="50"
            r="42"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <span className="rpt-score-value">{s}</span>
        <span className="rpt-score-label">/ 100</span>
      </div>
    </div>
  );
}

/* ── Summary Card ── */
function SummaryCard({ type, icon, title, items }) {
  if (!items || items.length === 0) return null;

  return (
    <div className={`rpt-summary-card rpt-summary-${type}`}>
      <div className="rpt-summary-card-icon">{icon}</div>
      <h3 className="rpt-summary-card-title">{title}</h3>
      <ul className="rpt-summary-list">
        {items.map((item, idx) => (
          <li key={idx}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/* ── PageSpeed Section ── */
function PageSpeedSection({ data }) {
  const mobile = data.mobile?.scores || {};
  const desktop = data.desktop?.scores || {};
  const cwv = data.mobile?.core_web_vitals || {};

  const categories = [
    { name: 'Performance', key: 'performance', icon: '⚡' },
    { name: 'SEO', key: 'seo', icon: '🔍' },
    { name: 'Accessibilité', key: 'accessibility', icon: '♿' },
    { name: 'Bonnes Pratiques', key: 'best_practices', icon: '✅' },
  ];

  return (
    <>
      {/* Scores comparatifs Mobile vs Desktop */}
      <div className="rpt-criteria-grid">
        {categories.map((cat) => {
          const mobileScore = mobile[cat.key] ?? 0;
          const desktopScore = desktop[cat.key] ?? 0;
          const avg = Math.round((mobileScore + desktopScore) / 2);

          return (
            <div key={cat.key} className="rpt-criterion-card">
              <div className="rpt-criterion-header">
                <span className="rpt-criterion-icon">{cat.icon}</span>
                <span className="rpt-criterion-name">{cat.name}</span>
                <span className={`rpt-criterion-score ${getScoreClass(avg)}`}>
                  {avg}/100
                </span>
              </div>
              <div className="rpt-criterion-detail">
                📱 Mobile : <MetricBadge value={mobileScore} /> &nbsp;
                💻 Desktop : <MetricBadge value={desktopScore} />
              </div>
              <div className="rpt-criterion-bar">
                <div
                  className={`rpt-criterion-bar-fill ${getScoreClass(avg)}`}
                  style={{ width: `${avg}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Core Web Vitals */}
      {Object.keys(cwv).length > 0 && (
        <div className="rpt-cwv">
          <h3 className="rpt-cwv-title">Core Web Vitals (Mobile)</h3>
          <div className="rpt-cwv-grid">
            {Object.entries(cwv).map(
              ([key, val]) =>
                val && (
                  <div key={key} className="rpt-cwv-item">
                    <div className="rpt-cwv-name">{formatCWVName(key)}</div>
                    <div className="rpt-cwv-value">{val.display || '—'}</div>
                    <MetricBadge value={val.score} />
                  </div>
                )
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* ── Instagram Section ── */
function InstagramSection({ data }) {
  const stats = [
    {
      label: 'Followers',
      value: data.followers?.toLocaleString('fr-FR') || '—',
      icon: '👥',
    },
    {
      label: 'Publications',
      value: data.posts_count || '—',
      icon: '📸',
    },
    {
      label: 'Engagement',
      value: data.engagement_rate ? `${data.engagement_rate}%` : '—',
      icon: '❤️',
    },
    {
      label: 'Régularité',
      value: data.posting_frequency?.regularity || '—',
      icon: '📅',
    },
  ];

  const criteria = [
    {
      name: 'Taux d\'engagement',
      score: data.engagement_rate >= 3 ? 85 : data.engagement_rate >= 1 ? 50 : 20,
      detail: data.engagement_rate >= 3
        ? 'Excellent — Au-dessus de la moyenne du marché'
        : data.engagement_rate >= 1
        ? 'Moyen — Potentiel d\'amélioration'
        : 'Faible — Action urgente nécessaire',
    },
    {
      name: 'Utilisation des Reels',
      score: data.reels_analysis?.has_reels
        ? Math.min(95, data.reels_analysis.reels_ratio * 2)
        : 10,
      detail: data.reels_analysis?.has_reels
        ? `${data.reels_analysis.reels_count} Reels (${data.reels_analysis.reels_ratio}% du contenu)`
        : 'Aucun Reel détecté — Format prioritaire en 2025',
    },
    {
      name: 'Compte Business',
      score: data.is_business ? 100 : 0,
      detail: data.is_business
        ? 'Profil professionnel activé ✅'
        : 'Passez en compte professionnel pour accéder aux statistiques',
    },
    {
      name: 'Fréquence de publication',
      score: data.posting_frequency?.regularity === 'regular' ? 80 :
             data.posting_frequency?.regularity === 'irregular' ? 40 : 20,
      detail: data.posting_frequency?.average_per_week
        ? `~${data.posting_frequency.average_per_week} posts/semaine`
        : 'Données insuffisantes',
    },
  ];

  return (
    <>
      {/* Instagram Stats Grid */}
      <div className="rpt-ig-stats">
        {stats.map((s, idx) => (
          <div key={idx} className="rpt-ig-stat">
            <div className="rpt-ig-stat-icon">{s.icon}</div>
            <div className="rpt-ig-stat-value">{s.value}</div>
            <div className="rpt-ig-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Instagram Criteria Cards */}
      <div className="rpt-criteria-grid">
        {criteria.map((c, idx) => (
          <div key={idx} className="rpt-criterion-card">
            <div className="rpt-criterion-header">
              <span className="rpt-criterion-name">{c.name}</span>
              <span className={`rpt-criterion-score ${getScoreClass(c.score)}`}>
                {c.score}/100
              </span>
            </div>
            <div className="rpt-criterion-detail">{c.detail}</div>
            <div className="rpt-criterion-bar">
              <div
                className={`rpt-criterion-bar-fill ${getScoreClass(c.score)}`}
                style={{ width: `${c.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ── Recommendation Card ── */
function RecommendationCard({ index, reco }) {
  const priorityClass =
    reco.priority === 'high' ? 'priority-high' :
    reco.priority === 'medium' ? 'priority-medium' : 'priority-low';

  return (
    <div className={`rpt-reco-card ${priorityClass}`}>
      <div className="rpt-reco-number">{String(index).padStart(2, '0')}</div>
      <div className="rpt-reco-content">
        <div className="rpt-reco-header">
          <span className={`rpt-reco-priority ${priorityClass}`}>
            {reco.priority === 'high' ? '🔴 Priorité haute' :
             reco.priority === 'medium' ? '🟡 Priorité moyenne' : '🟢 Suggestion'}
          </span>
        </div>
        <h4 className="rpt-reco-title">{reco.title}</h4>
        <p className="rpt-reco-desc">{reco.description}</p>
        {reco.impact && (
          <div className="rpt-reco-impact">
            <strong>💡 Impact attendu :</strong> {reco.impact}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Metric Badge ── */
function MetricBadge({ value, display }) {
  if (value === null || value === undefined) return <span>—</span>;
  const cls = value >= 80 ? 'good' : value >= 50 ? 'average' : 'poor';
  return <span className={`metric-badge ${cls}`}>{display || value}</span>;
}


/* ═══════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════ */

function getScoreClass(score) {
  if (score >= 80) return 'score-excellent';
  if (score >= 60) return 'score-good';
  if (score >= 40) return 'score-average';
  return 'score-poor';
}

function formatCWVName(key) {
  const names = {
    first_contentful_paint: 'First Contentful Paint',
    largest_contentful_paint: 'Largest Contentful Paint',
    total_blocking_time: 'Total Blocking Time',
    cumulative_layout_shift: 'Cumulative Layout Shift',
    speed_index: 'Speed Index',
  };
  return names[key] || key;
}

function formatMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/### (.*)/g, '<h4>$1</h4>')
    .replace(/## (.*)/g, '<h3>$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^\- (.*)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');
}

/**
 * Parse la synthèse Gemini pour extraire les sections structurées.
 * Retourne { strengths, weaknesses, opportunities, recommendations, rawContent }
 */
function parseGeminiSynthesis(text) {
  if (!text) return null;

  const result = {
    strengths: [],
    weaknesses: [],
    opportunities: [],
    recommendations: [],
    rawContent: null,
  };

  // Essayer d'extraire les sections
  const strengthsMatch = text.match(/(?:points?\s*forts?|forces?|atouts?)[\s:]*\n([\s\S]*?)(?=\n##|\n\*\*(?:faiblesse|axe|point.*amélioration|opportunit|recommandation)|$)/i);
  const weaknessesMatch = text.match(/(?:faiblesses?|axes?\s*d.*am[eé]lioration|points?\s*faibles?)[\s:]*\n([\s\S]*?)(?=\n##|\n\*\*(?:opportunit|recommandation|action)|$)/i);
  const opportunitiesMatch = text.match(/(?:opportunit[eé]s?)[\s:]*\n([\s\S]*?)(?=\n##|\n\*\*(?:recommandation|action|prochaine)|$)/i);
  const recoMatch = text.match(/(?:recommandations?|actions?\s*prioritaires?)[\s:]*\n([\s\S]*?)$/i);

  const extractItems = (match) => {
    if (!match) return [];
    return match[1]
      .split('\n')
      .map((line) => line.replace(/^[\s\-\*•]+/, '').trim())
      .filter((line) => line.length > 5)
      .slice(0, 5);
  };

  result.strengths = extractItems(strengthsMatch);
  result.weaknesses = extractItems(weaknessesMatch);
  result.opportunities = extractItems(opportunitiesMatch);

  // Parse recommendations en objets structurés
  if (recoMatch) {
    const lines = recoMatch[1].split('\n').filter((l) => l.trim().length > 5);
    lines.forEach((line) => {
      const clean = line.replace(/^[\s\-\*•\d.]+/, '').trim();
      if (clean.length < 10) return;
      const isHigh = /urgent|critique|imm[eé]diat|priorit|important/i.test(clean);
      const isMedium = /moyen|am[eé]lior|optimis/i.test(clean);
      result.recommendations.push({
        title: clean.split(/[.!:]/)[0].trim(),
        description: clean,
        priority: isHigh ? 'high' : isMedium ? 'medium' : 'low',
        impact: null,
      });
    });
  }

  // Si aucune section structurée trouvée, garder le raw
  if (
    result.strengths.length === 0 &&
    result.weaknesses.length === 0 &&
    result.recommendations.length === 0
  ) {
    result.rawContent = text;
  }

  return result;
}
