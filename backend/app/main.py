"""
FABRIK — Point d'entrée FastAPI.
API d'orchestration pour l'audit automatisé 360°.
Endpoints : Auth (register/login), Audit (lancement + récupération), Clients.
"""

import asyncio
import logging
from datetime import datetime, timezone

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func as sql_func

from app.config import get_settings
from app.database import get_db
from app.models import User, Client, Audit
from app.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    get_admin_user,
    verify_recaptcha,
)
from app.schemas import (
    RegisterRequest,
    RegisterResponse,
    LoginRequest,
    TokenResponse,
    UserResponse,
    UserAdminResponse,
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
# AUTHENTIFICATION
# ============================================

# Email du super administrateur
ADMIN_EMAIL = "admin@alsek.fr"


@app.post("/api/v1/auth/register", response_model=RegisterResponse, tags=["Auth"])
async def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """
    Inscription d'un nouvel utilisateur.
    - admin@alsek.fr → rôle admin, actif immédiatement.
    - Tous les autres → is_active=False, en attente d'approbation admin.
    """
    # Vérification reCAPTCHA
    await verify_recaptcha(request.captcha_token)

    # Vérifier si l'email existe déjà
    existing_user = db.query(User).filter(User.email == request.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Un compte existe déjà avec cet email.",
        )

    # Déterminer le rôle et l'état d'activation
    is_admin = request.email.lower() == ADMIN_EMAIL.lower()
    user = User(
        email=request.email.lower(),
        hashed_password=hash_password(request.password),
        full_name=request.full_name,
        role="admin" if is_admin else "client",
        is_active=is_admin,  # Admin actif immédiatement, les autres en attente
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    if is_admin:
        logger.info(f"👑 Super Admin créé : {user.email} (#{user.id})")
        access_token = create_access_token(data={"sub": user.id, "role": user.role})
        return RegisterResponse(
            access_token=access_token,
            user=UserResponse(
                id=user.id, email=user.email, full_name=user.full_name,
                role=user.role, is_active=user.is_active,
            ),
            pending_approval=False,
        )
    else:
        logger.info(f"⏳ Inscription en attente d'approbation : {user.email} (#{user.id})")
        return RegisterResponse(
            access_token=None,
            user=UserResponse(
                id=user.id, email=user.email, full_name=user.full_name,
                role=user.role, is_active=user.is_active,
            ),
            pending_approval=True,
            message="Votre inscription a été enregistrée. Un administrateur doit approuver votre compte avant que vous puissiez vous connecter.",
        )


@app.post("/api/v1/auth/login", response_model=TokenResponse, tags=["Auth"])
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """
    Connexion d'un utilisateur existant.
    Vérifie le CAPTCHA, les identifiants, et retourne un JWT.
    """
    # Vérification reCAPTCHA
    await verify_recaptcha(request.captcha_token)

    # Trouver l'utilisateur
    user = db.query(User).filter(User.email == request.email).first()
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Votre compte est en attente d'approbation par un administrateur.",
        )

    logger.info(f"🔑 Connexion réussie : {user.email}")

    # Générer le JWT
    access_token = create_access_token(data={"sub": user.id, "role": user.role})

    return TokenResponse(
        access_token=access_token,
        user=UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            is_active=user.is_active,
        ),
    )


@app.get("/api/v1/auth/me", response_model=UserResponse, tags=["Auth"])
def get_me(current_user: User = Depends(get_current_user)):
    """Retourne les informations de l'utilisateur connecté."""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        is_active=current_user.is_active,
    )


# ============================================
# ADMINISTRATION — Gestion des utilisateurs
# ============================================

@app.get("/api/v1/admin/users", response_model=list[UserAdminResponse], tags=["Admin"])
def list_users(
    status_filter: str = "pending",
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """
    Liste les utilisateurs. Filtres : 'pending' (en attente), 'active', 'all'.
    Réservé aux administrateurs.
    """
    query = db.query(User)

    if status_filter == "pending":
        query = query.filter(User.is_active == False)
    elif status_filter == "active":
        query = query.filter(User.is_active == True)
    # 'all' → pas de filtre

    users = query.order_by(User.created_at.desc()).all()
    return [
        UserAdminResponse(
            id=u.id, email=u.email, full_name=u.full_name,
            role=u.role, is_active=u.is_active, created_at=u.created_at,
        )
        for u in users
    ]


@app.post("/api/v1/admin/users/{user_id}/approve", response_model=UserAdminResponse, tags=["Admin"])
def approve_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Approuve un utilisateur en attente. Réservé aux administrateurs."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé.")

    user.is_active = True
    db.commit()
    db.refresh(user)
    logger.info(f"✅ Utilisateur approuvé par {admin.email} : {user.email} (#{user.id})")

    return UserAdminResponse(
        id=user.id, email=user.email, full_name=user.full_name,
        role=user.role, is_active=user.is_active, created_at=user.created_at,
    )


@app.delete("/api/v1/admin/users/{user_id}", tags=["Admin"])
def reject_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Rejette et supprime un utilisateur en attente. Réservé aux administrateurs."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé.")

    if user.role == "admin":
        raise HTTPException(status_code=403, detail="Impossible de supprimer un administrateur.")

    email = user.email
    db.delete(user)
    db.commit()
    logger.info(f"🗑️ Utilisateur rejeté par {admin.email} : {email} (#{user_id})")

    return {"status": "deleted", "user_id": user_id, "email": email}


# ============================================
# AUDIT 360° — Endpoint principal (PROTÉGÉ)
# ============================================

@app.post("/api/v1/audit", tags=["Audit"])
async def launch_audit(
    request: AuditRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lance un audit automatisé 360° complet. Requiert une authentification.

    Workflow :
    1. Créer/récupérer le client en DB
    2. Lancer en parallèle : scraping Instagram (Apify) + analyse site (PageSpeed)
    3. Envoyer les résultats combinés à Gemini pour synthèse stratégique
    4. Sauvegarder en DB
    5. Notifier n8n via webhook interne
    """
    logger.info(f"🚀 Audit 360° par {current_user.email} pour {request.company_name}")

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
            user_id=current_user.id,
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
            "requested_by": current_user.email,
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
# AUDIT — Récupération (PUBLIC — lien partageable)
# ============================================

@app.get("/api/v1/audit/{audit_id}", tags=["Audit"])
def get_audit(audit_id: int, db: Session = Depends(get_db)):
    """Récupère un audit par son ID (public pour partage)."""
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
def list_audits(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Liste les audits (protégé). Admin voit tout, client voit les siens."""
    query = (
        db.query(Audit, Client.company_name)
        .join(Client, Audit.client_id == Client.id)
    )

    # Filtrer par utilisateur si ce n'est pas un admin
    if current_user.role != "admin":
        query = query.filter(Client.user_id == current_user.id)

    audits = (
        query.order_by(Audit.created_at.desc())
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
# CLIENTS (PROTÉGÉ)
# ============================================

@app.post("/api/v1/clients", response_model=ClientResponse, tags=["Clients"])
def create_client(
    request: ClientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Crée un nouveau client (protégé)."""
    client = Client(**request.model_dump(), user_id=current_user.id)
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
def list_clients(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Liste les clients (protégé). Admin voit tout, client voit les siens."""
    query = db.query(Client)

    if current_user.role != "admin":
        query = query.filter(Client.user_id == current_user.id)

    clients = query.order_by(Client.created_at.desc()).offset(skip).limit(limit).all()

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
