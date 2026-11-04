"""
TrustVault — Audit Trail Integrity Tests
Tests cryptographic hash chain calculation, verification, and tamper detection.
"""
import pytest
from fastapi.testclient import TestClient

from app.models.audit_log import AuditLog
from tests.conftest import make_user, login_as


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
