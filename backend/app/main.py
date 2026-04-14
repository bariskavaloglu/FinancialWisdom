"""
Financial Wisdom — FastAPI Backend
RAD Implementation: WP4 Backend & API Development

Startup sequence:
  1. Create all DB tables (Alembic migrations in production)
  2. Mount all routers under /api/v1
  3. CORS configured for frontend dev server (localhost:5173)
"""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine
from app.routers import assessments, admin, auth, instruments, portfolios

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
    import app.models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables verified/created")
    yield

app = FastAPI(
    title=settings.APP_NAME,
    description="Personalized Portfolio Construction and Decision Support Platform",
    version="1.0.0",
    docs_url="/docs",       # Swagger UI — RAD D4.2 (OpenAPI docs)
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Allows the React dev server (port 5173) and any production domain
origins = [
    "http://localhost:5173",   # Vite dev server
    "http://localhost:3000",
    "http://127.0.0.1:5173",
]
if settings.ENVIRONMENT == "production":
    # In production, restrict to actual domain
    origins = ["https://financialwisdom.app"]  # update for deployment

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
PREFIX = settings.API_V1_PREFIX  # /api/v1

app.include_router(auth.router,        prefix=PREFIX)
app.include_router(assessments.router, prefix=PREFIX)
app.include_router(portfolios.router,  prefix=PREFIX)
app.include_router(instruments.router, prefix=PREFIX)
app.include_router(admin.router,       prefix=PREFIX)


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["health"])
def health():
    return {"status": "ok", "environment": settings.ENVIRONMENT}


# ── Root redirect hint ────────────────────────────────────────────────────────
@app.get("/", include_in_schema=False)
def root():
    return {"message": f"Financial Wisdom API — see /docs for Swagger UI"}
