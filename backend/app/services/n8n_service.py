"""
FABRIK — Service n8n.
Envoi de webhooks vers l'instance n8n interne pour notification agence.
Communication Docker interne via http://fabrik-n8n:5678.
"""

import httpx
import logging
from app.config import get_settings

logger = logging.getLogger(__name__)


async def notify_audit_complete(audit_data: dict) -> dict:
    """
    Envoie les résultats d'un audit terminé au webhook n8n.
    Non-bloquant : si n8n est indisponible, l'audit reste sauvé en DB.

    Args:
        audit_data: Données complètes de l'audit à transmettre.

    Returns:
        Dict avec le statut de l'envoi.
    """
    settings = get_settings()
    webhook_url = settings.N8N_INTERNAL_WEBHOOK

    if not webhook_url:
        logger.warning("N8N_INTERNAL_WEBHOOK non configuré — notification ignorée")
        return {"notified": False, "reason": "webhook_url_not_configured"}

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                webhook_url,
                json={
                    "event": "audit_complete",
                    "data": audit_data,
                },
                headers={"Content-Type": "application/json"},
            )

            if response.status_code in (200, 201, 204):
                logger.info(f"Webhook n8n envoyé avec succès — Audit #{audit_data.get('audit_id')}")
                return {"notified": True, "status_code": response.status_code}
            else:
                logger.warning(f"Webhook n8n réponse inattendue : {response.status_code}")
                return {"notified": False, "status_code": response.status_code, "reason": "unexpected_status"}

    except httpx.ConnectError:
        logger.warning("n8n non accessible (ConnectError) — notification reportée")
        return {"notified": False, "reason": "n8n_unreachable"}
    except httpx.TimeoutException:
        logger.warning("Timeout lors de l'envoi au webhook n8n")
        return {"notified": False, "reason": "timeout"}
    except Exception as e:
        logger.error(f"Erreur webhook n8n : {str(e)}")
        return {"notified": False, "reason": str(e)}
