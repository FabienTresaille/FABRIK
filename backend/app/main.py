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
from app.models import User, Client, Audit, MonthlyMetrics
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
    AgencyStats,
    PipelineItem,
    OnboardRequest,
    ClientDashboard,
    MonthlyMetricsCreate,
    MonthlyMetricsResponse,
    TrashItem,
)
from app.services import apify_service, pagespeed_service, gemini_service, n8n_service
from app.scoring import calculate_scores

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
        access_token = create_access_token(data={"sub": str(user.id), "role": user.role})
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
    access_token = create_access_token(data={"sub": str(user.id), "role": user.role})

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

    # --- Collecter les form_data du wizard ---
    form_data = {
        "company_sector": request.company_sector,
        "site_age": request.site_age,
        "facebook_url": request.facebook_url,
        "linkedin_url": request.linkedin_url,
        "tiktok_url": request.tiktok_url,
        "google_business_url": request.google_business_url,
        "ads_active": request.ads_active,
        "budget": request.budget,
        "conversion_tracking": request.conversion_tracking,
        "acquisition_strategy": request.acquisition_strategy,
        "reviews": request.reviews,
        "visual_coherence": request.visual_coherence,
        "client_objective": request.client_objective,
        "contact_firstname": request.contact_firstname,
        "contact_lastname": request.contact_lastname,
        "website_url": request.website_url,
        "instagram_handle": request.instagram_handle,
    }

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
            contact_phone=request.contact_phone,
            notes=request.contact_notes,
            user_id=current_user.id,
        )
        db.add(client)
        db.commit()
        db.refresh(client)
        logger.info(f"✅ Client créé : #{client.id} — {client.company_name}")
    else:
        client.website_url = request.website_url
        client.instagram_handle = request.instagram_handle
        if request.contact_email:
            client.contact_email = request.contact_email
        if request.contact_phone:
            client.contact_phone = request.contact_phone
        db.commit()
        logger.info(f"♻️ Client existant mis à jour : #{client.id}")

    # --- Étape 2 : Créer l'audit en DB (status: processing) ---
    audit = Audit(
        client_id=client.id,
        status="processing",
        form_data=form_data,
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

        # --- Étape 4 : Calcul des scores (moteur de scoring) ---
        logger.info("🧮 Calcul des scores détaillés (25 critères)...")
        scores_data = calculate_scores(pagespeed_result, apify_result, form_data)
        score_global = scores_data["score_global"]
        logger.info(f"✅ Score global calculé : {score_global}/100")

        # --- Étape 5 : Synthèse stratégique via Gemini ---
        logger.info("🧠 Envoi à Gemini pour synthèse stratégique...")
        gemini_result = await gemini_service.synthesize(
            pagespeed_data=pagespeed_result,
            apify_data=apify_result,
            company_name=request.company_name,
        )
        logger.info("✅ Synthèse Gemini générée")

        # Scores legacy pour compatibilité
        pagespeed_summary = pagespeed_result.get("summary", {})
        score_performance = pagespeed_summary.get("performance")
        score_seo = pagespeed_summary.get("seo")
        p2 = scores_data["pillars"][1] if len(scores_data.get("pillars", [])) > 1 else {}
        score_social = round((p2.get("score", 0) / max(p2.get("max", 1), 1)) * 100)

        # --- Étape 6 : Sauvegarde en DB ---
        audit.pagespeed_data = pagespeed_result
        audit.apify_data = apify_result
        audit.gemini_synthesis = gemini_result.get("synthesis")
        audit.score_global = score_global
        audit.score_performance = score_performance
        audit.score_seo = score_seo
        audit.score_social = score_social
        audit.scores_data = scores_data
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
            scores_data=scores_data,
            pagespeed_data=pagespeed_result,
            apify_data=apify_result,
            gemini_synthesis=gemini_result.get("synthesis"),
            form_data=form_data,
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
        scores_data=audit.scores_data,
        pagespeed_data=audit.pagespeed_data,
        apify_data=audit.apify_data,
        gemini_synthesis=audit.gemini_synthesis,
        form_data=audit.form_data,
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
    query = db.query(Client).filter(Client.deleted_at == None)

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


# ============================================
# DASHBOARD — Vue Agence & Client (PROTÉGÉ ADMIN)
# ============================================

@app.get("/api/v1/dashboard/agency", response_model=AgencyStats, tags=["Dashboard"])
def get_agency_stats(
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """KPIs agrégés de l'agence."""
    total_audits = db.query(sql_func.count(Audit.id)).filter(Audit.status == "complete", Audit.deleted_at == None).scalar()
    clients_onboarded = db.query(sql_func.count(Client.id)).filter(Client.onboarding_status == "onboarded", Client.deleted_at == None).scalar()
    avg_score = db.query(sql_func.avg(Audit.score_global)).filter(Audit.status == "complete", Audit.deleted_at == None).scalar()
    pending = total_audits - clients_onboarded

    # Totaux depuis MonthlyMetrics
    total_revenue = db.query(sql_func.sum(MonthlyMetrics.revenue)).scalar() or 0
    total_leads = db.query(sql_func.sum(MonthlyMetrics.leads)).scalar() or 0

    return AgencyStats(
        total_audits=total_audits,
        clients_onboarded=clients_onboarded,
        avg_score=round(avg_score, 1) if avg_score else None,
        pending_audits=max(0, pending),
        total_revenue=total_revenue,
        total_leads=total_leads,
    )


@app.get("/api/v1/dashboard/pipeline", response_model=list[PipelineItem], tags=["Dashboard"])
def get_pipeline(
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Pipeline des audits pour onboarding."""
    audits = (
        db.query(Audit, Client)
        .join(Client, Audit.client_id == Client.id)
        .filter(Audit.status == "complete", Audit.deleted_at == None, Client.deleted_at == None)
        .order_by(Audit.created_at.desc())
        .all()
    )

    return [
        PipelineItem(
            audit_id=audit.id,
            client_id=client.id,
            company_name=client.company_name,
            score_global=audit.score_global,
            status=audit.status,
            onboarding_status=client.onboarding_status or "pending",
            created_at=audit.created_at,
            contact_email=client.contact_email,
        )
        for audit, client in audits
    ]


@app.post("/api/v1/dashboard/onboard/{audit_id}", tags=["Dashboard"])
def onboard_client(
    audit_id: int,
    request: OnboardRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Valider l'onboarding d'un client après audit."""
    audit = db.query(Audit).filter(Audit.id == audit_id).first()
    if not audit:
        raise HTTPException(status_code=404, detail="Audit non trouvé")

    client = db.query(Client).filter(Client.id == audit.client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client non trouvé")

    client.onboarding_status = "onboarded"
    client.onboarding_data = {
        "current_revenue": request.current_revenue,
        "allocated_budget": request.allocated_budget,
        "objectives": request.objectives,
        "notes": request.notes,
        "company_sector": request.company_sector,
        "onboarded_by": admin.email,
        "audit_id": audit_id,
    }
    db.commit()
    db.refresh(client)
    logger.info(f"\u2705 Client #{client.id} ({client.company_name}) onboardé par {admin.email}")

    return {"status": "onboarded", "client_id": client.id, "company_name": client.company_name}


@app.get("/api/v1/dashboard/client/{client_id}", response_model=ClientDashboard, tags=["Dashboard"])
def get_client_dashboard(
    client_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Dashboard individuel d'un client."""
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client non trouvé")

    # Dernier audit complet
    last_audit = (
        db.query(Audit)
        .filter(Audit.client_id == client_id, Audit.status == "complete")
        .order_by(Audit.created_at.desc())
        .first()
    )

    return ClientDashboard(
        id=client.id,
        company_name=client.company_name,
        website_url=client.website_url,
        instagram_handle=client.instagram_handle,
        contact_email=client.contact_email,
        contact_phone=client.contact_phone,
        onboarding_status=client.onboarding_status or "pending",
        onboarding_data=client.onboarding_data,
        scores_data=last_audit.scores_data if last_audit else None,
        score_global=last_audit.score_global if last_audit else None,
        created_at=client.created_at,
    )


@app.put("/api/v1/clients/{client_id}", tags=["Clients"])
def update_client(
    client_id: int,
    request: ClientCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Mettre à jour les infos d'un client."""
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client non trouvé")

    for key, value in request.model_dump(exclude_unset=True).items():
        setattr(client, key, value)
    db.commit()
    db.refresh(client)
    return {"status": "updated", "client_id": client.id}


@app.get("/api/v1/dashboard/client/{client_id}/metrics", response_model=list[MonthlyMetricsResponse], tags=["Dashboard"])
def get_client_metrics(
    client_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Récupérer les métriques mensuelles d'un client."""
    metrics = (
        db.query(MonthlyMetrics)
        .filter(MonthlyMetrics.client_id == client_id)
        .order_by(MonthlyMetrics.month.asc())
        .all()
    )
    return [
        MonthlyMetricsResponse(
            id=m.id, month=m.month.strftime("%Y-%m-%d"),
            phase=m.phase, revenue=m.revenue or 0, ads_spend=m.ads_spend or 0,
            roas=m.roas or 0, leads=m.leads or 0, cpl=m.cpl or 0,
            deals=m.deals or 0, cost_per_deal=m.cost_per_deal or 0,
            avg_basket=m.avg_basket or 0, conversion_rate=m.conversion_rate or 0,
            pipeline=m.pipeline or 0, google_rating=m.google_rating or 0,
            google_reviews=m.google_reviews or 0,
            maintenance_tasks=m.maintenance_tasks or 0, ia_tasks=m.ia_tasks or 0,
        ) for m in metrics
    ]


@app.post("/api/v1/dashboard/client/{client_id}/metrics", tags=["Dashboard"])
def upsert_client_metrics(
    client_id: int,
    request: MonthlyMetricsCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Ajouter ou mettre à jour une ligne de métriques mensuelles."""
    from datetime import date as dt_date
    month_date = dt_date.fromisoformat(request.month)

    existing = (
        db.query(MonthlyMetrics)
        .filter(MonthlyMetrics.client_id == client_id, MonthlyMetrics.month == month_date)
        .first()
    )

    if existing:
        for key, value in request.model_dump(exclude={"month"}).items():
            setattr(existing, key, value)
        db.commit()
        db.refresh(existing)
        return {"status": "updated", "id": existing.id}
    else:
        m = MonthlyMetrics(client_id=client_id, month=month_date, **request.model_dump(exclude={"month"}))
        db.add(m)
        db.commit()
        db.refresh(m)
        return {"status": "created", "id": m.id}

# ============================================
# CORBEILLE — Soft Delete (PROTÉGÉ ADMIN)
# ============================================

@app.delete("/api/v1/clients/{client_id}", tags=["Trash"])
def delete_client(
    client_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Soft delete d'un client."""
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client non trouvé")
    
    client.deleted_at = sql_func.now()
    # On soft delete aussi ses audits pour être propre
    db.query(Audit).filter(Audit.client_id == client_id).update({"deleted_at": sql_func.now()})
    
    db.commit()
    return {"status": "deleted", "client_id": client.id}

@app.delete("/api/v1/audits/{audit_id}", tags=["Trash"])
def delete_audit(
    audit_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Soft delete d'un audit."""
    audit = db.query(Audit).filter(Audit.id == audit_id).first()
    if not audit:
        raise HTTPException(status_code=404, detail="Audit non trouvé")
    
    audit.deleted_at = sql_func.now()
    db.commit()
    return {"status": "deleted", "audit_id": audit.id}

@app.get("/api/v1/trash", response_model=list[TrashItem], tags=["Trash"])
def get_trash(
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Liste tous les éléments dans la corbeille."""
    trash_items = []
    
    clients = db.query(Client).filter(Client.deleted_at != None).all()
    for c in clients:
        days_left = 30 - (datetime.now(timezone.utc) - c.deleted_at).days
        trash_items.append(TrashItem(
            id=c.id, item_type="client", name=c.company_name, 
            deleted_at=c.deleted_at, expires_in_days=max(0, days_left)
        ))
        
    audits = db.query(Audit).filter(Audit.deleted_at != None).all()
    for a in audits:
        days_left = 30 - (datetime.now(timezone.utc) - a.deleted_at).days
        trash_items.append(TrashItem(
            id=a.id, item_type="audit", name=f"Audit #{a.id}", 
            deleted_at=a.deleted_at, expires_in_days=max(0, days_left)
        ))
        
    # Sort by deleted_at descending
    trash_items.sort(key=lambda x: x.deleted_at, reverse=True)
    return trash_items

@app.post("/api/v1/trash/restore/{item_type}/{item_id}", tags=["Trash"])
def restore_trash_item(
    item_type: str,
    item_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Restaure un élément de la corbeille."""
    if item_type == "client":
        item = db.query(Client).filter(Client.id == item_id).first()
        if item: 
            item.deleted_at = None
            # Restaure aussi ses audits liés
            db.query(Audit).filter(Audit.client_id == item_id, Audit.deleted_at != None).update({"deleted_at": None})
    elif item_type == "audit":
        item = db.query(Audit).filter(Audit.id == item_id).first()
        if item: item.deleted_at = None
    else:
        raise HTTPException(status_code=400, detail="Type invalide")
        
    if not item:
        raise HTTPException(status_code=404, detail="Élément non trouvé")
        
    db.commit()
    return {"status": "restored"}

@app.delete("/api/v1/trash/hard/{item_type}/{item_id}", tags=["Trash"])
def hard_delete_trash_item(
    item_type: str,
    item_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Supprime définitivement un élément."""
    if item_type == "client":
        item = db.query(Client).filter(Client.id == item_id).first()
        if item: db.delete(item)
    elif item_type == "audit":
        item = db.query(Audit).filter(Audit.id == item_id).first()
        if item: db.delete(item)
    else:
        raise HTTPException(status_code=400, detail="Type invalide")
        
    if not item:
        raise HTTPException(status_code=404, detail="Élément non trouvé")
        
    db.commit()
    return {"status": "hard_deleted"}
