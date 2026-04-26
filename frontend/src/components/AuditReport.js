'use client';

/**
 * AuditReport — Rapport d'audit 360° conversion-optimized.
 * 10 sections : Vue d'ensemble, Pertes CA, Synthèse, 3 Piliers, Benchmark, Recommandations, CTA.
 */

export default function AuditReport({ audit }) {
  if (!audit) return null;
  const sd = audit.scores_data;
  if (!sd) return <LegacyReport audit={audit} />;

  const { pillars, synthesis, benchmark, recommendations, revenue_impact } = sd;

  return (
    <div id="audit-report">
      {/* 1 — VUE D'ENSEMBLE */}
      <section className="rpt-section">
        <SectionHeader icon="📊" title="Vue d'ensemble" subtitle="Votre présence digitale analysée sur 3 piliers fondamentaux" />
        <div className="rpt-pillars">
          {pillars.map((p, i) => (
            <PillarCard key={i} icon={p.icon} title={p.name} score={p.score} max={p.max} />
          ))}
        </div>
      </section>

      {/* 2 — PERTES CA */}
      {revenue_impact && revenue_impact.loss_reasons?.length > 0 && (
        <section className="rpt-section">
          <SectionHeader icon="💰" title="Estimation du manque à gagner" subtitle="Impact financier estimé de vos lacunes digitales" />
          <div className="rpt-revenue-card">
            <div className="rpt-revenue-number">
              ~{revenue_impact.estimated_range} <span className="rpt-revenue-unit">{revenue_impact.unit}</span>
            </div>
            <p className="rpt-revenue-desc">
              Avec vos lacunes actuelles, vous passez potentiellement à côté de <strong>{revenue_impact.estimated_range} {revenue_impact.unit}</strong>.
            </p>
            <ul className="rpt-revenue-reasons">
              {revenue_impact.loss_reasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
            <div className="rpt-revenue-formula">
              <strong>📐 Pourquoi ?</strong> {revenue_impact.formula_explanation}
            </div>
          </div>
        </section>
      )}

      {/* 3 — SYNTHÈSE */}
      {synthesis && (
        <section className="rpt-section">
          <SectionHeader icon="📋" title="Synthèse" />
          <div className="rpt-summary-grid">
            <SummaryCard type="strengths" icon="🛡️" title="Points Forts" items={synthesis.strengths} />
            <SummaryCard type="weaknesses" icon="⚠️" title="Points Faibles" items={synthesis.weaknesses} />
            <SummaryCard type="opportunities" icon="🚀" title="Opportunités" items={synthesis.opportunities} />
          </div>
        </section>
      )}

      {/* 4,5,6 — PILIERS DÉTAILLÉS */}
      {pillars.map((p, i) => (
        <section key={i} className="rpt-section">
          <SectionHeader
            icon={p.icon}
            title={`Pilier ${i + 1} — ${p.name}`}
            subtitle={`Score: ${p.score}/${p.max} — ${getRatingLabel(p.score, p.max)}`}
          />
          <div className="rpt-criteria-grid">
            {p.criteria.map((c, j) => (
              <CriterionCard key={j} criterion={c} />
            ))}
          </div>
        </section>
      ))}

      {/* 7 — BENCHMARK */}
      {benchmark && (
        <section className="rpt-section">
          <SectionHeader icon="📈" title="Benchmark Sectoriel" subtitle="Votre positionnement face à la moyenne de votre secteur" />
          <div className="rpt-benchmark">
            <BenchmarkBar label={audit.company_name} score={benchmark.user_score} max={100} />
            <BenchmarkBar label={`Moyenne ${benchmark.sector}`} score={benchmark.sector_avg} max={100} isSector />
            <div className={`rpt-benchmark-msg ${benchmark.diff >= 0 ? 'positive' : 'negative'}`}>
              {benchmark.diff >= 0
                ? `✅ Vous êtes ${benchmark.diff} points au-dessus de la moyenne de votre secteur.`
                : `⚠️ Vous êtes ${Math.abs(benchmark.diff)} points en dessous de la moyenne de votre secteur.`
              }
            </div>
          </div>
        </section>
      )}

      {/* 8 — RECOMMANDATIONS */}
      {recommendations?.length > 0 && (
        <section className="rpt-section">
          <SectionHeader icon="🎯" title="Actions Prioritaires" subtitle="Les améliorations à fort impact pour transformer votre présence digitale" />
          <div className="rpt-recommendations">
            {recommendations.map((r, i) => (
              <RecoCard key={i} index={i + 1} reco={r} />
            ))}
          </div>
        </section>
      )}

      {/* 9 — CTA */}
      <section className="rpt-cta">
        <div className="rpt-cta-human">
          <p>🔍 <strong>Notre équipe a analysé votre rapport.</strong> Nous avons noté des points critiques spécifiques à <strong>{audit.company_name}</strong> qui ne sont pas dans l&apos;analyse automatique.</p>
        </div>
        <h2 className="rpt-cta-title"><span className="gradient-text">Prochaine étape</span></h2>
        <p className="rpt-cta-desc">
          Transformez ces recommandations en résultats concrets.<br />
          <strong>Obtenir votre plan de croissance gratuit (30 min)</strong>
        </p>
        <div className="rpt-cta-buttons">
          <a href="https://alsek.fr" target="_blank" rel="noopener noreferrer" className="btn btn-primary" id="cta-book-btn">
            📞 Obtenir mon plan de croissance gratuit
          </a>
          <button className="btn btn-secondary" onClick={() => window.print()} id="cta-print-btn">
            🖨️ Imprimer le rapport
          </button>
        </div>
        <p className="rpt-cta-scarcity">⏰ Seulement 4 créneaux disponibles cette semaine pour des audits approfondis.</p>
        <div className="rpt-cta-contact">
          <a href="mailto:contact@alsek.fr" className="rpt-cta-contact-item">✉️ contact@alsek.fr</a>
          <a href="tel:+33614308801" className="rpt-cta-contact-item">📞 06 14 30 88 01</a>
          <a href="https://alsek.fr" target="_blank" rel="noopener noreferrer" className="rpt-cta-contact-item">🌐 alsek.fr</a>
        </div>
      </section>

      {/* Toolbar */}
      <div className="rpt-toolbar no-print">
        <button className="rpt-toolbar-btn" onClick={() => window.print()} title="Imprimer">🖨️</button>
        <button className="rpt-toolbar-btn" onClick={() => { navigator.clipboard.writeText(window.location.href); alert('Lien copié !'); }} title="Partager">🔗</button>
        <button className="rpt-toolbar-btn" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} title="Haut de page">⬆️</button>
      </div>
    </div>
  );
}

/* ═══ SUB-COMPONENTS ═══ */

function SectionHeader({ icon, title, subtitle }) {
  return (
    <div className="rpt-section-header">
      <div className="rpt-section-icon">{icon}</div>
      <h2 className="rpt-section-title">{title}</h2>
      <div className="rpt-divider" />
      {subtitle && <p className="rpt-section-subtitle">{subtitle}</p>}
    </div>
  );
}

function PillarCard({ icon, title, score, max }) {
  const pct = Math.round((score / max) * 100);
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (pct / 100) * circumference;
  return (
    <div className={`rpt-pillar-card ${getClass(pct)}`}>
      <div className="rpt-pillar-icon">{icon}</div>
      <div className="rpt-pillar-title">{title}</div>
      <div className="rpt-score-circle">
        <svg viewBox="0 0 100 100">
          <circle className="rpt-score-bg" cx="50" cy="50" r="42" />
          <circle className="rpt-score-fill" cx="50" cy="50" r="42" strokeDasharray={circumference} strokeDashoffset={offset} />
        </svg>
        <span className="rpt-score-value">{score}</span>
        <span className="rpt-score-label">{score} / {max}</span>
      </div>
    </div>
  );
}

function SummaryCard({ type, icon, title, items }) {
  if (!items?.length) return null;
  return (
    <div className={`rpt-summary-card rpt-summary-${type}`}>
      <div className="rpt-summary-card-icon">{icon}</div>
      <h3 className="rpt-summary-card-title">{title}</h3>
      <ul className="rpt-summary-list">
        {items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    </div>
  );
}

function CriterionCard({ criterion: c }) {
  return (
    <div className="rpt-criterion-card">
      <div className="rpt-criterion-header">
        <span className="rpt-criterion-name">{c.name}</span>
        <span className={`rpt-criterion-score ${getClass(c.percentage)}`}>{c.score}/{c.max}</span>
      </div>
      <div className="rpt-criterion-detail">{c.detail}</div>
      <div className="rpt-criterion-bar">
        <div className={`rpt-criterion-bar-fill ${getClass(c.percentage)}`} style={{ width: `${c.percentage}%` }} />
      </div>
      {c.why && <div className="rpt-criterion-why">💡 {c.why}</div>}
    </div>
  );
}

function BenchmarkBar({ label, score, max, isSector }) {
  const pct = Math.round((score / max) * 100);
  return (
    <div className="rpt-benchmark-row">
      <div className="rpt-benchmark-label">{label}</div>
      <div className="rpt-benchmark-bar-container">
        <div className={`rpt-benchmark-bar-fill ${isSector ? 'sector' : getClass(pct)}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="rpt-benchmark-score">{score}/100</div>
    </div>
  );
}

function RecoCard({ index, reco }) {
  const isQuickWin = reco.effort === 'quick_win';
  return (
    <div className={`rpt-reco-card priority-${reco.priority}`}>
      <div className="rpt-reco-number">{String(index).padStart(2, '0')}</div>
      <div className="rpt-reco-content">
        <div className="rpt-reco-header">
          <span className={`rpt-reco-priority priority-${reco.priority}`}>
            {reco.priority === 'high' ? '🔴 Priorité haute' : reco.priority === 'medium' ? '🟡 Priorité moyenne' : '🟢 Suggestion'}
          </span>
          {isQuickWin && <span className="rpt-reco-effort">⚡ Quick Win</span>}
          {!isQuickWin && <span className="rpt-reco-effort rpt-reco-impact-majeur">🚀 Impact Majeur</span>}
        </div>
        <h4 className="rpt-reco-title">{reco.title}</h4>
        <p className="rpt-reco-pillar">{reco.pillar} — {reco.title} ({reco.score_display})</p>
        <p className="rpt-reco-desc">{reco.description}</p>
        <div className="rpt-reco-gain">💰 Gain potentiel : <strong>{reco.gain_potential}</strong></div>
      </div>
    </div>
  );
}

/* ═══ LEGACY FALLBACK ═══ */
function LegacyReport({ audit }) {
  return (
    <div className="rpt-section">
      <SectionHeader icon="📊" title="Résultats" subtitle="Données brutes de l'audit" />
      {audit.gemini_synthesis && (
        <div className="rpt-synthesis-raw" dangerouslySetInnerHTML={{ __html: formatMd(audit.gemini_synthesis) }} />
      )}
    </div>
  );
}

/* ═══ HELPERS ═══ */
function getClass(pct) {
  if (pct >= 80) return 'score-excellent';
  if (pct >= 60) return 'score-good';
  if (pct >= 40) return 'score-average';
  return 'score-poor';
}

function getRatingLabel(score, max) {
  const pct = (score / max) * 100;
  if (pct >= 80) return 'Excellent';
  if (pct >= 60) return 'Bon';
  if (pct >= 40) return 'À améliorer';
  return 'Critique';
}

function formatMd(text) {
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
