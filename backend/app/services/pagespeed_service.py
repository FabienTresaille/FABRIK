"""
FABRIK — Service Google PageSpeed Insights.
Audit technique d'un site web : Performance, SEO, Accessibilité, Best Practices.
"""

import httpx
import logging
from app.config import get_settings

logger = logging.getLogger(__name__)

PAGESPEED_API_URL = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"


async def analyze(url: str) -> dict:
    """
    Lance une analyse PageSpeed Insights sur l'URL fournie.

    Args:
        url: URL complète du site web à analyser.

    Returns:
        Dict contenant les scores et métriques détaillées.
    """
    settings = get_settings()

    # Normaliser l'URL
    if not url.startswith(("http://", "https://")):
        url = f"https://{url}"

    if not settings.PAGESPEED_API_KEY:
        logger.warning("PAGESPEED_API_KEY non configuré — retour de données simulées")
        return _mock_data(url)

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            # Analyse Desktop + Mobile
            results = {}
            for strategy in ["mobile", "desktop"]:
                params = {
                    "url": url,
                    "key": settings.PAGESPEED_API_KEY,
                    "strategy": strategy,
                    "category": ["performance", "seo", "accessibility", "best-practices"],
                }

                response = await client.get(PAGESPEED_API_URL, params=params)
                response.raise_for_status()
                data = response.json()

                results[strategy] = _parse_lighthouse(data)

            return {
                "url": url,
                "success": True,
                "mobile": results.get("mobile", {}),
                "desktop": results.get("desktop", {}),
                "summary": _create_summary(results),
            }

    except httpx.HTTPStatusError as e:
        logger.error(f"Erreur HTTP PageSpeed : {e.response.status_code}")
        return {"url": url, "success": False, "error": f"Erreur API ({e.response.status_code})"}
    except Exception as e:
        logger.error(f"Erreur PageSpeed inattendue : {str(e)}")
        return {"url": url, "success": False, "error": str(e)}


def _parse_lighthouse(data: dict) -> dict:
    """Parse les données Lighthouse brutes en scores exploitables."""
    lighthouse = data.get("lighthouseResult", {})
    categories = lighthouse.get("categories", {})
    audits = lighthouse.get("audits", {})

    # Scores principaux (0-100)
    scores = {}
    for cat_key in ["performance", "seo", "accessibility", "best-practices"]:
        cat = categories.get(cat_key, {})
        raw_score = cat.get("score")
        scores[cat_key.replace("-", "_")] = int(raw_score * 100) if raw_score is not None else None

    # Métriques Core Web Vitals
    core_web_vitals = {
        "first_contentful_paint": _get_audit_value(audits, "first-contentful-paint"),
        "largest_contentful_paint": _get_audit_value(audits, "largest-contentful-paint"),
        "total_blocking_time": _get_audit_value(audits, "total-blocking-time"),
        "cumulative_layout_shift": _get_audit_value(audits, "cumulative-layout-shift"),
        "speed_index": _get_audit_value(audits, "speed-index"),
    }

    # Opportunités d'amélioration
    opportunities = []
    for audit_key, audit_data in audits.items():
        if audit_data.get("details", {}).get("type") == "opportunity":
            savings = audit_data.get("details", {}).get("overallSavingsMs")
            if savings and savings > 0:
                opportunities.append({
                    "title": audit_data.get("title", ""),
                    "description": audit_data.get("description", "")[:200],
                    "savings_ms": savings,
                })

    # Tri par impact décroissant
    opportunities.sort(key=lambda x: x.get("savings_ms", 0), reverse=True)

    return {
        "scores": scores,
        "core_web_vitals": core_web_vitals,
        "opportunities": opportunities[:5],  # Top 5
    }


def _get_audit_value(audits: dict, key: str) -> dict | None:
    """Extrait la valeur d'un audit spécifique."""
    audit = audits.get(key, {})
    if not audit:
        return None
    return {
        "value": audit.get("numericValue"),
        "display": audit.get("displayValue", ""),
        "score": int(audit.get("score", 0) * 100) if audit.get("score") is not None else None,
    }


def _create_summary(results: dict) -> dict:
    """Crée un résumé global à partir des résultats mobile et desktop."""
    mobile_scores = results.get("mobile", {}).get("scores", {})
    desktop_scores = results.get("desktop", {}).get("scores", {})

    # Moyenne pondérée (mobile = 60%, desktop = 40% — Google privilégie mobile)
    summary = {}
    for key in ["performance", "seo", "accessibility", "best_practices"]:
        m = mobile_scores.get(key)
        d = desktop_scores.get(key)
        if m is not None and d is not None:
            summary[key] = int(m * 0.6 + d * 0.4)
        elif m is not None:
            summary[key] = m
        elif d is not None:
            summary[key] = d
        else:
            summary[key] = None

    # Score global site (moyenne des 4 catégories)
    valid_scores = [v for v in summary.values() if v is not None]
    summary["global"] = int(sum(valid_scores) / len(valid_scores)) if valid_scores else None

    return summary


def _mock_data(url: str) -> dict:
    """Données simulées pour le développement."""
    return {
        "url": url,
        "success": True,
        "mobile": {
            "scores": {"performance": 62, "seo": 78, "accessibility": 85, "best_practices": 72},
            "core_web_vitals": {
                "first_contentful_paint": {"value": 2100, "display": "2.1 s", "score": 55},
                "largest_contentful_paint": {"value": 3800, "display": "3.8 s", "score": 40},
                "total_blocking_time": {"value": 450, "display": "450 ms", "score": 60},
                "cumulative_layout_shift": {"value": 0.12, "display": "0.12", "score": 75},
                "speed_index": {"value": 3200, "display": "3.2 s", "score": 50},
            },
            "opportunities": [
                {"title": "Éliminer les ressources qui bloquent le rendu", "description": "Des ressources bloquent le premier rendu de votre page.", "savings_ms": 1200},
                {"title": "Réduire le JavaScript inutilisé", "description": "Réduisez le JavaScript inutilisé pour économiser des octets.", "savings_ms": 800},
            ],
        },
        "desktop": {
            "scores": {"performance": 78, "seo": 82, "accessibility": 88, "best_practices": 80},
            "core_web_vitals": {
                "first_contentful_paint": {"value": 1200, "display": "1.2 s", "score": 80},
                "largest_contentful_paint": {"value": 2100, "display": "2.1 s", "score": 70},
                "total_blocking_time": {"value": 200, "display": "200 ms", "score": 80},
                "cumulative_layout_shift": {"value": 0.05, "display": "0.05", "score": 90},
                "speed_index": {"value": 1800, "display": "1.8 s", "score": 75},
            },
            "opportunities": [],
        },
        "summary": {
            "performance": 68,
            "seo": 80,
            "accessibility": 86,
            "best_practices": 75,
            "global": 77,
        },
        "_mock": True,
    }
