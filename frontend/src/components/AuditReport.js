'use client';

/**
 * AuditReport — Composant d'affichage des résultats d'audit 360°.
 * Affiche les scores visuels (cercles), les métriques détaillées,
 * et la synthèse stratégique Gemini.
 */

export default function AuditReport({ audit }) {
  if (!audit) return null;

  const { scores, pagespeed_data, apify_data, gemini_synthesis } = audit;

  return (
    <div id="audit-report">
      {/* ---- Scores Overview ---- */}
      <div className="scores-grid">
        <ScoreCard label="Score Global" value={scores?.score_global} />
        <ScoreCard label="Performance Web" value={scores?.score_performance} />
        <ScoreCard label="SEO" value={scores?.score_seo} />
        <ScoreCard label="Réseaux Sociaux" value={scores?.score_social} />
      </div>

      {/* ---- Synthèse Gemini ---- */}
      {gemini_synthesis && (
        <section className="report-section">
          <h2>
            <span className="icon">🧠</span>
            Synthèse Stratégique IA
          </h2>
          <div
            className="synthesis-content"
            dangerouslySetInnerHTML={{ __html: formatMarkdown(gemini_synthesis) }}
          />
        </section>
      )}

      {/* ---- Détails Site Web ---- */}
      {pagespeed_data?.success && (
        <section className="report-section">
          <h2>
            <span className="icon">🌐</span>
            Analyse Site Web
          </h2>
          <PageSpeedDetails data={pagespeed_data} />
        </section>
      )}

      {/* ---- Détails Instagram ---- */}
      {apify_data?.found && (
        <section className="report-section">
          <h2>
            <span className="icon">📱</span>
            Analyse Instagram
          </h2>
          <InstagramDetails data={apify_data} />
        </section>
      )}
    </div>
  );
}

/* ---- Score Card Component ---- */
function ScoreCard({ label, value }) {
  const score = value ?? 0;
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (score / 100) * circumference;
  const scoreClass = getScoreClass(score);

  return (
    <div className={`score-card ${scoreClass}`}>
      <div className="score-card-label">{label}</div>
      <div className="score-circle">
        <svg viewBox="0 0 100 100">
          <circle className="score-circle-bg" cx="50" cy="50" r="42" />
          <circle
            className="score-circle-progress"
            cx="50"
            cy="50"
            r="42"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <span className="score-value">{score}</span>
      </div>
      <div className="score-label-text">/100</div>
    </div>
  );
}

/* ---- PageSpeed Details ---- */
function PageSpeedDetails({ data }) {
  const mobile = data.mobile?.scores || {};
  const desktop = data.desktop?.scores || {};
  const cwv = data.mobile?.core_web_vitals || {};

  return (
    <>
      <table className="metrics-table">
        <thead>
          <tr>
            <th>Catégorie</th>
            <th>Mobile</th>
            <th>Desktop</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Performance</td>
            <td><MetricBadge value={mobile.performance} /></td>
            <td><MetricBadge value={desktop.performance} /></td>
          </tr>
          <tr>
            <td>SEO</td>
            <td><MetricBadge value={mobile.seo} /></td>
            <td><MetricBadge value={desktop.seo} /></td>
          </tr>
          <tr>
            <td>Accessibilité</td>
            <td><MetricBadge value={mobile.accessibility} /></td>
            <td><MetricBadge value={desktop.accessibility} /></td>
          </tr>
          <tr>
            <td>Bonnes Pratiques</td>
            <td><MetricBadge value={mobile.best_practices} /></td>
            <td><MetricBadge value={desktop.best_practices} /></td>
          </tr>
        </tbody>
      </table>

      {/* Core Web Vitals */}
      {Object.keys(cwv).length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
            Core Web Vitals (Mobile)
          </h3>
          <table className="metrics-table">
            <thead>
              <tr>
                <th>Métrique</th>
                <th>Valeur</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(cwv).map(([key, val]) => (
                val && (
                  <tr key={key}>
                    <td>{formatCWVName(key)}</td>
                    <td>{val.display || '—'}</td>
                    <td><MetricBadge value={val.score} /></td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ---- Instagram Details ---- */
function InstagramDetails({ data }) {
  return (
    <table className="metrics-table">
      <tbody>
        <tr>
          <td>Followers</td>
          <td style={{ fontWeight: 600 }}>{data.followers?.toLocaleString('fr-FR') || '—'}</td>
        </tr>
        <tr>
          <td>Following</td>
          <td>{data.following?.toLocaleString('fr-FR') || '—'}</td>
        </tr>
        <tr>
          <td>Publications</td>
          <td>{data.posts_count || '—'}</td>
        </tr>
        <tr>
          <td>Taux d'engagement</td>
          <td>
            <MetricBadge
              value={data.engagement_rate >= 3 ? 80 : data.engagement_rate >= 1 ? 50 : 20}
              display={`${data.engagement_rate}%`}
            />
          </td>
        </tr>
        <tr>
          <td>Régularité</td>
          <td style={{ textTransform: 'capitalize' }}>
            {data.posting_frequency?.regularity || '—'}
          </td>
        </tr>
        <tr>
          <td>Reels</td>
          <td>
            {data.reels_analysis?.has_reels ? (
              <span>{data.reels_analysis.reels_count} Reels ({data.reels_analysis.reels_ratio}%)</span>
            ) : (
              <span style={{ color: 'var(--color-warning)' }}>Aucun Reel détecté</span>
            )}
          </td>
        </tr>
        <tr>
          <td>Compte Business</td>
          <td>{data.is_business ? '✅ Oui' : '❌ Non'}</td>
        </tr>
      </tbody>
    </table>
  );
}

/* ---- Helpers ---- */

function MetricBadge({ value, display }) {
  if (value === null || value === undefined) return <span>—</span>;
  const cls = value >= 80 ? 'good' : value >= 50 ? 'average' : 'poor';
  return <span className={`metric-badge ${cls}`}>{display || value}</span>;
}

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
  // Basic markdown to HTML conversion
  return text
    .replace(/## (.*)/g, '<h2>$1</h2>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^\- (.*)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');
}
