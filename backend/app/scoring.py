"""
FABRIK — Moteur de Scoring Audit 360°.
25 critères répartis en 3 piliers (33 + 33 + 34 = 100 points).
"""

import logging
import math

logger = logging.getLogger("fabrik")

# Moyennes sectorielles de référence
SECTOR_AVERAGES = {
    "restauration": 60, "e-commerce": 65, "services": 55,
    "santé": 50, "immobilier": 58, "beauté": 62,
    "sport": 57, "éducation": 52, "technologie": 70,
    "autre": 58, "default": 58,
}


def calculate_scores(pagespeed_data: dict, apify_data: dict, form_data: dict) -> dict:
    """Calcule les scores détaillés pour un audit 360°."""
    fd = form_data or {}
    ps = pagespeed_data or {}
    ig = apify_data or {}

    pillar1 = _score_site_web(ps, fd)
    pillar2 = _score_contenu(ig, fd)
    pillar3 = _score_publicite(ps, fd)

    score_global = pillar1["score"] + pillar2["score"] + pillar3["score"]

    # Synthèse auto
    all_criteria = pillar1["criteria"] + pillar2["criteria"] + pillar3["criteria"]
    synthesis = _build_synthesis(all_criteria)

    # Benchmark
    sector = fd.get("company_sector", "default").lower()
    sector_avg = SECTOR_AVERAGES.get(sector, SECTOR_AVERAGES["default"])

    # Recommandations
    recommendations = _build_recommendations(all_criteria, pillar1, pillar2, pillar3)

    # Estimation pertes CA
    revenue_impact = _estimate_revenue_impact(all_criteria, fd, ps)

    return {
        "score_global": score_global,
        "pillars": [pillar1, pillar2, pillar3],
        "synthesis": synthesis,
        "benchmark": {
            "sector": fd.get("company_sector", "Général"),
            "sector_avg": sector_avg,
            "user_score": score_global,
            "diff": score_global - sector_avg,
        },
        "recommendations": recommendations,
        "revenue_impact": revenue_impact,
    }


# ═══════════════════════════════════════════
# PILIER 1 — SITE WEB (33 pts)
# ═══════════════════════════════════════════

def _score_site_web(ps: dict, fd: dict) -> dict:
    mobile = ps.get("mobile", {}).get("scores", {})
    desktop = ps.get("desktop", {}).get("scores", {})
    criteria = []

    # 1. Performance (5 pts)
    perf = mobile.get("performance", 0)
    s = 5 if perf >= 90 else 4 if perf >= 70 else 3 if perf >= 50 else 2 if perf >= 30 else 1
    cwv = ps.get("mobile", {}).get("core_web_vitals", {})
    load_time = cwv.get("speed_index", {}).get("display", "N/A")
    criteria.append(_c("Performance & Vitesse", s, 5, f"Score performance: {perf}% | Temps de chargement: {load_time}",
                       "Un site lent perd 53% de ses visiteurs mobiles. Chaque seconde supplémentaire réduit les conversions de manière exponentielle."))

    # 2. Mobile (4 pts)
    m_perf = mobile.get("performance", 0)
    d_perf = desktop.get("performance", 0)
    gap = abs(d_perf - m_perf) if d_perf else 0
    s = 4 if gap < 10 else 3 if gap < 20 else 2 if gap < 40 else 0
    criteria.append(_c("Compatibilité Mobile", s, 4,
                       f"Écart mobile/desktop: {gap}% | Mobile: {m_perf}% | Desktop: {d_perf}%",
                       "Plus de 60% du trafic web est mobile. Google pénalise les sites non responsive dans ses résultats."))

    # 3. SSL (2 pts)
    has_ssl = fd.get("website_url", "").startswith("https")
    s = 2 if has_ssl else 0
    criteria.append(_c("Sécurité SSL/HTTPS", s, 2,
                       "Certificat SSL actif (HTTPS)" if has_ssl else "Site non sécurisé (HTTP)",
                       "Un site sans HTTPS affiche un avertissement dans Chrome et perd la confiance des visiteurs."))

    # 4. SEO (5 pts)
    seo = mobile.get("seo", 0)
    s = 5 if seo >= 90 else 4 if seo >= 80 else 3 if seo >= 60 else 2
    criteria.append(_c("SEO Basique", s, 5, f"Score SEO: {seo}%",
                       "Un SEO faible signifie que vos clients potentiels ne vous trouvent pas sur Google."))

    # 5. CTA (4 pts)
    tunnel = fd.get("acquisition_strategy", "")
    s = 4 if tunnel == "multi_canal" else 3 if tunnel == "mono_canal" else 2 if tunnel == "organique" else 1
    criteria.append(_c("Appels à l'Action (CTA)", s, 4,
                       f"Stratégie: {tunnel or 'Non définie'}",
                       "Sans CTA clairs, les visiteurs quittent votre site sans effectuer d'action."))

    # 6. Pages essentielles (3 pts)
    bp = mobile.get("best_practices", 0)
    s = 3 if bp >= 90 else 2 if bp >= 70 else 1
    criteria.append(_c("Pages Essentielles", s, 3, f"Score bonnes pratiques: {bp}%",
                       "L'absence de mentions légales nuit à votre score de confiance Google et peut bloquer vos futures publicités."))

    # 7. Analytics (3 pts)
    tracking = fd.get("conversion_tracking", "")
    s = 3 if tracking == "complet" else 2 if tracking == "basique" else 1
    criteria.append(_c("Analytics & Tracking", s, 3,
                       f"Suivi: {tracking or 'Non renseigné'}",
                       "Sans analytics, vous naviguez à l'aveugle — impossible de savoir ce qui fonctionne."))

    # 8. Accessibilité (3 pts)
    acc = mobile.get("accessibility", 0)
    s = 3 if acc >= 90 else 2 if acc >= 70 else 1
    criteria.append(_c("Accessibilité", s, 3, f"Score accessibilité: {acc}%",
                       "Un site accessible touche un public plus large et est mieux référencé par Google."))

    # 9. Design (4 pts)
    age = fd.get("site_age", "")
    s = 4 if age == "moins_1an" else 3 if age == "1_3ans" else 2 if age == "3_5ans" else 1
    criteria.append(_c("Design & Modernité", s, 4,
                       f"Âge du site: {age.replace('_', ' ') if age else 'Non renseigné'}",
                       "Un design daté fait perdre en crédibilité. 75% des utilisateurs jugent la fiabilité d'une entreprise sur son site."))

    total = sum(c["score"] for c in criteria)
    return {"name": "Site Web", "icon": "🌐", "score": total, "max": 33, "criteria": criteria}


# ═══════════════════════════════════════════
# PILIER 2 — CONTENU & IMAGE (33 pts)
# ═══════════════════════════════════════════

def _score_contenu(ig: dict, fd: dict) -> dict:
    criteria = []
    found = ig.get("found", False)

    # 1. Communauté (3 pts)
    followers = ig.get("followers", 0) if found else 0
    s = 3 if followers >= 10000 else 2 if followers >= 1000 else 1 if followers >= 100 else 0
    avg_sector = "5 200"
    criteria.append(_c("Communauté Instagram", s, 3,
                       f"{followers:,} abonnés".replace(",", " "),
                       f"La moyenne des entreprises de votre secteur est de {avg_sector} abonnés."))

    # 2. Engagement (5 pts)
    er = ig.get("engagement_rate", 0) if found else 0
    s = 5 if er >= 5 else 4 if er >= 3 else 2 if er >= 1 else 1
    criteria.append(_c("Taux d'Engagement", s, 5,
                       f"Taux d'engagement: {er}%",
                       f"La moyenne du marché est de 2.5%. {'Excellent résultat !' if er >= 3 else 'Un faible engagement réduit votre visibilité dans l algorithme Instagram.'}"))

    # 3. Fréquence (4 pts)
    freq = ig.get("posting_frequency", {})
    ppw = freq.get("average_per_week", 0) if found else 0
    s = 4 if ppw >= 3 else 3 if ppw >= 1 else 2 if ppw >= 0.25 else 1
    criteria.append(_c("Fréquence de Publication", s, 4,
                       f"{ppw} publications/semaine",
                       "La régularité est clé. L'algorithme favorise les comptes qui publient au moins 3 fois par semaine."))

    # 4. Diversité (4 pts)
    reels = ig.get("reels_analysis", {}) if found else {}
    has_reels = reels.get("has_reels", False)
    ratio = reels.get("reels_ratio", 0)
    s = 4 if has_reels and ratio > 30 else 2 if has_reels else 1
    criteria.append(_c("Diversité de Contenu", s, 4,
                       f"{'Reels: ' + str(reels.get('reels_count', 0)) + ' (' + str(ratio) + '%)' if has_reels else 'Aucun Reel détecté'}",
                       "Les Reels génèrent 2x plus de portée que les posts classiques. C'est le format prioritaire en 2025."))

    # 5. Highlights (2 pts)
    highlights = ig.get("highlights_count", 0) if found else 0
    s = 2 if highlights > 0 else 0
    criteria.append(_c("Utilisation des Highlights", s, 2,
                       f"{highlights} highlights" if highlights else "Highlights non utilisés",
                       "Les highlights servent de vitrine permanente. Sans eux, les nouveaux visiteurs ne comprennent pas votre offre."))

    # 6. Bio (3 pts)
    bio = ig.get("biography", "") if found else ""
    has_link = bool(ig.get("external_url")) if found else False
    s = 3 if len(bio) > 50 and has_link else 2 if len(bio) > 50 else 1
    criteria.append(_c("Bio Optimisée", s, 3,
                       f"Bio: {len(bio)} caractères | Lien: {'✅' if has_link else '❌'}",
                       "Une bio optimisée avec un CTA et un lien convertit les visiteurs en clients."))

    # 7. Multi-plateforme (4 pts)
    platforms = sum(1 for k in ["instagram_handle", "facebook_url", "linkedin_url", "tiktok_url", "google_business_url"]
                    if fd.get(k))
    s = 4 if platforms >= 4 else 3 if platforms >= 3 else 2 if platforms >= 2 else 1
    criteria.append(_c("Présence Multi-Plateforme", s, 4,
                       f"Présent sur {platforms}/5 plateformes",
                       "Chaque plateforme est un point de contact avec vos prospects. Diversifiez votre présence."))

    # 8. Avis (3 pts)
    reviews = fd.get("reviews", "")
    s = 3 if reviews == "nombreux" else 2 if reviews == "quelques" else 0
    criteria.append(_c("Avis Clients", s, 3,
                       f"Avis: {reviews or 'Non renseigné'}",
                       "Les avis influencent 93% des décisions d'achat. C'est votre meilleur levier de confiance."))

    # 9. Cohérence visuelle (2 pts)
    vc = int(fd.get("visual_coherence", 1))
    s = 2 if vc >= 4 else 1 if vc >= 3 else 0
    criteria.append(_c("Cohérence Visuelle", s, 2,
                       f"Score cohérence: {vc}/5",
                       "Une identité visuelle cohérente renforce la mémorisation de votre marque."))

    # 10. Compte Pro (3 pts)
    is_biz = ig.get("is_business", False) if found else False
    s = 3 if is_biz else 1
    criteria.append(_c("Compte Professionnel", s, 3,
                       f"{'Profil professionnel activé ✅' if is_biz else 'Compte personnel'}",
                       "Un compte pro donne accès aux statistiques et aux publicités Instagram."))

    total = sum(c["score"] for c in criteria)
    return {"name": "Contenu & Image", "icon": "📸", "score": total, "max": 33, "criteria": criteria}


# ═══════════════════════════════════════════
# PILIER 3 — PUBLICITÉ & ACQUISITION (34 pts)
# ═══════════════════════════════════════════

def _score_publicite(ps: dict, fd: dict) -> dict:
    criteria = []

    # 1. Tracking (5 pts)
    tracking = fd.get("conversion_tracking", "")
    s = 5 if tracking == "complet" else 3 if tracking == "basique" else 0
    criteria.append(_c("Tracking & Analytics", s, 5,
                       f"Suivi: {tracking or 'Aucun'}",
                       "Aucun pixel de tracking détecté — vous ne pouvez pas mesurer votre retour sur investissement."))

    # 2. GBP (4 pts)
    gbp = fd.get("google_business_url", "")
    s = 4 if gbp else 0
    criteria.append(_c("Google Business Profile", s, 4,
                       "Google Business Profile détecté" if gbp else "Pas de fiche Google Business",
                       "La fiche Google Business est le 1er résultat que voient vos clients locaux."))

    # 3. Publicité active (4 pts)
    ads = fd.get("ads_active", "")
    s = 4 if ads == "oui_suivi" else 2 if ads == "oui_sans_suivi" else 1 if ads == "interesse" else 0
    criteria.append(_c("Publicité Active", s, 4,
                       f"{'Publicité avec suivi KPI' if ads == 'oui_suivi' else 'Publicité sans suivi' if ads == 'oui_sans_suivi' else 'Pas de publicité'}",
                       "La portée organique seule ne suffit plus — la publicité permet d'accélérer significativement la croissance."))

    # 4. Budget (4 pts)
    budget = fd.get("budget", "")
    s = 4 if budget == "plus_2000" else 3 if budget == "1000_2000" else 2 if budget == "500_1000" else 1
    criteria.append(_c("Budget Marketing", s, 4,
                       f"Budget: {budget.replace('_', '-') if budget else 'Non renseigné'}€/mois",
                       "Un budget marketing insuffisant limite votre capacité à acquérir de nouveaux clients."))

    # 5. Conversions (4 pts)
    s2 = 4 if tracking == "complet" else 2 if tracking == "basique" else 0
    criteria.append(_c("Suivi des Conversions", s2, 4,
                       f"{'Suivi complet' if tracking == 'complet' else 'Suivi basique' if tracking == 'basique' else 'Pas de suivi'}",
                       "Sans suivi des conversions, il est impossible d'optimiser vos campagnes et de réduire votre coût par lead."))

    # 6. Stratégie (4 pts)
    strat = fd.get("acquisition_strategy", "")
    s = 4 if strat == "multi_canal" else 2 if strat == "mono_canal" else 1 if strat == "organique" else 0
    criteria.append(_c("Stratégie d'Acquisition", s, 4,
                       f"Stratégie: {strat.replace('_', ' ') if strat else 'Aucune'}",
                       "Une stratégie multi-canal réduit les risques et multiplie les points de contact avec vos prospects."))

    # 7. Tunnel de vente (5 pts)
    mobile_scores = ps.get("mobile", {}).get("scores", {})
    bp = mobile_scores.get("best_practices", 0)
    s = 5 if bp >= 90 and strat == "multi_canal" else 4 if bp >= 70 else 3 if bp >= 50 else 2
    criteria.append(_c("Tunnel de Vente", s, 5,
                       f"Score CTA/Tunnel: {bp}%",
                       "Un tunnel de vente optimisé guide le visiteur de la découverte à la conversion."))

    # 8. Google Maps (4 pts)
    reviews = fd.get("reviews", "")
    s = 4 if gbp and reviews in ["nombreux", "quelques"] else 2 if gbp else 0
    criteria.append(_c("Google Maps & Avis", s, 4,
                       f"{'Présence Google Maps active' if gbp else 'Pas de présence Google Maps'}",
                       "90% des consommateurs lisent les avis en ligne avant de visiter un commerce local."))

    total = sum(c["score"] for c in criteria)
    return {"name": "Publicité & Acquisition", "icon": "📢", "score": total, "max": 34, "criteria": criteria}


# ═══════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════

def _c(name: str, score: int, max_score: int, detail: str, why: str) -> dict:
    """Crée un objet critère."""
    return {
        "name": name, "score": score, "max": max_score,
        "detail": detail, "why": why,
        "percentage": round((score / max_score) * 100) if max_score else 0,
    }


def _build_synthesis(criteria: list) -> dict:
    """Construit la synthèse Forces/Faiblesses/Opportunités depuis les critères."""
    strengths = [f"{c['name']} ({c['score']}/{c['max']})" for c in criteria if c["percentage"] >= 80]
    weaknesses = [f"{c['name']} ({c['score']}/{c['max']})" for c in criteria if c["percentage"] <= 25]
    # Opportunités = critères moyens avec le plus de marge
    opportunities = []
    for c in sorted(criteria, key=lambda x: x["max"] - x["score"], reverse=True):
        if 25 < c["percentage"] < 80 and len(opportunities) < 4:
            improvement = c["max"] - c["score"]
            opportunities.append(f"Améliorer {c['name']} (+{improvement} pts possibles)")

    return {"strengths": strengths[:5], "weaknesses": weaknesses[:5], "opportunities": opportunities[:4]}


def _build_recommendations(criteria: list, p1: dict, p2: dict, p3: dict) -> list:
    """Génère les recommandations triées par impact."""
    pillar_map = {}
    for p in [p1, p2, p3]:
        for c in p["criteria"]:
            pillar_map[c["name"]] = p["name"]

    weak = sorted(criteria, key=lambda x: x["percentage"])
    recos = []
    for c in weak[:7]:
        gap = c["max"] - c["score"]
        if gap <= 0:
            continue
        priority = "high" if c["percentage"] <= 25 else "medium" if c["percentage"] <= 50 else "low"
        effort = "quick_win" if c["max"] <= 3 else "impact_majeur"
        gain = "Élevé" if gap >= 3 else "Moyen" if gap >= 2 else "Modéré"
        recos.append({
            "title": c["name"],
            "pillar": pillar_map.get(c["name"], ""),
            "score_display": f"{c['score']}/{c['max']}",
            "description": c["why"],
            "priority": priority,
            "effort": effort,
            "gain_potential": gain,
        })
    return recos


def _estimate_revenue_impact(criteria: list, fd: dict, ps: dict) -> dict:
    """Estime le manque à gagner mensuel basé sur les critères faibles."""
    sector = fd.get("company_sector", "autre").lower()
    base_traffic = {"restauration": 800, "e-commerce": 2000, "services": 500,
                    "beauté": 600, "santé": 400, "immobilier": 300}.get(sector, 500)

    # Pertes liées au mobile
    mobile_score = 0
    for c in criteria:
        if c["name"] == "Compatibilité Mobile":
            mobile_score = c["percentage"]

    # Pertes liées à la publicité
    ads_score = 0
    for c in criteria:
        if c["name"] == "Publicité Active":
            ads_score = c["percentage"]

    # Formule : pertes = trafic × (1 - e^(-0.2 × facteur_perte))
    loss_factor = (100 - mobile_score) / 100 * 0.3 + (100 - ads_score) / 100 * 0.4
    loss_ratio = 1 - math.exp(-0.8 * loss_factor)
    estimated_monthly = int(base_traffic * loss_ratio * 0.15)  # 15% conversion rate
    low = max(10, int(estimated_monthly * 0.7))
    high = int(estimated_monthly * 1.4)

    reasons = []
    if mobile_score < 50:
        reasons.append("Site non-optimisé mobile (60%+ du trafic perdu)")
    if ads_score < 25:
        reasons.append("Absence de publicité (croissance organique limitée)")

    return {
        "estimated_range": f"{low}-{high}",
        "unit": "clients potentiels/mois",
        "loss_reasons": reasons,
        "formula_explanation": "Chaque seconde de chargement supplémentaire réduit votre taux de conversion de manière exponentielle.",
    }
