"""
FABRIK — Module d'authentification.
JWT tokens, hachage de mots de passe, vérification reCAPTCHA v2.
"""

import httpx
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import User

logger = logging.getLogger(__name__)

# ============================================
# Password Hashing
# ============================================
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash un mot de passe en bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Vérifie un mot de passe contre son hash."""
    return pwd_context.verify(plain_password, hashed_password)


# ============================================
# JWT Tokens
# ============================================
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Crée un JWT token signé."""
    settings = get_settings()
    to_encode = data.copy()

    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})

    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Décode et vérifie un JWT token."""
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide ou expiré",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ============================================
# Dependencies FastAPI
# ============================================

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Dependency : Récupère l'utilisateur courant à partir du JWT.
    Utilisé pour protéger les endpoints.
    """
    payload = decode_access_token(token)
    user_id: int = payload.get("sub")

    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Utilisateur non trouvé",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Compte désactivé",
        )

    return user


def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """Dependency : Vérifie que l'utilisateur est admin."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux administrateurs",
        )
    return current_user


# ============================================
# reCAPTCHA v2 Verification
# ============================================

RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify"


async def verify_recaptcha(token: str) -> bool:
    """
    Vérifie un token reCAPTCHA v2 auprès de l'API Google.
    Retourne True si valide, lève une HTTPException sinon.
    """
    settings = get_settings()

    if not settings.RECAPTCHA_SECRET_KEY:
        logger.warning("RECAPTCHA_SECRET_KEY non configuré — vérification ignorée (dev mode)")
        return True

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                RECAPTCHA_VERIFY_URL,
                data={
                    "secret": settings.RECAPTCHA_SECRET_KEY,
                    "response": token,
                },
            )
            result = response.json()

            if result.get("success"):
                return True
            else:
                logger.warning(f"reCAPTCHA échoué : {result.get('error-codes', [])}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Vérification CAPTCHA échouée. Veuillez réessayer.",
                )

    except httpx.HTTPError as e:
        logger.error(f"Erreur lors de la vérification reCAPTCHA : {str(e)}")
        # En cas d'erreur réseau, on laisse passer pour ne pas bloquer
        return True
