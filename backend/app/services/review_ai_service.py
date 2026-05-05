"""
FABRIK — Service IA pour les Avis Google.
Génération de réponses professionnelles et empathiques via Gemini,
adaptées au rating et à la langue de l'avis.
"""

import logging
import google.generativeai as genai
from app.config import get_settings

logger = logging.getLogger(__name__)

REVIEW_SYSTEM_PROMPT = """Tu es l'assistant IA de l'agence marketing ALSEK (marque FABRIK).
Tu génères des réponses professionnelles aux avis Google Business Profile des clients de l'agence.

RÈGLES ABSOLUES :
1. Détecte la langue de l'avis (français ou anglais) et réponds TOUJOURS dans la même langue.
2. La réponse doit être entre 2 et 5 phrases maximum.
3. N'utilise JAMAIS de formulations génériques ou copiées-collées.
4. Personnalise la réponse en reprenant des éléments spécifiques de l'avis.
5. Chaque réponse doit se terminer par une ouverture positive (invitation à revenir, proposition d'aide, etc.).

STRATÉGIE SELON LA NOTE :

★★★★★ (5 étoiles) — VALORISATION + FIDÉLISATION :
- Remercie chaleureusement et avec enthousiasme
- Valorise le point positif mentionné par le client
- Invite à revenir ou à recommander

★★★★ (4 étoiles) — REMERCIEMENT + ENGAGEMENT :
- Remercie sincèrement
- Montre que l'avis est pris en compte pour s'améliorer
- Invite à revenir pour découvrir les améliorations

★★★ (3 étoiles) — EMPATHIE + AMÉLIORATION :
- Remercie pour le retour d'expérience
- Reconnaît les points à améliorer sans se justifier
- Propose concrètement comment l'expérience sera meilleure

★★ (2 étoiles) — EMPATHIE + RÉSOLUTION :
- Présente des excuses sincères
- Montre une compréhension du problème
- Propose un contact direct pour résoudre la situation

★ (1 étoile) — EMPATHIE MAXIMALE + ACTION :
- Exprime un regret sincère et profond
- Ne minimise JAMAIS l'expérience négative
- Propose immédiatement un contact personnel pour résoudre
- Montre un engagement concret d'amélioration

TON : Professionnel, empathique, authentique, orienté conversion et fidélisation.
"""


async def generate_review_reply(
    review_text: str,
    rating: int,
    client_context: str = "",
    language: str = "fr",
) -> dict:
    """
    Génère une suggestion de réponse à un avis Google via Gemini.

    Args:
        review_text: Texte de l'avis du client.
        rating: Note de l'avis (1-5).
        client_context: Contexte métier du client (secteur, nom, etc.).
        language: Langue détectée de l'avis.

    Returns:
        Dict avec la suggestion et la langue détectée.
    """
    settings = get_settings()

    if not settings.GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY non configuré — retour de suggestion simulée")
        return _mock_reply(review_text, rating, language)

    try:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel(
            model_name="gemini-1.5-pro",
            system_instruction=REVIEW_SYSTEM_PROMPT,
        )

        stars = "★" * rating + "☆" * (5 - rating)
        user_prompt = f"""Génère une réponse à cet avis Google :

Note : {stars} ({rating}/5)
Avis : "{review_text or '(Aucun commentaire, seulement une note)'}"
Contexte client : {client_context or 'Non spécifié'}

Réponds UNIQUEMENT avec le texte de la réponse, sans guillemets, sans introduction."""

        response = model.generate_content(user_prompt)
        suggestion = response.text.strip().strip('"').strip("'")

        # Détection de langue simple basée sur le contenu
        detected_lang = detect_language(review_text or "")

        return {
            "success": True,
            "reply_suggestion": suggestion,
            "language": detected_lang,
            "model_used": "gemini-1.5-pro",
        }

    except Exception as e:
        logger.error(f"Erreur Gemini (review reply) : {str(e)}")
        return _mock_reply(review_text, rating, language)


async def generate_post_caption(
    client_name: str,
    post_index: int,
    client_context: str = "",
) -> dict:
    """
    Génère un texte d'accompagnement pour un post Google Business Profile.

    Args:
        client_name: Nom de l'entreprise.
        post_index: Numéro du post (pour varier le contenu).
        client_context: Contexte métier du client.

    Returns:
        Dict avec le texte du post.
    """
    settings = get_settings()

    if not settings.GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY non configuré — retour de caption simulée")
        return {
            "success": True,
            "caption": f"Découvrez nos dernières réalisations ! 📸 #{client_name.replace(' ', '')}",
            "model_used": "mock",
        }

    try:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel(
            model_name="gemini-1.5-pro",
            system_instruction="""Tu es un expert en marketing digital. Tu génères des légendes engageantes 
pour des posts Google Business Profile. Le texte doit être court (1-3 phrases), 
professionnel, engageant, et inciter à l'action. Utilise 1-2 emojis pertinents.
Varie le style à chaque post (question, affirmation, invitation, etc.).
Réponds UNIQUEMENT en français. Réponds UNIQUEMENT avec le texte du post.""",
        )

        user_prompt = f"""Génère une légende pour le post Google Business Profile n°{post_index} de l'entreprise "{client_name}".
Contexte métier : {client_context or 'Non spécifié'}
IMPORTANT : Varie le style par rapport aux posts précédents. Post n°{post_index}."""

        response = model.generate_content(user_prompt)
        caption = response.text.strip().strip('"')

        return {
            "success": True,
            "caption": caption,
            "model_used": "gemini-1.5-pro",
        }

    except Exception as e:
        logger.error(f"Erreur Gemini (post caption) : {str(e)}")
        return {
            "success": False,
            "caption": f"Découvrez nos dernières réalisations ! 📸 #{client_name.replace(' ', '')}",
            "error": str(e),
        }


def detect_language(text: str) -> str:
    """
    Détection simple de la langue basée sur des mots fréquents.
    Retourne 'fr' ou 'en'.
    """
    if not text:
        return "fr"

    text_lower = text.lower()

    # Mots français fréquents dans les avis
    fr_markers = [
        "très", "merci", "bien", "bon", "super", "excellent", "accueil",
        "service", "je", "nous", "cette", "avec", "pour", "mais", "dans",
        "sont", "était", "avoir", "être", "fait", "plus", "tout", "aussi",
        "comme", "chez", "les", "des", "une", "pas", "que", "qui",
    ]

    # Mots anglais fréquents dans les avis
    en_markers = [
        "the", "and", "was", "very", "good", "great", "excellent", "amazing",
        "terrible", "horrible", "would", "recommend", "this", "that", "with",
        "have", "been", "they", "were", "their", "really", "place", "food",
        "staff", "friendly", "experience", "definitely", "never", "best",
    ]

    fr_count = sum(1 for word in fr_markers if word in text_lower)
    en_count = sum(1 for word in en_markers if word in text_lower)

    return "en" if en_count > fr_count else "fr"


def _mock_reply(review_text: str, rating: int, language: str) -> dict:
    """Suggestion simulée pour le développement."""
    if language == "en":
        if rating >= 4:
            suggestion = "Thank you so much for your wonderful review! We truly appreciate your kind words and are delighted that you had a great experience. We look forward to welcoming you back soon!"
        elif rating == 3:
            suggestion = "Thank you for your feedback. We appreciate you taking the time to share your experience and are constantly working to improve. We hope to exceed your expectations on your next visit."
        else:
            suggestion = "We sincerely apologize for your experience. Your feedback is very important to us and we would like to make things right. Please contact us directly so we can address your concerns personally."
    else:
        if rating >= 4:
            suggestion = "Merci infiniment pour votre avis ! Nous sommes ravis que votre expérience ait été à la hauteur de vos attentes. Au plaisir de vous accueillir à nouveau très bientôt !"
        elif rating == 3:
            suggestion = "Merci pour votre retour d'expérience. Nous prenons en compte chacune de vos remarques pour nous améliorer continuellement. Nous espérons vous offrir une expérience encore meilleure lors de votre prochaine visite."
        else:
            suggestion = "Nous sommes sincèrement navrés de votre expérience. Votre satisfaction est notre priorité et nous souhaitons comprendre ce qui n'a pas été à la hauteur. N'hésitez pas à nous contacter directement pour que nous puissions en discuter."

    return {
        "success": True,
        "reply_suggestion": suggestion,
        "language": language,
        "model_used": "mock",
        "_mock": True,
    }
