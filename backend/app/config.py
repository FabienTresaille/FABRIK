"""
FABRIK — Configuration centralisée.
Charge toutes les variables d'environnement via Pydantic BaseSettings.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Variables d'environnement du backend FABRIK."""

    # --- Database ---
    DATABASE_URL: str = "postgresql://fabrik_user:password@fabrik-db:5432/fabrik_db"

    # --- Sécurité ---
    SECRET_KEY: str = "dev-secret-key-change-in-production"

    # --- APIs Externes ---
    APIFY_API_TOKEN: str = ""
    PAGESPEED_API_KEY: str = ""
    GEMINI_API_KEY: str = ""

    # --- n8n Interne ---
    N8N_INTERNAL_WEBHOOK: str = "http://fabrik-n8n:5678/webhook/audit-complete"

    # --- App ---
    APP_NAME: str = "FABRIK — Business Partner IA"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Singleton des settings (mis en cache)."""
    return Settings()
