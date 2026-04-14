"""
Auth router — RAD UC-01 (Register) and UC-02 (Login / Logout)

POST /auth/register          → hesap oluştur, doğrulama maili gönder
POST /auth/login             → giriş yap, JWT ver (mail doğrulanmışsa)
GET  /auth/verify-email      → token ile mail doğrula, JWT ver
POST /auth/resend-verification → doğrulama mailini tekrar gönder
POST /auth/refresh           → refresh token ile yeni access token al
POST /auth/logout            → refresh token'ı iptal et
GET  /auth/me                → mevcut kullanıcı bilgisi
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
_BLACKLIST_TTL = 60 * 60 * 24 * 7  # 7 gün


# ── UC-01: Register ───────────────────────────────────────────────────────────

@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    """
    Hesap oluşturur ve doğrulama maili gönderir.
    Kullanıcı mail doğrulayana kadar login yapamaz.
    """
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bu e-posta adresi zaten kayıtlı.",
        )

    # Güvenli rastgele token üret
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
    logger.info("Yeni kullanıcı kaydedildi: %s (id=%s)", user.email, user.id)

    # Doğrulama maili gönder
    try:
        send_verification_email(user.email, user.full_name, verify_token)
    except Exception as exc:
        logger.error("Mail gönderilemedi: %s", exc)
        # Mail gönderilemese bile kayıt geçerli — kullanıcı tekrar istek atabilir

    return RegisterResponse(
        message="Hesabınız oluşturuldu. Lütfen e-posta adresinizi doğrulayın.",
        email=user.email,
    )


# ── Email doğrulama ───────────────────────────────────────────────────────────

@router.get("/verify-email", response_model=TokenResponse)
def verify_email(token: str = Query(...), db: Session = Depends(get_db)):
    """
    Frontend'den gelen doğrulama tokenini kontrol eder.
    Başarılıysa kullanıcıyı doğrulanmış yapar ve JWT döner (direkt giriş).
    """
    user = db.query(User).filter(User.email_verify_token == token).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz veya süresi dolmuş doğrulama bağlantısı.",
        )

    if user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu e-posta adresi zaten doğrulanmış.",
        )

    # Doğrulandı olarak işaretle, token'ı temizle
    user.is_email_verified = True
    user.email_verify_token = None
    db.commit()
    logger.info("E-posta doğrulandı: %s", user.email)

    # Direkt giriş yaptır — JWT ver
    return TokenResponse(
        accessToken=create_access_token(str(user.id)),
        refreshToken=create_refresh_token(str(user.id)),
    )


# ── Doğrulama mailini tekrar gönder ──────────────────────────────────────────

@router.post("/resend-verification", status_code=status.HTTP_204_NO_CONTENT)
def resend_verification(body: ResendVerificationRequest, db: Session = Depends(get_db)):
    """Doğrulama mailini tekrar gönderir."""
    user = db.query(User).filter(User.email == body.email).first()

    # Kullanıcı bulunamasa bile 204 dön (email enumeration'ı engelle)
    if not user or user.is_email_verified:
        return

    # Yeni token üret
    new_token = secrets.token_urlsafe(32)
    user.email_verify_token = new_token
    db.commit()

    try:
        send_verification_email(user.email, user.full_name, new_token)
    except Exception as exc:
        logger.error("Tekrar mail gönderilemedi: %s", exc)


# ── UC-02: Login ──────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """
    Kimlik doğrular ve JWT verir.
    Mail doğrulanmamışsa 403 döner.
    """
    user = db.query(User).filter(User.email == body.email, User.is_active == True).first()

    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-posta veya şifre hatalı.",
        )

    # Mail doğrulama kontrolü
    if not user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="E-posta adresiniz henüz doğrulanmadı. Lütfen gelen kutunuzu kontrol edin.",
        )

    logger.info("Giriş yapıldı: %s", user.email)
    return TokenResponse(
        accessToken=create_access_token(str(user.id)),
        refreshToken=create_refresh_token(str(user.id)),
    )


# ── Refresh ───────────────────────────────────────────────────────────────────

@router.post("/refresh", response_model=TokenResponse)
def refresh_token(body: RefreshRequest, db: Session = Depends(get_db)):
    redis = get_redis()

    if redis.get(f"{_BLACKLIST_PREFIX}{body.refreshToken}"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token iptal edilmiş.")

    try:
        user_id = decode_token(body.refreshToken, expected_type="refresh")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Geçersiz refresh token.")

    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Kullanıcı bulunamadı.")

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
    logger.info("Logout — refresh token iptal edildi.")


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
