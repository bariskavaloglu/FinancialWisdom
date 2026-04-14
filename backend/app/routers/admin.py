"""
Admin router — RAD UC-09 (Configure System Parameters)

GET  /admin/config   → read current system configuration
PUT  /admin/config   → update factor weights / allocation rules
GET  /admin/users    → list all users (admin oversight)
GET  /admin/cache    → show Redis cache keys (jury demo requirement)
DELETE /admin/cache  → flush market data cache
"""
import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.redis_client import get_redis
from app.dependencies import require_admin
from app.models.user import User
from app.schemas.admin import SystemConfig
from app.services.portfolio_engine import ALLOCATION_MATRIX

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])

# In-memory config store (persisted to DB in production; sufficient for MVP)
_current_config: dict = {
    "factorWeights": {"momentum": 0.30, "value": 0.20, "quality": 0.30, "lowVolatility": 0.20},
    "allocationMatrix": [
        {"profile": p, "horizon": h,
         "equityPct": ALLOCATION_MATRIX[p][h]["BIST_EQUITY"] + ALLOCATION_MATRIX[p][h]["SP500_EQUITY"],
         "cryptoPct": ALLOCATION_MATRIX[p][h]["CRYPTOCURRENCY"],
         "commodityPct": ALLOCATION_MATRIX[p][h]["COMMODITY"],
         "cashPct": ALLOCATION_MATRIX[p][h]["CASH_EQUIVALENT"]}
        for p in ALLOCATION_MATRIX for h in ALLOCATION_MATRIX[p]
    ],
    "yfinanceCacheTtlMinutes": settings.YFINANCE_CACHE_TTL_MINUTES,
    "minDataCompleteness": settings.MIN_DATA_COMPLETENESS,
    "maxInstrumentsPerClass": settings.MAX_INSTRUMENTS_PER_CLASS,
    "enableRedisCache": True,
    "useFallbackOnApiFailure": True,
}


@router.get("/config", response_model=SystemConfig)
def get_config(_admin: User = Depends(require_admin)):
    """Returns current system configuration. RAD UC-09."""
    return SystemConfig(**_current_config)


@router.put("/config", response_model=SystemConfig)
def update_config(body: SystemConfig, _admin: User = Depends(require_admin)):
    """
    Updates system configuration.
    RAD UC-09 main flow step 3-4: validates values and persists.
    """
    global _current_config
    _current_config = body.model_dump()
    logger.info("System config updated by admin")
    return body


@router.get("/users")
def list_users(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [
        {
            "userId": str(u.id),
            "email": u.email,
            "fullName": u.full_name,
            "role": u.role,
            "isActive": u.is_active,
            "createdAt": u.created_at.isoformat(),
        }
        for u in users
    ]


@router.get("/cache")
def get_cache_keys(_admin: User = Depends(require_admin)):
    """
    Lists all Redis cache keys.
    RAD NFR: jury demo requirement — show Redis keys in terminal.
    """
    redis = get_redis()
    keys = redis.keys("market:*")
    result = {}
    for key in sorted(keys):
        ttl = redis.ttl(key)
        result[key] = {"ttl_seconds": ttl}
    return {"total_keys": len(keys), "keys": result}


@router.delete("/cache", status_code=204)
def flush_cache(_admin: User = Depends(require_admin)):
    """Flushes all market data cache entries."""
    redis = get_redis()
    keys = redis.keys("market:*")
    if keys:
        redis.delete(*keys)
    logger.info("Cache flushed: %d keys removed", len(keys))
