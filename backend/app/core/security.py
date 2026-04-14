"""
Security utilities:
  - Password hashing with bcrypt  (RAD NFR-Security: passwords never stored plaintext)
  - JWT access token  (expires in 15 min — RAD NFR)
  - JWT refresh token (expires in 7 days)
  - Token decode / validation
"""
from datetime import datetime, timedelta, timezone
from typing import Literal

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings

# ── Password hashing (bcrypt directly — RAD NFR: passwords never stored plaintext) ──

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


# ── JWT helpers ───────────────────────────────────────────────────────────────

TokenType = Literal["access", "refresh"]


def _create_token(subject: str, token_type: TokenType, expires_delta: timedelta) -> str:
    expire = datetime.now(timezone.utc) + expires_delta
    payload = {
        "sub": subject,        # user UUID
        "type": token_type,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_access_token(user_id: str) -> str:
    return _create_token(
        subject=user_id,
        token_type="access",
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(user_id: str) -> str:
    return _create_token(
        subject=user_id,
        token_type="refresh",
        expires_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )


def decode_token(token: str, expected_type: TokenType) -> str:
    """
    Decodes a JWT and returns the user_id (sub).
    Raises JWTError on invalid / expired / wrong-type tokens.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise

    if payload.get("type") != expected_type:
        raise JWTError(f"Expected token type '{expected_type}', got '{payload.get('type')}'")

    user_id: str | None = payload.get("sub")
    if user_id is None:
        raise JWTError("Token missing 'sub' claim")

    return user_id
