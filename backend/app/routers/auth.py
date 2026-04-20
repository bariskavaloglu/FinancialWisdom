"""
Auth router — RAD UC-01 (Register) and UC-02 (Login / Logout)

POST /auth/register          → create account, send verification email
POST /auth/login             → login, issue JWT (if email verified)
GET  /auth/verify-email      → verify email with token, issue JWT
POST /auth/resend-verification → resend verification email
POST /auth/refresh           → exchange refresh token for new access token
POST /auth/logout            → revoke refresh token
GET  /auth/me                → current user info
"""
import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException, Query, status
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.email import send_verification_email
from app.core.redis_client import get_redis
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    RegisterResponse,
    ResendVerificationRequest,
    TokenResponse,
    UserResponse,
    VerifyEmailRequest,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

_BLACKLIST_PREFIX = "blacklist:refresh:"
_BLACKLIST_TTL = 60 * 60 * 24 * 7  # 7 days


# ── UC-01: Register ───────────────────────────────────────────────────────────

@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    """
    Creates an account and sends a verification email.
    User cannot log in until email is verified.
    """
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This email address is already registered.",
        )

    verify_token = secrets.token_urlsafe(32)

    user = User(
        email=body.email,
        full_name=body.full_name,
        hashed_password=hash_password(body.password),
        role="investor",
        is_active=True,
        is_email_verified=False,
        email_verify_token=verify_token,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("New user registered: %s (id=%s)", user.email, user.id)

    try:
        send_verification_email(user.email, user.full_name, verify_token)
    except Exception as exc:
        logger.error("Failed to send verification email: %s", exc)
        # Registration is still valid — user can request resend

    return RegisterResponse(
        message="Account created. Please verify your email address.",
        email=user.email,
    )


# ── Email verification ────────────────────────────────────────────────────────

@router.get("/verify-email", response_model=TokenResponse)
def verify_email(token: str = Query(...), db: Session = Depends(get_db)):
    """
    Validates the verification token from the frontend link.
    On success, marks the user as verified and returns a JWT for immediate login.
    """
    user = db.query(User).filter(User.email_verify_token == token).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification link.",
        )

    if user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This email address has already been verified.",
        )

    user.is_email_verified = True
    user.email_verify_token = None
    db.commit()
    logger.info("Email verified: %s", user.email)

    return TokenResponse(
        accessToken=create_access_token(str(user.id)),
        refreshToken=create_refresh_token(str(user.id)),
    )


# ── Resend verification email ─────────────────────────────────────────────────

@router.post("/resend-verification", status_code=status.HTTP_204_NO_CONTENT)
def resend_verification(body: ResendVerificationRequest, db: Session = Depends(get_db)):
    """Resends the verification email."""
    user = db.query(User).filter(User.email == body.email).first()

    # Return 204 even if user not found (prevent email enumeration)
    if not user or user.is_email_verified:
        return

    new_token = secrets.token_urlsafe(32)
    user.email_verify_token = new_token
    db.commit()

    try:
        send_verification_email(user.email, user.full_name, new_token)
    except Exception as exc:
        logger.error("Failed to resend verification email: %s", exc)


# ── UC-02: Login ──────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticates user and issues JWT tokens.
    Returns 403 if email is not yet verified.
    """
    user = db.query(User).filter(User.email == body.email, User.is_active == True).first()

    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email address not yet verified. Please check your inbox.",
        )

    logger.info("User logged in: %s", user.email)
    return TokenResponse(
        accessToken=create_access_token(str(user.id)),
        refreshToken=create_refresh_token(str(user.id)),
    )


# ── Refresh ───────────────────────────────────────────────────────────────────

@router.post("/refresh", response_model=TokenResponse)
def refresh_token(body: RefreshRequest, db: Session = Depends(get_db)):
    redis = get_redis()

    if redis.get(f"{_BLACKLIST_PREFIX}{body.refreshToken}"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked.")

    try:
        user_id = decode_token(body.refreshToken, expected_type="refresh")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token.")

    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")

    redis.setex(f"{_BLACKLIST_PREFIX}{body.refreshToken}", _BLACKLIST_TTL, "1")

    return TokenResponse(
        accessToken=create_access_token(str(user.id)),
        refreshToken=create_refresh_token(str(user.id)),
    )


# ── Logout ────────────────────────────────────────────────────────────────────

@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(body: RefreshRequest):
    redis = get_redis()
    redis.setex(f"{_BLACKLIST_PREFIX}{body.refreshToken}", _BLACKLIST_TTL, "1")
    logger.info("Logout — refresh token revoked.")


# ── GET /auth/me ──────────────────────────────────────────────────────────────

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse(
        userId=str(current_user.id),
        email=current_user.email,
        fullName=current_user.full_name,
        role=current_user.role,
        createdAt=current_user.created_at.isoformat(),
        isEmailVerified=current_user.is_email_verified,
    )
