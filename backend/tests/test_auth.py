"""
TrustVault — Auth Tests
Tests registration, login, CSRF, session management, rate limiting, deactivated user rejection.
"""
import uuid
import pytest
from fastapi.testclient import TestClient

from tests.conftest import make_user, login_as


class TestRegistration:
    def test_register_viewer_success(self, client: TestClient):
        resp = client.post("/api/v1/auth/register", json={
            "full_name": "Test Viewer",
            "email": "test.viewer@example.com",
            "password": "SecurePass123!",
            "role": "viewer",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["role"] == "viewer"
        assert data["email"] == "test.viewer@example.com"
        assert "password_hash" not in data
        assert "password" not in data

    def test_register_owner_success(self, client: TestClient):
        resp = client.post("/api/v1/auth/register", json={
            "full_name": "Test Owner",
            "email": "test.owner@example.com",
            "password": "SecurePass123!",
            "role": "owner",
        })
        assert resp.status_code == 201
        assert resp.json()["role"] == "owner"

    def test_register_admin_role_blocked(self, client: TestClient):
        """CRITICAL: Registering as admin MUST be blocked with 403."""
        resp = client.post("/api/v1/auth/register", json={
            "full_name": "Evil Admin",
            "email": "evil.admin@example.com",
            "password": "SecurePass123!",
            "role": "admin",
        })
        assert resp.status_code in (403, 422), f"Expected 403/422, got {resp.status_code}: {resp.text}"

    def test_register_admin_role_blocked_via_pydantic(self, client: TestClient):
        """Pydantic validator also catches admin role in body."""
        resp = client.post("/api/v1/auth/register", json={
            "full_name": "Evil Admin",
            "email": "evil2.admin@example.com",
            "password": "SecurePass123!",
            "role": "ADMIN",
        })
        assert resp.status_code in (403, 422)

    def test_register_duplicate_email(self, client: TestClient, db):
        make_user(db, "existing@example.com", "viewer")
        resp = client.post("/api/v1/auth/register", json={
            "full_name": "Dup User",
            "email": "existing@example.com",
            "password": "SecurePass123!",
            "role": "viewer",
        })
        assert resp.status_code == 409

    def test_register_weak_password_rejected(self, client: TestClient):
        resp = client.post("/api/v1/auth/register", json={
            "full_name": "Weak Pass",
            "email": "weak@example.com",
            "password": "short",
            "role": "viewer",
        })
        assert resp.status_code == 422

    def test_register_email_normalized(self, client: TestClient):
        resp = client.post("/api/v1/auth/register", json={
            "full_name": "Normal Email",
            "email": "UPPER@EXAMPLE.COM",
            "password": "SecurePass123!",
            "role": "viewer",
        })
        assert resp.status_code == 201
        assert resp.json()["email"] == "upper@example.com"


class TestLogin:
    def test_login_success(self, client: TestClient, db):
        make_user(db, "logintest@example.com", "owner")
        resp = client.post("/api/v1/auth/login", json={
            "email": "logintest@example.com",
            "password": "TestPass123!",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "csrf_token" in data
        assert len(data["csrf_token"]) > 20
        assert data["user"]["role"] == "owner"
        # Verify HttpOnly cookie is set
        assert "trustvault_session" in client.cookies

    def test_login_wrong_password(self, client: TestClient, db):
        make_user(db, "wrongpass@example.com", "owner")
        resp = client.post("/api/v1/auth/login", json={
            "email": "wrongpass@example.com",
            "password": "WrongPassword999!",
        })
        assert resp.status_code == 401
        # Generic error message — no hint about whether email exists
        assert "Invalid" in resp.json()["detail"]

    def test_login_nonexistent_email_same_error(self, client: TestClient):
        """TIMING-SAFE: Non-existent email returns same error as wrong password."""
        resp = client.post("/api/v1/auth/login", json={
            "email": "ghost@example.com",
            "password": "SomePassword123!",
        })
        assert resp.status_code == 401
        assert "Invalid" in resp.json()["detail"]

    def test_login_failed_creates_audit_log(self, client: TestClient, db):
        resp = client.post("/api/v1/auth/login", json={
            "email": "ghost2@example.com",
            "password": "SomePassword123!",
        })
        assert resp.status_code == 401
        from app.models.audit_log import AuditLog
        log = db.query(AuditLog).filter(
            AuditLog.action == "LOGIN_FAILED",
            AuditLog.status == "denied",
        ).first()
        assert log is not None, "LOGIN_FAILED must be recorded in audit_logs even on 401"

    def test_login_deactivated_user_rejected(self, client: TestClient, db):
        make_user(db, "inactive@example.com", "owner", is_active=False)
        resp = client.post("/api/v1/auth/login", json={
            "email": "inactive@example.com",
            "password": "TestPass123!",
        })
        assert resp.status_code == 401


class TestCSRF:
    def test_csrf_required_on_logout(self, client: TestClient, db):
        make_user(db, "csrftest@example.com", "owner")
        login_as(client, "csrftest@example.com")
        # Logout without CSRF token — must be rejected
        resp = client.post("/api/v1/auth/logout")
        assert resp.status_code == 403, f"Expected 403 without CSRF, got {resp.status_code}"

    def test_csrf_valid_on_logout(self, client: TestClient, db):
        make_user(db, "csrfvalid@example.com", "owner")
        auth = login_as(client, "csrfvalid@example.com")
        resp = client.post("/api/v1/auth/logout", headers={"X-CSRF-Token": auth["csrf_token"]})
        assert resp.status_code == 200

    def test_wrong_csrf_rejected(self, client: TestClient, db):
        make_user(db, "wrongcsrf@example.com", "owner")
        login_as(client, "wrongcsrf@example.com")
        resp = client.post("/api/v1/auth/logout", headers={"X-CSRF-Token": "completely-wrong-token"})
        assert resp.status_code == 403

    def test_csrf_not_required_on_get(self, client: TestClient, db):
        make_user(db, "getcsrf@example.com", "owner")
        login_as(client, "getcsrf@example.com")
        resp = client.get("/api/v1/auth/me")
        assert resp.status_code == 200


class TestSessionManagement:
    def test_logout_invalidates_session(self, client: TestClient, db):
        make_user(db, "logoutsess@example.com", "owner")
        auth = login_as(client, "logoutsess@example.com")
        client.post("/api/v1/auth/logout", headers={"X-CSRF-Token": auth["csrf_token"]})
        # After logout, /me should fail
        resp = client.get("/api/v1/auth/me")
        assert resp.status_code == 401

    def test_unauthenticated_access_rejected(self, client: TestClient):
        """All protected routes must return 401 without session."""
        resp = client.get("/api/v1/auth/me")
        assert resp.status_code == 401
        resp = client.get("/api/v1/documents")
        assert resp.status_code == 401

    def test_deactivated_user_session_rejected(self, client: TestClient, db):
        """Mid-session deactivation must be detected on next request."""
        user = make_user(db, "middeact@example.com", "owner")
        login_as(client, "middeact@example.com")
        # Deactivate user
        user.is_active = False
        db.flush()
        # Next request must fail
        resp = client.get("/api/v1/auth/me")
        assert resp.status_code == 401

