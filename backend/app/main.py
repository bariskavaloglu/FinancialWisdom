"""
Financial Wisdom — FastAPI Backend
RAD Implementation: WP4 Backend & API Development

Startup sequence:
  1. Create all DB tables (Alembic migrations in production)
  2. Mount all routers under /api/v1
  3. CORS configured for frontend dev server (localhost:5173)
  4. Cache warmup: tüm tickerlar startup'ta çekilir → kullanıcı isteğinde 429 riski sıfır
"""
import logging
import threading

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine
from app.routers import assessments, admin, auth, instruments, portfolios
from app.routers import pool as pool_router   # ← NEW

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# ── FastAPI app ───────────────────────────────────────────────────────────────
from contextlib import asynccontextmanager


@asynccontextmanager
async def lifespan(application: FastAPI):
    # 1. DB tablolarını oluştur
    import app.models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables verified/created")

    # 2. Cache warmup — arka planda çalıştır (startup'ı bloklamaz)
    if settings.CACHE_WARMUP_ON_STARTUP:
        def _warmup():
            try:
                from app.services.market_data import warmup_cache
                summary = warmup_cache()
                logger.info(
                    "Warmup özeti — başarılı: %d/%d | başarısız: %s",
                    summary["success"], summary["total"],
                    summary["failed"] or "yok",
                )
            except Exception as exc:
                logger.warning("Cache warmup başarısız (kritik değil): %s", exc)

        t = threading.Thread(target=_warmup, daemon=True, name="cache-warmup")
        t.start()
        logger.info("Cache warmup arka planda başlatıldı")
    else:
        logger.info("Cache warmup devre dışı (CACHE_WARMUP_ON_STARTUP=false)")

    yield


app = FastAPI(
    title=settings.APP_NAME,
    description="Personalized Portfolio Construction and Decision Support Platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
]
if settings.ENVIRONMENT == "production":
    origins = [
        "https://financialwisdom.me",
        "https://www.financialwisdom.me",
        settings.FRONTEND_URL,
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
PREFIX = settings.API_V1_PREFIX  # /api/v1

app.include_router(auth.router,          prefix=PREFIX)
app.include_router(assessments.router,   prefix=PREFIX)
app.include_router(portfolios.router,    prefix=PREFIX)
app.include_router(instruments.router,   prefix=PREFIX)
app.include_router(admin.router,         prefix=PREFIX)
app.include_router(pool_router.router,   prefix=PREFIX)   # ← NEW  →  /api/v1/pool


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["health"])
def health():
    return {"status": "ok", "environment": settings.ENVIRONMENT}


@app.get("/health/cache", tags=["health"])
def cache_health():
    """Redis'teki market data key sayısını döner — warmup durumunu izlemek için."""
    try:
        from app.core.redis_client import get_redis
        redis     = get_redis()
        hist_keys = len(redis.keys("market:ticker:*"))
        info_keys = len(redis.keys("market:info:*"))
        fx_keys   = len(redis.keys("market:fx:*"))
        return {
            "status":        "ok",
            "price_history": hist_keys,
            "ticker_info":   info_keys,
            "fx_rates":      fx_keys,
            "total_keys":    hist_keys + info_keys + fx_keys,
        }
    except Exception as exc:
        return {"status": "error", "detail": str(exc)}


# ── Root redirect hint ────────────────────────────────────────────────────────
@app.get("/", include_in_schema=False)
def root():
    return {"message": "Financial Wisdom API — see /docs for Swagger UI"}
