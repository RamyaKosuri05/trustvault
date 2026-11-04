"""
TrustVault — Audit Trail Integrity Tests
Tests cryptographic hash chain calculation, verification, and tamper detection.
"""
import pytest
from fastapi.testclient import TestClient

from app.models.audit_log import AuditLog
from tests.conftest import make_user, make_document, login_as


def test_audit_chain_verification_clean(client: TestClient, db):
    """Clean chain returns valid: True."""
    admin = make_user(db, "audit_admin@test.com", "admin")
    auth = login_as(client, "audit_admin@test.com")

    resp = client.get("/api/v1/audit/verify")
    assert resp.status_code == 200
    data = resp.json()
    assert data["valid"] is True, f"Audit verification failed: {data}"


def test_tampering_detection(client: TestClient, db):
    """Mutating row details or status breaks chain integrity check."""
    admin = make_user(db, "tamper_admin@test.com", "admin")
    auth = login_as(client, "tamper_admin@test.com")

    # Generate some audit events
    client.post("/api/v1/categories", json={"name": "Tamper Cat"}, headers={"X-CSRF-Token": auth["csrf_token"]})
    client.post("/api/v1/categories", json={"name": "Tamper Cat 2"}, headers={"X-CSRF-Token": auth["csrf_token"]})

    # Chain should be valid first
    v1 = client.get("/api/v1/audit/verify").json()
    assert v1["valid"] is True

    # Tamper with an audit entry in DB
    last_log = db.query(AuditLog).order_by(AuditLog.sequence_number.desc()).first()
    assert last_log is not None
    last_log.action = "TAMPERED_ACTION"
    db.flush()

    # Re-verify -> should fail!
    v2 = client.get("/api/v1/audit/verify").json()
    assert v2["valid"] is False
    assert v2["broken_at_sequence"] == last_log.sequence_number


def test_audit_rollback_persistence_on_unauthorized_download(client: TestClient, db, storage, engine_fixture):
    """
    Denied access attempts persist in audit_logs via independent DB session
    even though the request raised 404 and rolled back the HTTP request transaction.
    The resulting cryptographic chain remains valid.
    """
    from sqlalchemy.orm import sessionmaker

    admin = make_user(db, "audit_admin2@test.com", "admin")
    owner = make_user(db, "doc_owner@test.com", "owner")
    doc = make_document(db, owner, "Confidential Financials", storage=storage)
    viewer = make_user(db, "unauth_viewer@test.com", "viewer")
    db.commit()

    login_as(client, "unauth_viewer@test.com")
    resp = client.get(f"/api/v1/documents/{doc.id}/download")
    assert resp.status_code == 404, f"Expected 404, got {resp.status_code}"

    # Query audit_logs using a fresh independent session from engine_fixture
    FreshSession = sessionmaker(bind=engine_fixture)
    fresh_db = FreshSession()
    try:
        denied_entry = (
            fresh_db.query(AuditLog)
            .filter(
                AuditLog.actor_id == viewer.id,
                AuditLog.status == "denied",
                AuditLog.action == "UNAUTHORIZED_DOCUMENT_ACCESS",
            )
            .first()
        )
        assert denied_entry is not None, "Denied audit event must persist across request termination!"
        assert denied_entry.document_id == doc.id
    finally:
        fresh_db.close()

    # Now verify the entire audit chain as admin — must be cryptographically valid!
    login_as(client, "audit_admin2@test.com")
    v_resp = client.get("/api/v1/audit/verify")
    assert v_resp.status_code == 200
    v_data = v_resp.json()
    assert v_data["valid"] is True, f"Audit chain must be valid after denied event: {v_data}"
