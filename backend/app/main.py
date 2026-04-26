"""
FABRIK — Point d'entrée FastAPI.
API d'orchestration pour l'audit automatisé 360°.
Endpoints : Health, Audit (lancement + récupération), Clients.
"""

import asyncio
import logging
from datetime import datetime, timezone

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func as sql_func

from app.config import get_settings
from app.database import get_db
from app.models import Client, Audit
from app.schemas import (
    AuditRequest,
    AuditResponse,
    AuditScores,
    AuditSummary,
    ClientCreate,
    ClientResponse,
    HealthResponse,
)
from app.services import apify_service, pagespeed_service, gemini_service, n8n_service

# ============================================
# Configuration du logging
# ============================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger("fabrik")

# ============================================
# Initialisation FastAPI
# ============================================
settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="API d'orchestration pour l'audit automatisé 360° — FABRIK by Alsek",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — Autoriser le frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://fabrik.alsek.fr",
        "http://localhost:3000",
        "http://localhost:3010",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================
# HEALTH CHECK
# ============================================

@app.get("/", response_model=HealthResponse, tags=["Health"])
def health_check():
    """Vérification de l'état du service."""
    return HealthResponse(
        status="online",
        service=settings.APP_NAME,
        version=settings.APP_VERSION,
    )


# ============================================
# AUDIT 360° — Endpoint principal
# ============================================

@app.post("/api/v1/audit", tags=["Audit"])
async def launch_audit(request: AuditRequest, db: Session = Depends(get_db)):
    """
    Lance un audit automatisé 360° complet.

    Workflow :
    1. Créer/récupérer le client en DB
    2. Lancer en parallèle : scraping Instagram (Apify) + analyse site (PageSpeed)
    3. Envoyer les résultats combinés à Gemini pour synthèse stratégique
    4. Sauvegarder en DB
    5. Notifier n8n via webhook interne
    """
    logger.info(f"🚀 Lancement audit 360° pour {request.company_name}")

    # --- Étape 1 : Créer ou récupérer le client ---
    client = db.query(Client).filter(
        Client.company_name == request.company_name
    ).first()

    if not client:
        client = Client(
            company_name=request.company_name,
            website_url=request.website_url,
            instagram_handle=request.instagram_handle,
            contact_email=request.contact_email,
        )
        db.add(client)
        db.commit()
        db.refresh(client)
        logger.info(f"✅ Client créé : #{client.id} — {client.company_name}")
    else:
        # Mettre à jour les infos si besoin
        client.website_url = request.website_url
        client.instagram_handle = request.instagram_handle
        if request.contact_email:
            client.contact_email = request.contact_email
        db.commit()
        logger.info(f"♻️ Client existant mis à jour : #{client.id}")

    # --- Étape 2 : Créer l'audit en DB (status: processing) ---
    audit = Audit(
        client_id=client.id,
        status="processing",
    )
    db.add(audit)
    db.commit()
    db.refresh(audit)
    logger.info(f"📋 Audit #{audit.id} créé — status: processing")

    try:
        # --- Étape 3 : Extraction parallèle (Apify + PageSpeed) ---
        logger.info("⚡ Lancement extraction parallèle Apify + PageSpeed")
        apify_result, pagespeed_result = await asyncio.gather(
            apify_service.scrape_instagram(request.instagram_handle),
            pagespeed_service.analyze(request.website_url),
        )

        logger.info("✅ Extraction terminée — Apify + PageSpeed")

        # --- Étape 4 : Synthèse stratégique via Gemini ---
        logger.info("🧠 Envoi à Gemini pour synthèse stratégique...")
        gemini_result = await gemini_service.synthesize(
            pagespeed_data=pagespeed_result,
            apify_data=apify_result,
            company_name=request.company_name,
        )
        logger.info("✅ Synthèse Gemini générée")

        # --- Étape 5 : Calcul des scores ---
        pagespeed_summary = pagespeed_result.get("summary", {})
        score_global = gemini_result.get("score_global", 0)
        score_performance = pagespeed_summary.get("performance")
        score_seo = pagespeed_summary.get("seo")

        # Score social basé sur l'engagement
        score_social = None
        if apify_result.get("found"):
            engagement = apify_result.get("engagement_rate", 0)
            if engagement >= 5:
                score_social = 90
            elif engagement >= 3:
                score_social = 70
            elif engagement >= 1:
                score_social = 50
            else:
                score_social = 30

        # --- Étape 6 : Sauvegarde en DB ---
        audit.pagespeed_data = pagespeed_result
        audit.apify_data = apify_result
        audit.gemini_synthesis = gemini_result.get("synthesis")
        audit.score_global = score_global
        audit.score_performance = score_performance
        audit.score_seo = score_seo
        audit.score_social = score_social
        audit.status = "complete"
        audit.completed_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(audit)
        logger.info(f"💾 Audit #{audit.id} sauvegardé — score global: {score_global}/100")

        # --- Étape 7 : Notification n8n (non-bloquante) ---
        n8n_payload = {
            "audit_id": audit.id,
            "client_id": client.id,
            "company_name": client.company_name,
            "website_url": client.website_url,
            "instagram_handle": client.instagram_handle,
            "score_global": score_global,
            "score_performance": score_performance,
            "score_seo": score_seo,
            "score_social": score_social,
            "synthesis_preview": (gemini_result.get("synthesis") or "")[:500],
        }

        n8n_result = await n8n_service.notify_audit_complete(n8n_payload)
        audit.n8n_notified = n8n_result.get("notified", False)
        db.commit()

        if n8n_result.get("notified"):
            logger.info(f"📡 n8n notifié pour audit #{audit.id}")
        else:
            logger.warning(f"⚠️ n8n non notifié : {n8n_result.get('reason')}")

        # --- Réponse ---
        return AuditResponse(
            id=audit.id,
            client_id=client.id,
            company_name=client.company_name,
            status=audit.status,
            scores=AuditScores(
                score_global=score_global,
                score_performance=score_performance,
                score_seo=score_seo,
                score_social=score_social,
            ),
            pagespeed_data=pagespeed_result,
            apify_data=apify_result,
            gemini_synthesis=gemini_result.get("synthesis"),
            created_at=audit.created_at,
            completed_at=audit.completed_at,
        )

    except Exception as e:
        # En cas d'erreur, sauvegarder l'état d'erreur
        logger.error(f"❌ Erreur audit #{audit.id} : {str(e)}")
        audit.status = "error"
        audit.error_message = str(e)
        db.commit()
        raise HTTPException(status_code=500, detail=f"Erreur lors de l'audit : {str(e)}")


# ============================================
# AUDIT — Récupération
# ============================================

@app.get("/api/v1/audit/{audit_id}", tags=["Audit"])
def get_audit(audit_id: int, db: Session = Depends(get_db)):
    """Récupère un audit par son ID."""
    audit = db.query(Audit).filter(Audit.id == audit_id).first()
    if not audit:
        raise HTTPException(status_code=404, detail="Audit non trouvé")

    client = db.query(Client).filter(Client.id == audit.client_id).first()

    return AuditResponse(
        id=audit.id,
        client_id=audit.client_id,
        company_name=client.company_name if client else "Inconnu",
        status=audit.status,
        scores=AuditScores(
            score_global=audit.score_global,
            score_performance=audit.score_performance,
            score_seo=audit.score_seo,
            score_social=audit.score_social,
        ),
        pagespeed_data=audit.pagespeed_data,
        apify_data=audit.apify_data,
        gemini_synthesis=audit.gemini_synthesis,
        error_message=audit.error_message,
        created_at=audit.created_at,
        completed_at=audit.completed_at,
    )


@app.get("/api/v1/audits", response_model=list[AuditSummary], tags=["Audit"])
def list_audits(skip: int = 0, limit: int = 20, db: Session = Depends(get_db)):
    """Liste tous les audits (résumé) avec pagination."""
    audits = (
        db.query(Audit, Client.company_name)
        .join(Client, Audit.client_id == Client.id)
        .order_by(Audit.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return [
        AuditSummary(
            id=audit.id,
            company_name=company_name,
            status=audit.status,
            score_global=audit.score_global,
            created_at=audit.created_at,
        )
        for audit, company_name in audits
    ]


# ============================================
# CLIENTS
# ============================================

@app.post("/api/v1/clients", response_model=ClientResponse, tags=["Clients"])
def create_client(request: ClientCreate, db: Session = Depends(get_db)):
    """Crée un nouveau client."""
    client = Client(**request.model_dump())
    db.add(client)
    db.commit()
    db.refresh(client)

    audit_count = db.query(sql_func.count(Audit.id)).filter(Audit.client_id == client.id).scalar()

    return ClientResponse(
        id=client.id,
        company_name=client.company_name,
        website_url=client.website_url,
        instagram_handle=client.instagram_handle,
        contact_email=client.contact_email,
        created_at=client.created_at,
        audit_count=audit_count,
    )


@app.get("/api/v1/clients", response_model=list[ClientResponse], tags=["Clients"])
def list_clients(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    """Liste tous les clients avec le nombre d'audits."""
    clients = db.query(Client).order_by(Client.created_at.desc()).offset(skip).limit(limit).all()

    result = []
    for client in clients:
        audit_count = db.query(sql_func.count(Audit.id)).filter(Audit.client_id == client.id).scalar()
        result.append(
            ClientResponse(
                id=client.id,
                company_name=client.company_name,
                website_url=client.website_url,
                instagram_handle=client.instagram_handle,
                contact_email=client.contact_email,
                created_at=client.created_at,
                audit_count=audit_count,
            )
        )
    return result
