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


def test_middle_row_deletion_detected_by_sequence_gap(client: TestClient, db):
    """Deleting a row from the middle of the audit table is caught by sequence gap check."""
    admin = make_user(db, "gap_admin@test.com", "admin")
    auth = login_as(client, "gap_admin@test.com")

    # Generate at least 4 audit events
    for i in range(4):
        client.post(
            "/api/v1/categories",
            json={"name": f"Gap Cat {i}"},
            headers={"X-CSRF-Token": auth["csrf_token"]},
        )

    # Initial chain must be valid
    v1 = client.get("/api/v1/audit/verify").json()
    assert v1["valid"] is True
    total = v1["total_events"]
    assert total >= 4

    # Delete the second row (sequence_number == 2)
    target = db.query(AuditLog).filter(AuditLog.sequence_number == 2).first()
    assert target is not None
    db.delete(target)
    db.commit()

    # Re-verify -> must detect sequence gap!
    v2 = client.get("/api/v1/audit/verify").json()
    assert v2["valid"] is False
    assert v2["broken_at_sequence"] == 2
    assert "Sequence gap" in v2["reason"]


def test_concurrent_audit_writes_preserve_linear_chain(engine_fixture):
    """Concurrent audit event records maintain contiguous sequence and valid SHA-256 chain."""
    import concurrent.futures
    import threading
    from sqlalchemy.orm import sessionmaker
    from app.services.audit_service import record_audit_event, verify_audit_chain

    SessionMaker = sessionmaker(bind=engine_fixture)
    is_sqlite = engine_fixture.dialect.name == "sqlite"
    sqlite_lock = threading.Lock()

    def write_event(idx: int):
        # On SQLite StaticPool, multiple threads cannot access the single raw dbapi connection simultaneously
        if is_sqlite:
            with sqlite_lock:
                thread_db = SessionMaker()
                try:
                    record_audit_event(
                        db=thread_db,
                        action="CONCURRENT_PROBE",
                        status="success",
                        actor_id=None,
                        document_id=None,
                        details={"thread_index": idx},
                    )
                    thread_db.commit()
                finally:
                    thread_db.close()
        else:
            thread_db = SessionMaker()
            try:
                record_audit_event(
                    db=thread_db,
                    action="CONCURRENT_PROBE",
                    status="success",
                    actor_id=None,
                    document_id=None,
                    details={"thread_index": idx},
                )
                thread_db.commit()
            finally:
                thread_db.close()

    # Dispatch 10 concurrent writes across worker threads
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        futures = [executor.submit(write_event, i) for i in range(10)]
        concurrent.futures.wait(futures)
        for f in futures:
            f.result()  # raise exception if any worker failed

    verify_db = SessionMaker()
    try:
        result = verify_audit_chain(verify_db)
        assert result["valid"] is True, f"Concurrent chain corrupted: {result}"
        assert result["total_events"] >= 10
    finally:
        verify_db.close()
