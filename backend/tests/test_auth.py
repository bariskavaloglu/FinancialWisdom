"""
Auth endpoint tests — WP7 Task 7.2 (FastAPI TestClient integration tests)

Run with:  pytest tests/ -v
"""
import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.main import app

# ── Mock Redis ─────────────────────────────────────────────────────────────────
mock_redis = MagicMock()
mock_redis.get.return_value = None
mock_redis.setex.return_value = True

# ── In-memory SQLite for tests ─────────────────────────────────────────────────
SQLALCHEMY_TEST_URL = "sqlite:///./test_auth.db"
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

import app.core.redis_client as redis_mod
redis_mod._client = mock_redis

client = TestClient(app, raise_server_exceptions=False)


# ── Tests ──────────────────────────────────────────────────────────────────────

def test_register_success():
    res = client.post("/api/v1/auth/register", json={
        "fullName": "Test User",
        "email": "test@example.com",
        "password": "securepass123",
    })
    assert res.status_code == 201, res.text
    data = res.json()
    assert "accessToken" in data
    assert "refreshToken" in data


def test_register_duplicate_email():
    payload = {"fullName": "Ali", "email": "ali@example.com", "password": "securepass123"}
    client.post("/api/v1/auth/register", json=payload)
    res = client.post("/api/v1/auth/register", json=payload)
    assert res.status_code == 409


def test_login_success():
    client.post("/api/v1/auth/register", json={
        "fullName": "Zeynep", "email": "zeynep@example.com", "password": "mypassword1",
    })
    res = client.post("/api/v1/auth/login", json={
        "email": "zeynep@example.com", "password": "mypassword1",
    })
    assert res.status_code == 200, res.text
    assert "accessToken" in res.json()


def test_login_wrong_password():
    client.post("/api/v1/auth/register", json={
        "fullName": "User", "email": "user@example.com", "password": "correctpass",
    })
    res = client.post("/api/v1/auth/login", json={
        "email": "user@example.com", "password": "wrongpass",
    })
    # RAD UC-02 alt flow 2a: same error for wrong email or wrong password
    assert res.status_code == 401


def test_get_me_authenticated():
    reg = client.post("/api/v1/auth/register", json={
        "fullName": "Me User", "email": "me@example.com", "password": "password123",
    })
    token = reg.json()["accessToken"]
    res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json()["email"] == "me@example.com"


def test_get_me_unauthenticated():
    res = client.get("/api/v1/auth/me")
    # HTTPBearer returns 403 when Authorization header is missing entirely
    assert res.status_code in (401, 403)


def test_invalid_token():
    res = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer invalidtoken"})
    assert res.status_code == 401


def test_password_too_short():
    res = client.post("/api/v1/auth/register", json={
        "fullName": "Short", "email": "short@example.com", "password": "abc",
    })
    # RAD NFR-Security: password min length enforced
    assert res.status_code == 422
