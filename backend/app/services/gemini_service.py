"""
FABRIK — Service Gemini.
Synthèse stratégique IA à partir des données combinées PageSpeed + Apify.
Positionné en "Business Partner IA" d'une agence de marketing digital.
"""

import json
import logging
import google.generativeai as genai
from app.config import get_settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Tu es FABRIK, un Business Partner IA pour une agence de marketing digital spécialisée dans 3 domaines :
1. Création de sites web
2. Production de contenu photo/vidéo
3. Gestion de campagnes publicitaires

Tu reçois les données d'un audit automatisé 360° d'un prospect (données techniques PageSpeed + données Instagram).

Ta mission est de produire une SYNTHÈSE STRATÉGIQUE structurée qui servira de base pour une proposition commerciale. Tu dois être direct, factuel et orienté business.

STRUCTURE DE LA SYNTHÈSE (en Markdown) :

## 🎯 Diagnostic Global
Un résumé exécutif en 3-4 phrases sur la présence digitale du prospect.

## 🌐 Analyse Site Web
- Forces identifiées
- Points faibles critiques
- Impact business estimé

## 📱 Analyse Réseaux Sociaux (Instagram)
- Performance de la stratégie de contenu
- Engagement et audience
- Opportunités manquées

## 🚀 Recommandations Prioritaires
3 à 5 recommandations classées par impact, avec pour chacune :
- L'action concrète
- Le service de l'agence concerné (Site Web / Contenu / Pub)
- L'impact attendu

## 💰 Estimation du Potentiel
Un scoring de 1 à 10 du potentiel commercial de ce prospect pour l'agence, avec justification.

RÈGLES :
- Sois spécifique aux données fournies, pas de généralités.
- Utilise des chiffres et métriques quand disponibles.
- Chaque recommandation doit être liée à un service vendable par l'agence.
- Le ton doit être professionnel mais accessible.
- Réponds UNIQUEMENT en français.
"""


async def synthesize(pagespeed_data: dict, apify_data: dict, company_name: str) -> dict:
    """
    Génère une synthèse stratégique via Gemini à partir des données combinées.

    Args:
        pagespeed_data: Résultats de l'analyse PageSpeed.
        apify_data: Résultats du scraping Instagram Apify.
        company_name: Nom de l'entreprise auditée.

    Returns:
        Dict contenant la synthèse et les scores calculés.
    """
    settings = get_settings()

    if not settings.GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY non configuré — retour de synthèse simulée")
        return _mock_synthesis(company_name)

    try:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel(
            model_name="gemini-1.5-pro",
            system_instruction=SYSTEM_PROMPT,
        )

        # Construction du prompt utilisateur
        user_prompt = f"""Voici les données d'audit pour l'entreprise **{company_name}** :

### Données PageSpeed (Site Web)
```json
{json.dumps(pagespeed_data, indent=2, ensure_ascii=False)}
```

### Données Instagram (Apify)
```json
{json.dumps(apify_data, indent=2, ensure_ascii=False)}
```

Génère la synthèse stratégique complète."""

        response = model.generate_content(user_prompt)

        synthesis_text = response.text

        # Calcul du score global basé sur les données
        score_global = _calculate_global_score(pagespeed_data, apify_data)

        return {
            "success": True,
            "synthesis": synthesis_text,
            "score_global": score_global,
            "model_used": "gemini-1.5-pro",
        }

    except Exception as e:
        logger.error(f"Erreur Gemini : {str(e)}")
        return {
            "success": False,
            "synthesis": None,
            "error": str(e),
        }


def _calculate_global_score(pagespeed_data: dict, apify_data: dict) -> int:
    """
    Calcule un score global (0-100) basé sur les métriques combinées.
    Pondération : Site Web 50% + Social 50%.
    """
    # Score site web (depuis PageSpeed summary)
    web_score = 50  # Valeur par défaut
    summary = pagespeed_data.get("summary", {})
    if summary.get("global") is not None:
        web_score = summary["global"]

    # Score social (depuis les métriques Instagram)
    social_score = 50  # Valeur par défaut
    if apify_data.get("found"):
        engagement = apify_data.get("engagement_rate", 0)
        frequency = apify_data.get("posting_frequency", {})
        has_reels = apify_data.get("reels_analysis", {}).get("has_reels", False)

        # Scoring engagement (max 40 pts)
        if engagement >= 5:
            eng_score = 40
        elif engagement >= 3:
            eng_score = 30
        elif engagement >= 1:
            eng_score = 20
        else:
            eng_score = 10

        # Scoring régularité (max 35 pts)
        regularity = frequency.get("regularity", "faible")
        reg_score = {"actif": 35, "modéré": 20, "faible": 10}.get(regularity, 10)

        # Scoring Reels (max 25 pts)
        reels_score = 25 if has_reels else 5

        social_score = eng_score + reg_score + reels_score

    # Score global pondéré
    return int(web_score * 0.5 + social_score * 0.5)


def _mock_synthesis(company_name: str) -> dict:
    """Synthèse simulée pour le développement."""
    return {
        "success": True,
        "synthesis": f"""## 🎯 Diagnostic Global
**{company_name}** présente une présence digitale avec des axes d'amélioration significatifs. Le site web montre des performances moyennes (score ~68/100) et la stratégie Instagram est active mais sous-optimisée.

## 🌐 Analyse Site Web
- **Forces** : Site accessible (86/100), bonnes pratiques SEO de base (80/100)
- **Faiblesses** : Performance insuffisante (68/100), temps de chargement mobile élevé (3.8s LCP)
- **Impact** : Perte estimée de 20-30% de visiteurs mobile due aux temps de chargement

## 📱 Analyse Réseaux Sociaux
- Taux d'engagement de 3.2% — dans la moyenne haute du secteur
- Publication régulière mais manque de Reels (format prioritaire en 2024)
- Biographie peu optimisée pour la conversion

## 🚀 Recommandations Prioritaires
1. **Refonte technique du site** (Service : Site Web) — Optimiser les Core Web Vitals pour passer au-dessus de 90/100. Impact : +30% de conversions mobile.
2. **Stratégie Reels** (Service : Contenu) — Produire 3-4 Reels/semaine pour tripler la portée organique. Impact : x3 reach.
3. **Landing Pages + Meta Ads** (Service : Pub) — Créer des pages de capture dédiées et lancer des campagnes Meta ciblées. Impact : Acquisition directe de leads.

## 💰 Estimation du Potentiel
**Score : 7/10** — Prospect avec un bon potentiel. Base existante à optimiser, budget probable pour 2/3 services de l'agence.""",
        "score_global": 65,
        "model_used": "mock",
        "_mock": True,
    }
