"""
Admin router — Sistem konfigürasyonu + Override yönetimi

GET    /admin/config              → sistem konfigürasyonu
PUT    /admin/config              → sistem konfigürasyonunu güncelle
GET    /admin/users               → tüm kullanıcılar (override sayısıyla)
GET    /admin/cache               → Redis cache durumu
DELETE /admin/cache               → cache temizle

# Override endpoint'leri
GET    /admin/overrides                    → tüm override'lar
GET    /admin/overrides/user/{user_id}     → kullanıcıya ait override'lar
POST   /admin/overrides                    → yeni override oluştur
PUT    /admin/overrides/{override_id}      → override güncelle
DELETE /admin/overrides/{override_id}      → override deaktif et (soft delete)
"""
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.redis_client import get_redis
from app.dependencies import require_admin
from app.models.admin_override import AdminOverride
from app.models.user import User
from app.schemas.admin import (
    AdminOverrideCreate,
    AdminOverrideResponse,
    AdminOverrideUpdate,
    SystemConfig,
    UserWithOverrides,
    VALID_ASSET_CLASSES,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])

# Algorithm D: weights now computed dynamically from questionnaire answers.
_current_config: dict = {
    "factorWeights": {"momentum": 0.35, "value": 0.20, "quality": 0.20, "lowVolatility": 0.25},
    "allocationMatrix": [
        {"profile": p, "horizon": h, "equityPct": 0, "cryptoPct": 0,
         "commodityPct": 0, "cashPct": 0}
        for p in ("conservative", "balanced", "aggressive")
        for h in ("short", "medium", "long")
    ],
    "yfinanceCacheTtlMinutes": settings.YFINANCE_CACHE_TTL_MINUTES,
    "minDataCompleteness": settings.MIN_DATA_COMPLETENESS,
    "maxInstrumentsPerClass": settings.MAX_INSTRUMENTS_PER_CLASS,
    "enableRedisCache": True,
    "useFallbackOnApiFailure": True,
}


# ── Sistem konfigürasyonu ─────────────────────────────────────────────────────

@router.get("/config", response_model=SystemConfig)
def get_config(_admin: User = Depends(require_admin)):
    return SystemConfig(**_current_config)


@router.put("/config", response_model=SystemConfig)
def update_config(body: SystemConfig, _admin: User = Depends(require_admin)):
    global _current_config
    _current_config = body.model_dump()
    logger.info("System config updated by admin %s", _admin.email)
    return body


# ── Kullanıcı yönetimi ────────────────────────────────────────────────────────

@router.get("/users", response_model=list[UserWithOverrides])
def list_users(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    users = db.query(User).order_by(User.created_at.desc()).all()
    result = []
    for u in users:
        try:
            active_overrides = [
                ov for ov in (u.admin_overrides or []) if ov.is_active
            ]
        except Exception:
            active_overrides = []
        override_responses = [
            AdminOverrideResponse(
                id=ov.id,
                user_id=ov.user_id,
                user_email=u.email,
                user_full_name=u.full_name,
                asset_class=ov.asset_class,
                min_weight=ov.min_weight,
                max_weight=ov.max_weight,
                reason=ov.reason,
                created_by_admin_email=ov.created_by_admin_email,
                is_active=ov.is_active,
                created_at=ov.created_at,
                updated_at=ov.updated_at,
            )
            for ov in active_overrides
        ]
        result.append(UserWithOverrides(
            userId=str(u.id),
            email=u.email,
            fullName=u.full_name,
            role=u.role,
            isActive=u.is_active,
            createdAt=u.created_at.isoformat(),
            overrideCount=len(active_overrides),
            activeOverrides=override_responses or [],
        ))
    return result


# ── Cache yönetimi ────────────────────────────────────────────────────────────

@router.get("/cache")
def get_cache_keys(_admin: User = Depends(require_admin)):
    redis = get_redis()
    keys = redis.keys("market:*")
    result = {}
    for key in sorted(keys):
        ttl = redis.ttl(key)
        result[key] = {"ttl_seconds": ttl}
    return {"total_keys": len(keys), "keys": result}


@router.delete("/cache", status_code=204)
def flush_cache(_admin: User = Depends(require_admin)):
    redis = get_redis()
    keys = redis.keys("market:*")
    if keys:
        redis.delete(*keys)
    logger.info("Cache flushed: %d keys removed", len(keys))


# ── Override CRUD ─────────────────────────────────────────────────────────────

@router.get("/overrides", response_model=list[AdminOverrideResponse])
def list_all_overrides(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Tüm aktif override'ları listele."""
    overrides = (
        db.query(AdminOverride)
        .filter(AdminOverride.is_active == True)
        .order_by(AdminOverride.created_at.desc())
        .all()
    )
    result = []
    for ov in overrides:
        user = db.query(User).filter(User.id == ov.user_id).first()
        result.append(AdminOverrideResponse(
            id=ov.id,
            user_id=ov.user_id,
            user_email=user.email if user else None,
            user_full_name=user.full_name if user else None,
            asset_class=ov.asset_class,
            min_weight=ov.min_weight,
            max_weight=ov.max_weight,
            reason=ov.reason,
            created_by_admin_email=ov.created_by_admin_email,
            is_active=ov.is_active,
            created_at=ov.created_at,
            updated_at=ov.updated_at,
        ))
    return result


@router.get("/overrides/user/{user_id}", response_model=list[AdminOverrideResponse])
def list_user_overrides(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Belirli bir kullanıcının override'larını listele (aktif + pasif)."""
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    overrides = (
        db.query(AdminOverride)
        .filter(AdminOverride.user_id == user_id)
        .order_by(AdminOverride.created_at.desc())
        .all()
    )
    return [
        AdminOverrideResponse(
            id=ov.id,
            user_id=ov.user_id,
            user_email=target_user.email,
            user_full_name=target_user.full_name,
            asset_class=ov.asset_class,
            min_weight=ov.min_weight,
            max_weight=ov.max_weight,
            reason=ov.reason,
            created_by_admin_email=ov.created_by_admin_email,
            is_active=ov.is_active,
            created_at=ov.created_at,
            updated_at=ov.updated_at,
        )
        for ov in overrides
    ]


@router.post("/overrides", response_model=AdminOverrideResponse, status_code=201)
def create_override(
    body: AdminOverrideCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """
    Yeni portföy override'ı oluştur.
    Aynı user + asset_class için aktif override varsa günceller (upsert).
    """
    if body.asset_class not in VALID_ASSET_CLASSES:
        raise HTTPException(
            status_code=400,
            detail=f"Geçersiz asset_class. Geçerli değerler: {sorted(VALID_ASSET_CLASSES)}"
        )

    if body.min_weight is None and body.max_weight is None:
        raise HTTPException(status_code=400, detail="En az bir kısıt (min veya max) girilmeli.")

    if (body.min_weight is not None and body.max_weight is not None
            and body.min_weight > body.max_weight):
        raise HTTPException(status_code=400, detail="min_weight, max_weight'ten büyük olamaz.")

    target_user = db.query(User).filter(User.id == body.user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Hedef kullanıcı bulunamadı.")

    # Upsert: aynı user+class için aktif override varsa güncelle
    existing = (
        db.query(AdminOverride)
        .filter(
            AdminOverride.user_id == body.user_id,
            AdminOverride.asset_class == body.asset_class,
            AdminOverride.is_active == True,
        )
        .first()
    )

    if existing:
        existing.min_weight = body.min_weight
        existing.max_weight = body.max_weight
        existing.reason = body.reason
        existing.created_by_admin_id = admin.id
        existing.created_by_admin_email = admin.email
        ov = existing
        logger.info(
            "Override güncellendi: user=%s asset=%s by admin=%s",
            body.user_id, body.asset_class, admin.email
        )
    else:
        ov = AdminOverride(
            user_id=body.user_id,
            asset_class=body.asset_class,
            min_weight=body.min_weight,
            max_weight=body.max_weight,
            reason=body.reason,
            created_by_admin_id=admin.id,
            created_by_admin_email=admin.email,
            is_active=True,
        )
        db.add(ov)
        logger.info(
            "Override oluşturuldu: user=%s asset=%s by admin=%s",
            body.user_id, body.asset_class, admin.email
        )

    db.commit()
    db.refresh(ov)

    return AdminOverrideResponse(
        id=ov.id,
        user_id=ov.user_id,
        user_email=target_user.email,
        user_full_name=target_user.full_name,
        asset_class=ov.asset_class,
        min_weight=ov.min_weight,
        max_weight=ov.max_weight,
        reason=ov.reason,
        created_by_admin_email=ov.created_by_admin_email,
        is_active=ov.is_active,
        created_at=ov.created_at,
        updated_at=ov.updated_at,
    )


@router.put("/overrides/{override_id}", response_model=AdminOverrideResponse)
def update_override(
    override_id: uuid.UUID,
    body: AdminOverrideUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    ov = db.query(AdminOverride).filter(AdminOverride.id == override_id).first()
    if not ov:
        raise HTTPException(status_code=404, detail="Override bulunamadı.")

    ov.min_weight = body.min_weight
    ov.max_weight = body.max_weight
    ov.reason     = body.reason
    ov.is_active  = body.is_active
    ov.created_by_admin_id    = admin.id
    ov.created_by_admin_email = admin.email
    db.commit()
    db.refresh(ov)

    user = db.query(User).filter(User.id == ov.user_id).first()
    return AdminOverrideResponse(
        id=ov.id,
        user_id=ov.user_id,
        user_email=user.email if user else None,
        user_full_name=user.full_name if user else None,
        asset_class=ov.asset_class,
        min_weight=ov.min_weight,
        max_weight=ov.max_weight,
        reason=ov.reason,
        created_by_admin_email=ov.created_by_admin_email,
        is_active=ov.is_active,
        created_at=ov.created_at,
        updated_at=ov.updated_at,
    )


@router.delete("/overrides/{override_id}", status_code=204)
def deactivate_override(
    override_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Soft delete — override deaktif edilir, silinmez (audit trail korunur)."""
    ov = db.query(AdminOverride).filter(AdminOverride.id == override_id).first()
    if not ov:
        raise HTTPException(status_code=404, detail="Override bulunamadı.")
    ov.is_active = False
    db.commit()
    logger.info("Override deaktif edildi: %s by admin %s", override_id, admin.email)
