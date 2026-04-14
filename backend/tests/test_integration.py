"""
Integration tests — WP7 Task 7.2

Full happy-path flow:
  Register → Login → Submit assessment → Get portfolio → Compare portfolios

Runs against SQLite in-memory, Redis mocked.
"""
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.main import app

# ── Test DB setup ──────────────────────────────────────────────────────────────
SQLALCHEMY_TEST_URL = "sqlite:///./integration_test.db"
engine_test = create_engine(SQLALCHEMY_TEST_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine_test)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_db():
    import app.models
    Base.metadata.create_all(bind=engine_test)
    yield
    Base.metadata.drop_all(bind=engine_test)


app.dependency_overrides[get_db] = override_get_db

# Mock Redis so tests don't need a running Redis instance
mock_redis = MagicMock()
mock_redis.get.return_value = None
mock_redis.setex.return_value = True
mock_redis.keys.return_value = []

# Mock portfolio engine's factor scoring (no yfinance network calls)
def _mock_build_portfolio(profile, horizon, **kwargs):
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    allocs = []
    weights = {
        "conservative": {"short": {"BIST_EQUITY": 20, "SP500_EQUITY": 5, "COMMODITY": 25, "CRYPTOCURRENCY": 0, "CASH_EQUIVALENT": 50}},
        "balanced":     {"medium": {"BIST_EQUITY": 35, "SP500_EQUITY": 20, "COMMODITY": 15, "CRYPTOCURRENCY": 10, "CASH_EQUIVALENT": 20}},
        "aggressive":   {"long":   {"BIST_EQUITY": 35, "SP500_EQUITY": 20, "COMMODITY": 10, "CRYPTOCURRENCY": 25, "CASH_EQUIVALENT": 10}},
    }
    w = weights.get(profile, weights["balanced"]).get(horizon, list(weights.get(profile, weights["balanced"]).values())[0])
    for asset_class, weight in w.items():
        allocs.append({"asset_class": asset_class, "target_weight": weight, "instruments": []})
    return {
        "profile_type": profile,
        "horizon_type": horizon,
        "portfolio_score": 65,
        "expected_volatility": 11.8,
        "explanation": f"Test explanation for {profile}/{horizon}",
        "allocations": allocs,
    }


@pytest.fixture
def client():
    with patch("app.core.redis_client.get_redis", return_value=mock_redis), \
         patch("app.services.portfolio_engine.score_instruments", return_value=[]), \
         patch("app.routers.assessments.build_portfolio", side_effect=_mock_build_portfolio):
        yield TestClient(app)


# ── Helpers ────────────────────────────────────────────────────────────────────

CONSERVATIVE_ANSWERS = [
    {"questionId": i, "selectedOption": 0} for i in range(1, 16)
]
AGGRESSIVE_ANSWERS = [
    {"questionId": i, "selectedOption": 3} for i in range(1, 16)
]


def register_and_login(client, email="user@test.com"):
    reg = client.post("/api/v1/auth/register", json={
        "fullName": "Test User", "email": email, "password": "testpass123"
    })
    assert reg.status_code == 201, reg.text
    return reg.json()["accessToken"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ── Tests ──────────────────────────────────────────────────────────────────────

def test_health_check(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_full_flow_conservative(client):
    """
    RAD Scenario S-01: Register → assess (conservative) → get portfolio.
    Portfolio must have 0% crypto and 50% cash.
    """
    token = register_and_login(client, "ali@test.com")

    # Submit conservative assessment
    res = client.post(
        "/api/v1/assessments",
        json={"answers": CONSERVATIVE_ANSWERS},
        headers=auth_headers(token),
    )
    assert res.status_code == 201, res.text
    result = res.json()
    assert result["profileType"] == "conservative"
    assert result["investmentHorizon"] == "short"
    assert result["compositeScore"] == 0
    portfolio_id = result["portfolioId"]
    assert portfolio_id

    # Fetch portfolio from dashboard endpoint
    res = client.get("/api/v1/portfolios/current", headers=auth_headers(token))
    assert res.status_code == 200
    portfolio = res.json()
    assert portfolio["profileType"] == "conservative"

    # Verify no crypto (RAD Scenario S-01)
    crypto_alloc = next(
        (a for a in portfolio["allocations"] if a["assetClass"] == "CRYPTOCURRENCY"), None
    )
    assert crypto_alloc is None or crypto_alloc["targetWeight"] == 0


def test_full_flow_aggressive(client):
    """
    RAD Scenario S-02: assess (aggressive/long) → portfolio has crypto exposure.
    """
    token = register_and_login(client, "zeynep@test.com")

    res = client.post(
        "/api/v1/assessments",
        json={"answers": AGGRESSIVE_ANSWERS},
        headers=auth_headers(token),
    )
    assert res.status_code == 201, res.text
    result = res.json()
    assert result["profileType"] == "aggressive"
    assert result["investmentHorizon"] == "long"


def test_portfolio_comparison(client):
    """
    RAD UC-06: User takes assessment twice (UC-08), then compares both portfolios.
    """
    token = register_and_login(client, "compare@test.com")

    # First assessment — conservative
    res1 = client.post(
        "/api/v1/assessments",
        json={"answers": CONSERVATIVE_ANSWERS},
        headers=auth_headers(token),
    )
    assert res1.status_code == 201
    id_a = res1.json()["portfolioId"]

    # Second assessment — aggressive (UC-08 retake)
    res2 = client.post(
        "/api/v1/assessments",
        json={"answers": AGGRESSIVE_ANSWERS},
        headers=auth_headers(token),
    )
    assert res2.status_code == 201
    id_b = res2.json()["portfolioId"]

    # Compare (UC-06)
    res = client.get(
        f"/api/v1/portfolios/compare?a={id_a}&b={id_b}",
        headers=auth_headers(token),
    )
    assert res.status_code == 200
    comparison = res.json()
    assert "scenarioA" in comparison
    assert "scenarioB" in comparison
    assert "diff" in comparison


def test_assessment_latest(client):
    """GET /assessments/latest returns None before any assessment."""
    token = register_and_login(client, "latest@test.com")
    res = client.get("/api/v1/assessments/latest", headers=auth_headers(token))
    assert res.status_code == 200
    assert res.json() is None


def test_portfolio_list(client):
    """List endpoint returns all portfolios for current user."""
    token = register_and_login(client, "list@test.com")

    # No portfolios yet
    res = client.get("/api/v1/portfolios", headers=auth_headers(token))
    assert res.status_code == 200
    assert res.json() == []

    # After one assessment
    client.post(
        "/api/v1/assessments",
        json={"answers": CONSERVATIVE_ANSWERS},
        headers=auth_headers(token),
    )
    res = client.get("/api/v1/portfolios", headers=auth_headers(token))
    assert res.status_code == 200
    assert len(res.json()) == 1


def test_portfolio_isolation_between_users(client):
    """User A cannot access User B's portfolios."""
    token_a = register_and_login(client, "user_a@test.com")
    token_b = register_and_login(client, "user_b@test.com")

    # User A creates portfolio
    client.post(
        "/api/v1/assessments",
        json={"answers": CONSERVATIVE_ANSWERS},
        headers=auth_headers(token_a),
    )
    res_a = client.get("/api/v1/portfolios/current", headers=auth_headers(token_a))
    portfolio_id_a = res_a.json()["portfolioId"]

    # User B cannot fetch User A's portfolio
    res = client.get(f"/api/v1/portfolios/{portfolio_id_a}", headers=auth_headers(token_b))
    assert res.status_code == 404


def test_unauthenticated_access_blocked(client):
    """All protected endpoints return 401/403 without token."""
    assert client.get("/api/v1/portfolios/current").status_code in (401, 403)
    assert client.get("/api/v1/assessments/latest").status_code in (401, 403)
    assert client.get("/api/v1/admin/config").status_code in (401, 403)


def test_admin_access_restricted(client):
    """Regular investor cannot access admin endpoints."""
    token = register_and_login(client, "investor@test.com")
    res = client.get("/api/v1/admin/config", headers=auth_headers(token))
    assert res.status_code == 403


def test_nfr_malformed_request_returns_422(client):
    """
    RAD NFR-Security: malformed API requests return HTTP 422.
    Demonstrated via Postman during jury demo — here automated.
    """
    token = register_and_login(client, "malformed@test.com")

    # Missing required fields
    res = client.post(
        "/api/v1/assessments",
        json={"answers": []},   # empty answers — fails min_length=15 validation
        headers=auth_headers(token),
    )
    assert res.status_code == 422
