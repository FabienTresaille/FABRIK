"""
FABRIK — Service Apify.
Scraping de profils Instagram via l'API Apify (Instagram Profile Scraper).
Extraction : followers, engagement rate, fréquence de posts, analyse Reels.
"""

import httpx
import logging
from app.config import get_settings

logger = logging.getLogger(__name__)

# Actor Apify pour le scraping Instagram
APIFY_ACTOR_ID = "apify~instagram-profile-scraper"
APIFY_BASE_URL = "https://api.apify.com/v2"


async def scrape_instagram(handle: str) -> dict:
    """
    Lance un scraping Instagram via Apify et retourne les données structurées.

    Args:
        handle: Handle Instagram (avec ou sans @).

    Returns:
        Dict contenant les métriques Instagram extraites.
    """
    settings = get_settings()

    # Nettoyage du handle
    clean_handle = handle.strip().lstrip("@")

    if not settings.APIFY_API_TOKEN:
        logger.warning("APIFY_API_TOKEN non configuré — retour de données simulées")
        return _mock_data(clean_handle)

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            # Lancement de l'actor en mode synchrone (attend la fin)
            run_url = (
                f"{APIFY_BASE_URL}/acts/{APIFY_ACTOR_ID}/run-sync-get-dataset-items"
            )

            payload = {
                "usernames": [clean_handle],
                "resultsLimit": 12,
                "addParentData": True,
            }

            response = await client.post(
                run_url,
                json=payload,
                params={"token": settings.APIFY_API_TOKEN},
                headers={"Content-Type": "application/json"},
            )
            response.raise_for_status()
            data = response.json()

            if not data or len(data) == 0:
                logger.warning(f"Aucune donnée Apify pour @{clean_handle}")
                return {"handle": clean_handle, "error": "Profil non trouvé", "found": False}

            # Extraction et structuration des données
            profile = data[0] if isinstance(data, list) else data
            return _parse_profile(profile, clean_handle)

    except httpx.HTTPStatusError as e:
        logger.error(f"Erreur HTTP Apify : {e.response.status_code} — {e.response.text}")
        return {"handle": clean_handle, "error": f"Erreur API Apify ({e.response.status_code})", "found": False}
    except Exception as e:
        logger.error(f"Erreur Apify inattendue : {str(e)}")
        return {"handle": clean_handle, "error": str(e), "found": False}


def _parse_profile(profile: dict, handle: str) -> dict:
    """Parse les données brutes Apify en structure exploitable."""
    followers = profile.get("followersCount", 0)
    following = profile.get("followingCount", 0)
    posts_count = profile.get("postsCount", 0)
    biography = profile.get("biography", "")
    is_verified = profile.get("verified", False)
    is_business = profile.get("isBusinessAccount", False)

    # Calcul du taux d'engagement moyen
    latest_posts = profile.get("latestPosts", [])
    engagement_rate = _calculate_engagement(latest_posts, followers)

    # Analyse de la fréquence de publication
    posting_frequency = _analyze_posting_frequency(latest_posts)

    # Analyse des Reels
    reels_data = _analyze_reels(latest_posts)

    return {
        "handle": handle,
        "found": True,
        "followers": followers,
        "following": following,
        "posts_count": posts_count,
        "biography": biography,
        "is_verified": is_verified,
        "is_business": is_business,
        "engagement_rate": engagement_rate,
        "posting_frequency": posting_frequency,
        "reels_analysis": reels_data,
        "top_posts": _get_top_posts(latest_posts, 3),
    }


def _calculate_engagement(posts: list, followers: int) -> float:
    """Calcule le taux d'engagement moyen sur les derniers posts."""
    if not posts or followers == 0:
        return 0.0

    total_engagement = 0
    for post in posts:
        likes = post.get("likesCount", 0)
        comments = post.get("commentsCount", 0)
        total_engagement += likes + comments

    avg_engagement = total_engagement / len(posts)
    return round((avg_engagement / followers) * 100, 2)


def _analyze_posting_frequency(posts: list) -> dict:
    """Analyse la fréquence de publication."""
    if not posts or len(posts) < 2:
        return {"posts_per_week": 0, "regularity": "insuffisant"}

    # Estimation basée sur les posts disponibles
    return {
        "recent_posts_count": len(posts),
        "regularity": "actif" if len(posts) >= 8 else "modéré" if len(posts) >= 4 else "faible",
    }


def _analyze_reels(posts: list) -> dict:
    """Analyse la présence et performance des Reels."""
    reels = [p for p in posts if p.get("type") == "Video" or p.get("isVideo", False)]
    return {
        "reels_count": len(reels),
        "has_reels": len(reels) > 0,
        "reels_ratio": round(len(reels) / max(len(posts), 1) * 100, 1),
    }


def _get_top_posts(posts: list, limit: int = 3) -> list:
    """Retourne les top posts par engagement."""
    if not posts:
        return []

    sorted_posts = sorted(
        posts,
        key=lambda p: p.get("likesCount", 0) + p.get("commentsCount", 0),
        reverse=True,
    )

    return [
        {
            "likes": p.get("likesCount", 0),
            "comments": p.get("commentsCount", 0),
            "type": "video" if p.get("isVideo") else "image",
            "caption": (p.get("caption", "") or "")[:100],
        }
        for p in sorted_posts[:limit]
    ]


def _mock_data(handle: str) -> dict:
    """Données simulées pour le développement (quand pas de token Apify)."""
    return {
        "handle": handle,
        "found": True,
        "followers": 2450,
        "following": 380,
        "posts_count": 87,
        "biography": f"Profil simulé pour @{handle}",
        "is_verified": False,
        "is_business": True,
        "engagement_rate": 3.2,
        "posting_frequency": {"recent_posts_count": 12, "regularity": "actif"},
        "reels_analysis": {"reels_count": 4, "has_reels": True, "reels_ratio": 33.3},
        "top_posts": [
            {"likes": 156, "comments": 12, "type": "image", "caption": "Post simulé #1"},
            {"likes": 98, "comments": 8, "type": "video", "caption": "Reel simulé #2"},
        ],
        "_mock": True,
    }
