"""
FABRIK — Schémas Pydantic (validation request/response).
"""

from pydantic import BaseModel, Field, HttpUrl
from typing import Optional, Any
from datetime import datetime


# ============================================
# AUTH
# ============================================

class RegisterRequest(BaseModel):
    """Requête d'inscription."""
    email: str = Field(..., description="Email de l'utilisateur")
    password: str = Field(..., min_length=6, description="Mot de passe (min 6 caractères)")
    full_name: str = Field(..., description="Nom complet")
    captcha_token: str = Field(..., description="Token reCAPTCHA v2")


class LoginRequest(BaseModel):
    """Requête de connexion."""
    email: str = Field(..., description="Email de l'utilisateur")
    password: str = Field(..., description="Mot de passe")
    captcha_token: str = Field(..., description="Token reCAPTCHA v2")


class TokenResponse(BaseModel):
    """Réponse contenant le JWT token."""
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class UserResponse(BaseModel):
    """Informations utilisateur (sans mot de passe)."""
    id: int
    email: str
    full_name: Optional[str] = None
    role: str
    is_active: bool

    class Config:
        from_attributes = True


class UserAdminResponse(BaseModel):
    """Informations utilisateur pour l'admin (avec date de création)."""
    id: int
    email: str
    full_name: Optional[str] = None
    role: str
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RegisterResponse(BaseModel):
    """Réponse d'inscription — peut contenir un token OU un message d'attente."""
    access_token: Optional[str] = None
    token_type: str = "bearer"
    user: UserResponse
    pending_approval: bool = False
    message: Optional[str] = None


# ============================================
# AUDIT
# ============================================

class AuditRequest(BaseModel):
    """Requête pour lancer un audit 360°."""
    website_url: str = Field(..., description="URL du site web à auditer", examples=["https://example.com"])
    instagram_handle: str = Field(..., description="Handle Instagram (avec ou sans @)", examples=["@moncompte"])
    company_name: str = Field(..., description="Nom de l'entreprise", examples=["Alsek Agency"])
    contact_email: Optional[str] = Field(None, description="Email de contact (optionnel)")


class AuditScores(BaseModel):
    """Scores de l'audit."""
    score_global: Optional[int] = Field(None, ge=0, le=100)
    score_performance: Optional[int] = Field(None, ge=0, le=100)
    score_seo: Optional[int] = Field(None, ge=0, le=100)
    score_social: Optional[int] = Field(None, ge=0, le=100)


class AuditResponse(BaseModel):
    """Réponse complète d'un audit."""
    id: int
    client_id: int
    company_name: str
    status: str
    scores: Optional[AuditScores] = None
    pagespeed_data: Optional[dict] = None
    apify_data: Optional[dict] = None
    gemini_synthesis: Optional[str] = None
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AuditSummary(BaseModel):
    """Résumé d'un audit (pour les listes)."""
    id: int
    company_name: str
    status: str
    score_global: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============================================
# CLIENT
# ============================================

class ClientCreate(BaseModel):
    """Requête de création d'un client."""
    company_name: str
    website_url: Optional[str] = None
    instagram_handle: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None


class ClientResponse(BaseModel):
    """Réponse client."""
    id: int
    company_name: str
    website_url: Optional[str] = None
    instagram_handle: Optional[str] = None
    contact_email: Optional[str] = None
    created_at: Optional[datetime] = None
    audit_count: int = 0

    class Config:
        from_attributes = True


# ============================================
# HEALTH
# ============================================

class HealthResponse(BaseModel):
    """Réponse du health check."""
    status: str = "online"
    service: str = "FABRIK — Business Partner IA"
    version: str = "1.0.0"
