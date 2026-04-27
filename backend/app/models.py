from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, Date, Float, ForeignKey, CheckConstraint
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class User(Base):
    """Comptes utilisateurs (admin agence ou client)."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255))
    role = Column(String(20), default="client")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relations
    clients = relationship("Client", back_populates="user")

    __table_args__ = (
        CheckConstraint("role IN ('admin', 'client')", name="check_user_role"),
    )


class Client(Base):
    """Entreprises / prospects auditées."""
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String(255), nullable=False)
    website_url = Column(String(500))
    instagram_handle = Column(String(255))
    contact_email = Column(String(255))
    contact_phone = Column(String(50))
    notes = Column(Text)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Onboarding
    onboarding_status = Column(String(20), default="pending")
    onboarding_data = Column(JSONB)

    deleted_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relations
    user = relationship("User", back_populates="clients")
    audits = relationship("Audit", back_populates="client", cascade="all, delete-orphan")
    monthly_metrics = relationship("MonthlyMetrics", back_populates="client", cascade="all, delete-orphan")


class Audit(Base):
    """Résultat d'un audit automatisé 360°."""
    __tablename__ = "audits"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), default="pending", index=True)

    # Données brutes des APIs
    pagespeed_data = Column(JSONB)
    apify_data = Column(JSONB)

    # Données du formulaire wizard
    form_data = Column(JSONB)

    # Synthèse IA Gemini
    gemini_synthesis = Column(Text)

    # Scores simples (legacy)
    score_global = Column(Integer)
    score_performance = Column(Integer)
    score_seo = Column(Integer)
    score_social = Column(Integer)

    # Scores détaillés (moteur de scoring)
    scores_data = Column(JSONB)

    # Métadonnées
    error_message = Column(Text)
    n8n_notified = Column(Boolean, default=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))

    # Relations
    client = relationship("Client", back_populates="audits")

    __table_args__ = (
        CheckConstraint("status IN ('pending', 'processing', 'complete', 'error')", name="check_audit_status"),
        CheckConstraint("score_global >= 0 AND score_global <= 100", name="check_score_global_range"),
    )


class MonthlyMetrics(Base):
    """Métriques mensuelles de performance par client."""
    __tablename__ = "monthly_metrics"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    month = Column(Date, nullable=False)
    phase = Column(String(20))

    revenue = Column(Integer, default=0)
    ads_spend = Column(Integer, default=0)
    roas = Column(Float, default=0)
    leads = Column(Integer, default=0)
    cpl = Column(Integer, default=0)
    deals = Column(Integer, default=0)
    cost_per_deal = Column(Integer, default=0)
    avg_basket = Column(Integer, default=0)
    conversion_rate = Column(Float, default=0)
    pipeline = Column(Integer, default=0)
    google_rating = Column(Float, default=0)
    google_reviews = Column(Integer, default=0)
    maintenance_tasks = Column(Integer, default=0)
    ia_tasks = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # Relations
    client = relationship("Client", back_populates="monthly_metrics")

