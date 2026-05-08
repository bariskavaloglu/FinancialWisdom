"""
test_scenarios.py — Financial Wisdom Test Scenarios
WP7: Testing & Quality Assurance

RAD/SDD ile eşleştirilmiş Functional (UC-01..UC-09) ve Non-Functional test senaryoları.

Çalıştırma:
    pytest tests/test_scenarios.py -v
    pytest tests/test_scenarios.py -v --tb=short -k "functional"
    pytest tests/test_scenarios.py -v --tb=short -k "nonfunctional"
"""

import time
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.main import app

# ── Test infrastructure ────────────────────────────────────────────────────────

SQLALCHEMY_TEST_URL = "sqlite:///./test_scenarios.db"
engine_test = create_engine(SQLALCHEMY_TEST_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine_test)

mock_redis = MagicMock()
mock_redis.get.return_value = None
mock_redis.setex.return_value = True
mock_redis.delete.return_value = True

SAMPLE_ANSWERS = [{"questionId": i, "selectedOption": 2} for i in range(1, 16)]
AGGRESSIVE_ANSWERS = [{"questionId": i, "selectedOption": 3} for i in range(1, 16)]


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_db():
    import app.models  # noqa: F401
    Base.metadata.create_all(bind=engine_test)
    yield
    Base.metadata.drop_all(bind=engine_test)


@pytest.fixture
def client():
    app.dependency_overrides[get_db] = override_get_db
    with patch("app.routers.auth.get_redis", return_value=mock_redis), \
         patch("app.routers.portfolios.get_redis", return_value=mock_redis), \
         patch("app.core.email.send_verification_email"), \
         patch("app.core.email.send_password_reset_email"), \
         patch("app.services.portfolio_engine.build_portfolio"):
        with TestClient(app) as c:
            yield c
    app.dependency_overrides.clear()


def _register_and_verify(client: TestClient, email: str = "test@example.com") -> dict:
    """Helper: register a user and mark email as verified directly in DB."""
    client.post("/api/v1/auth/register", json={
        "fullName": "Test User", "email": email, "password": "password123"
    })
    # Directly mark verified via DB
    db = TestingSessionLocal()
    from app.models.user import User
    user = db.query(User).filter(User.email == email).first()
    if user:
        user.is_email_verified = True
        db.commit()
    db.close()
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": "password123"})
    return resp.json()


def _auth_headers(tokens: dict) -> dict:
    return {"Authorization": f"Bearer {tokens['accessToken']}"}


# ═══════════════════════════════════════════════════════════════════════════════
# FUNCTIONAL TEST SCENARIOS — mapped to RAD Use Cases
# ═══════════════════════════════════════════════════════════════════════════════

class TestUC01Register:
    """UC-01: Register / Sign Up"""

    def test_FT_01_successful_registration(self, client):
        """RAD UC-01 Main Flow: New user registers successfully."""
        resp = client.post("/api/v1/auth/register", json={
            "fullName": "Ali Yılmaz",
            "email": "ali@example.com",
            "password": "SecurePass123"
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["email"] == "ali@example.com"
        assert "message" in data

    def test_FT_02_duplicate_email_rejected(self, client):
        """RAD UC-01 Alternative Flow 3a: Duplicate email returns 409."""
        payload = {"fullName": "A B", "email": "dup@example.com", "password": "pass1234"}
        client.post("/api/v1/auth/register", json=payload)
        resp2 = client.post("/api/v1/auth/register", json=payload)
        assert resp2.status_code == 409

    def test_FT_03_weak_password_rejected(self, client):
        """RAD UC-01 Exception 3b: Password shorter than 8 chars returns 422."""
        resp = client.post("/api/v1/auth/register", json={
            "fullName": "A B", "email": "weak@example.com", "password": "short"
        })
        assert resp.status_code == 422

    def test_FT_04_invalid_email_format_rejected(self, client):
        """RAD UC-01 Exception 3b: Malformed email returns 422."""
        resp = client.post("/api/v1/auth/register", json={
            "fullName": "A B", "email": "not-an-email", "password": "password123"
        })
        assert resp.status_code == 422


class TestUC02Login:
    """UC-02: Login / Logout"""

    def test_FT_05_successful_login_returns_jwt(self, client):
        """RAD UC-02 Main Flow: Valid credentials return access and refresh tokens."""
        tokens = _register_and_verify(client, "login@example.com")
        assert "accessToken" in tokens
        assert "refreshToken" in tokens

    def test_FT_06_wrong_password_returns_401(self, client):
        """RAD UC-02 Alternative Flow 2a: Wrong password returns 401."""
        _register_and_verify(client, "badpass@example.com")
        resp = client.post("/api/v1/auth/login", json={
            "email": "badpass@example.com", "password": "wrongpassword"
        })
        assert resp.status_code == 401

    def test_FT_07_unverified_email_cannot_login(self, client):
        """RAD UC-01/UC-02: Unverified account is blocked at login with 403."""
        client.post("/api/v1/auth/register", json={
            "fullName": "U V", "email": "unverified@example.com", "password": "password123"
        })
        resp = client.post("/api/v1/auth/login", json={
            "email": "unverified@example.com", "password": "password123"
        })
        assert resp.status_code == 403

    def test_FT_08_logout_revokes_refresh_token(self, client):
        """RAD UC-02 Main Flow step 5: Refresh token is invalidated after logout."""
        tokens = _register_and_verify(client, "logout@example.com")
        client.post("/api/v1/auth/logout", json={"refreshToken": tokens["refreshToken"]})
        mock_redis.get.return_value = b"1"
        resp = client.post("/api/v1/auth/refresh", json={"refreshToken": tokens["refreshToken"]})
        assert resp.status_code == 401
        mock_redis.get.return_value = None

    def test_FT_09_token_refresh_issues_new_access_token(self, client):
        """SDD AuthRouter /auth/refresh: Valid refresh token produces new access token."""
        tokens = _register_and_verify(client, "refresh@example.com")
        resp = client.post("/api/v1/auth/refresh", json={"refreshToken": tokens["refreshToken"]})
        assert resp.status_code == 200
        assert "accessToken" in resp.json()


class TestUC02ForgotPassword:
    """UC-02 Extension: Forgot / Reset Password"""

    def test_FT_10_forgot_password_always_returns_204(self, client):
        """Security: Forgot password endpoint never reveals whether email exists."""
        # Known email
        _register_and_verify(client, "known@example.com")
        r1 = client.post("/api/v1/auth/forgot-password", json={"email": "known@example.com"})
        assert r1.status_code == 204
        # Unknown email — same response to prevent enumeration
        r2 = client.post("/api/v1/auth/forgot-password", json={"email": "nobody@example.com"})
        assert r2.status_code == 204

    def test_FT_11_reset_password_invalid_token_returns_400(self, client):
        """Reset with bogus token returns 400."""
        mock_redis.get.return_value = None
        resp = client.post("/api/v1/auth/reset-password", json={
            "token": "invalid_token_xyz", "new_password": "newpassword123"
        })
        assert resp.status_code == 400

    def test_FT_12_reset_password_valid_token_updates_password(self, client):
        """Full reset flow: token stored in Redis → password updated → old password fails."""
        tokens = _register_and_verify(client, "reset@example.com")

        db = TestingSessionLocal()
        from app.models.user import User
        user = db.query(User).filter(User.email == "reset@example.com").first()
        user_id = str(user.id)
        db.close()

        reset_token = "valid_reset_token_abc123"
        mock_redis.get.return_value = user_id.encode()
        resp = client.post("/api/v1/auth/reset-password", json={
            "token": reset_token, "new_password": "brandnewpass456"
        })
        assert resp.status_code == 204
        # Old password no longer works
        login_resp = client.post("/api/v1/auth/login", json={
            "email": "reset@example.com", "password": "password123"
        })
        assert login_resp.status_code == 401
        mock_redis.get.return_value = None


class TestUC03Assessment:
    """UC-03: Complete Risk Assessment Questionnaire"""

    def test_FT_13_submit_15_answers_returns_profile(self, client):
        """RAD UC-03 Main Flow: 15 answers produce a profile classification."""
        tokens = _register_and_verify(client, "assess@example.com")
        with patch("app.services.portfolio_engine.build_portfolio"):
            resp = client.post(
                "/api/v1/assessments",
                json={"answers": SAMPLE_ANSWERS},
                headers=_auth_headers(tokens),
            )
        assert resp.status_code in (200, 201)
        data = resp.json()
        assert data["profileType"] in ("conservative", "balanced", "aggressive")
        assert data["investmentHorizon"] in ("short", "medium", "long")

    def test_FT_14_incomplete_answers_rejected(self, client):
        """RAD UC-03 Exception: Less than 15 answers returns 422."""
        tokens = _register_and_verify(client, "incomplete@example.com")
        resp = client.post(
            "/api/v1/assessments",
            json={"answers": SAMPLE_ANSWERS[:5]},
            headers=_auth_headers(tokens),
        )
        assert resp.status_code == 422

    def test_FT_15_unauthenticated_assessment_rejected(self, client):
        """Security: Assessment endpoint requires authentication."""
        resp = client.post("/api/v1/assessments", json={"answers": SAMPLE_ANSWERS})
        assert resp.status_code == 401


class TestUC05Dashboard:
    """UC-05: View Portfolio Dashboard"""

    def test_FT_16_no_portfolio_returns_404(self, client):
        """RAD UC-05 Alternative Flow 2a: No portfolio → 404."""
        tokens = _register_and_verify(client, "noportfolio@example.com")
        resp = client.get("/api/v1/portfolios/current", headers=_auth_headers(tokens))
        assert resp.status_code == 404

    def test_FT_17_get_me_returns_user_info(self, client):
        """SDD AuthRouter /auth/me: Returns authenticated user details."""
        tokens = _register_and_verify(client, "me@example.com")
        resp = client.get("/api/v1/auth/me", headers=_auth_headers(tokens))
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == "me@example.com"
        assert data["isEmailVerified"] is True


class TestUC05PortfolioDelete:
    """Portfolio delete — new feature"""

    def test_FT_18_delete_portfolio_returns_204(self, client):
        """DELETE /portfolios/{id}: Authenticated user can delete own portfolio."""
        tokens = _register_and_verify(client, "delete@example.com")

        # Create a portfolio record directly in DB
        db = TestingSessionLocal()
        from app.models.user import User
        from app.models.portfolio import Portfolio
        import uuid
        from datetime import datetime, timezone

        user = db.query(User).filter(User.email == "delete@example.com").first()
        p = Portfolio(
            id=uuid.uuid4(),
            user_id=user.id,
            assessment_id=uuid.uuid4(),
            profile_type="balanced",
            horizon_type="medium",
            is_current=True,
            generated_at=datetime.now(timezone.utc),
            portfolio_score=75.0,
            expected_volatility=8.0,
        )
        db.add(p)
        db.commit()
        portfolio_id = str(p.id)
        db.close()

        resp = client.delete(f"/api/v1/portfolios/{portfolio_id}", headers=_auth_headers(tokens))
        assert resp.status_code == 204

    def test_FT_19_delete_other_users_portfolio_returns_404(self, client):
        """Security: User cannot delete another user's portfolio."""
        tokens_a = _register_and_verify(client, "usera@example.com")
        tokens_b = _register_and_verify(client, "userb@example.com")

        db = TestingSessionLocal()
        from app.models.user import User
        from app.models.portfolio import Portfolio
        import uuid
        from datetime import datetime, timezone

        user_a = db.query(User).filter(User.email == "usera@example.com").first()
        p = Portfolio(
            id=uuid.uuid4(),
            user_id=user_a.id,
            assessment_id=uuid.uuid4(),
            profile_type="conservative",
            horizon_type="short",
            is_current=True,
            generated_at=datetime.now(timezone.utc),
            portfolio_score=60.0,
            expected_volatility=5.0,
        )
        db.add(p)
        db.commit()
        portfolio_id = str(p.id)
        db.close()

        # User B tries to delete User A's portfolio
        resp = client.delete(f"/api/v1/portfolios/{portfolio_id}", headers=_auth_headers(tokens_b))
        assert resp.status_code == 404


class TestUC09Admin:
    """UC-09: Admin endpoints require admin role"""

    def test_FT_20_investor_cannot_access_admin_config(self, client):
        """RAD UC-09: Non-admin user is rejected from /admin/config."""
        tokens = _register_and_verify(client, "investor@example.com")
        resp = client.get("/api/v1/admin/config", headers=_auth_headers(tokens))
        assert resp.status_code == 403

    def test_FT_21_unauthenticated_admin_endpoint_returns_401(self, client):
        """Security: Admin endpoints require authentication."""
        resp = client.get("/api/v1/admin/config")
        assert resp.status_code == 401


class TestInputValidation:
    """RAD NFR 3.3.3: Malformed requests return HTTP 422"""

    def test_FT_22_missing_required_fields_returns_422(self, client):
        """Pydantic validation: missing required fields → 422."""
        resp = client.post("/api/v1/auth/register", json={"email": "missing@example.com"})
        assert resp.status_code == 422

    def test_FT_23_malformed_json_assessment_returns_422(self, client):
        """Pydantic validation: wrong answer format → 422."""
        tokens = _register_and_verify(client, "malform@example.com")
        resp = client.post(
            "/api/v1/assessments",
            json={"answers": "not-a-list"},
            headers=_auth_headers(tokens),
        )
        assert resp.status_code == 422


# ═══════════════════════════════════════════════════════════════════════════════
# NON-FUNCTIONAL TEST SCENARIOS
# ═══════════════════════════════════════════════════════════════════════════════

class TestNFRSecurity:
    """RAD 3.3.3 Security NFRs"""

    def test_NFT_01_password_not_returned_in_response(self, client):
        """Passwords must never appear in any API response."""
        resp = client.post("/api/v1/auth/register", json={
            "fullName": "Secure User", "email": "secure@example.com", "password": "password123"
        })
        assert "password" not in str(resp.json()).lower() or \
               "password123" not in str(resp.json())

    def test_NFT_02_jwt_token_present_in_login_response(self, client):
        """RAD NFR: JWT access token expires in 15 min — token must be issued."""
        tokens = _register_and_verify(client, "jwt@example.com")
        assert len(tokens["accessToken"]) > 20
        assert tokens["accessToken"].count(".") == 2  # JWT has 3 parts

    def test_NFT_03_protected_route_without_token_returns_401(self, client):
        """RAD NFR Security: All protected routes require valid JWT."""
        for endpoint in [
            "/api/v1/portfolios/current",
            "/api/v1/assessments/latest",
            "/api/v1/auth/me",
        ]:
            resp = client.get(endpoint)
            assert resp.status_code == 401, f"Expected 401 for {endpoint}, got {resp.status_code}"

    def test_NFT_04_invalid_jwt_returns_401(self, client):
        """Tampered JWT must be rejected."""
        resp = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer totally.fake.token"}
        )
        assert resp.status_code == 401

    def test_NFT_05_error_response_does_not_reveal_stack_trace(self, client):
        """Production: Error responses must not contain Python tracebacks."""
        resp = client.get(
            "/api/v1/portfolios/current",
            headers={"Authorization": "Bearer bad.token.here"}
        )
        body = resp.text
        assert "Traceback" not in body
        assert "File \"" not in body


class TestNFRPerformance:
    """RAD 3.3.2 Performance NFRs — tested against TestClient (no network overhead)"""

    def test_NFT_06_login_response_under_2_seconds(self, client):
        """RAD NFR: Login must be fast; TestClient baseline < 2s."""
        _register_and_verify(client, "perf@example.com")
        start = time.perf_counter()
        client.post("/api/v1/auth/login", json={
            "email": "perf@example.com", "password": "password123"
        })
        elapsed = time.perf_counter() - start
        assert elapsed < 2.0, f"Login took {elapsed:.2f}s — exceeds 2s threshold"

    def test_NFT_07_registration_response_under_3_seconds(self, client):
        """Registration including email dispatch (mocked) must complete < 3s."""
        start = time.perf_counter()
        client.post("/api/v1/auth/register", json={
            "fullName": "Perf Test", "email": "perf2@example.com", "password": "password123"
        })
        elapsed = time.perf_counter() - start
        assert elapsed < 3.0, f"Registration took {elapsed:.2f}s"

    def test_NFT_08_auth_me_under_500ms(self, client):
        """Dashboard /auth/me profile load must be fast."""
        tokens = _register_and_verify(client, "fast@example.com")
        start = time.perf_counter()
        client.get("/api/v1/auth/me", headers=_auth_headers(tokens))
        elapsed = time.perf_counter() - start
        assert elapsed < 0.5, f"/auth/me took {elapsed:.3f}s"


class TestNFRUsability:
    """RAD 3.3.1 Usability NFRs — API contract verification"""

    def test_NFT_09_api_returns_json_content_type(self, client):
        """All API responses must have application/json content-type."""
        resp = client.post("/api/v1/auth/login", json={
            "email": "nouser@example.com", "password": "wrong"
        })
        assert "application/json" in resp.headers.get("content-type", "")

    def test_NFT_10_error_responses_include_detail_field(self, client):
        """RAD NFR: Error responses must include a human-readable 'detail' field."""
        resp = client.post("/api/v1/auth/login", json={
            "email": "nobody@example.com", "password": "wrong"
        })
        assert "detail" in resp.json()

    def test_NFT_11_camelcase_response_fields(self, client):
        """SDD schema convention: responses use camelCase field names."""
        tokens = _register_and_verify(client, "camel@example.com")
        resp = client.get("/api/v1/auth/me", headers=_auth_headers(tokens))
        data = resp.json()
        assert "userId" in data
        assert "fullName" in data
        assert "createdAt" in data

    def test_NFT_12_register_returns_email_in_response(self, client):
        """UC-01 Postcondition: Response confirms the registered email."""
        resp = client.post("/api/v1/auth/register", json={
            "fullName": "Check Email", "email": "confirm@example.com", "password": "password123"
        })
        assert resp.json()["email"] == "confirm@example.com"


class TestNFRReliability:
    """RAD 3.3 + SDD 3.7.3: Graceful degradation"""

    def test_NFT_13_404_for_nonexistent_endpoint(self, client):
        """API returns structured 404 for unknown routes — no 500."""
        resp = client.get("/api/v1/doesnotexist")
        assert resp.status_code == 404

    def test_NFT_14_portfolio_list_returns_empty_list_not_404(self, client):
        """UC-05 variant: Listing portfolios with none returns [] not 404."""
        tokens = _register_and_verify(client, "empty@example.com")
        resp = client.get("/api/v1/portfolios", headers=_auth_headers(tokens))
        assert resp.status_code == 200
        assert resp.json() == []

    def test_NFT_15_resend_verification_always_204(self, client):
        """Security: Resend verification returns 204 regardless of email existence."""
        r1 = client.post("/api/v1/auth/resend-verification", json={"email": "ghost@example.com"})
        assert r1.status_code == 204
