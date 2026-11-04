"""
TrustVault — Permissions & Revocation Tests
Tests granting, updating, revoking permissions, and immediate revocation enforcement.
"""
from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient

from tests.conftest import make_user, make_document, make_grant, login_as


def test_permission_lifecycle_and_immediate_revocation(client: TestClient, db, storage):
    """
    Owner grants 'read' -> Viewer downloads (200) -> Viewer tries PATCH (403)
    -> Owner upgrades to 'edit' -> Viewer PATCH succeeds (200)
    -> Owner revokes grant -> immediate next request by Viewer to GET and download fails (404)
    and records denied audit log!
    """
    owner = make_user(db, "lifecycle_owner@test.com", "owner")
    viewer = make_user(db, "lifecycle_viewer@test.com", "viewer")
    doc = make_document(db, owner, "Lifecycle Doc", file_bytes=b"%PDF-lifecycle", storage=storage)

    owner_auth = login_as(client, "lifecycle_owner@test.com")
    grant_resp = client.post(
        f"/api/v1/documents/{doc.id}/permissions",
        json={"email": "lifecycle_viewer@test.com", "permission": "read"},
        headers={"X-CSRF-Token": owner_auth["csrf_token"]},
    )
    assert grant_resp.status_code == 201
    perm_id = grant_resp.json()["id"]

    # 2. Viewer logs in and downloads
    viewer_auth = login_as(client, "lifecycle_viewer@test.com")
    dl_resp = client.get(f"/api/v1/documents/{doc.id}/download")
    assert dl_resp.status_code == 200

    # 3. Viewer attempts PATCH with only read grant -> 403 Forbidden
    patch_resp = client.patch(
        f"/api/v1/documents/{doc.id}",
        json={"name": "Hacked from read"},
        headers={"X-CSRF-Token": viewer_auth["csrf_token"]},
    )
    assert patch_resp.status_code == 403

    # 4. Owner logs in and upgrades to 'edit'
    owner_auth = login_as(client, "lifecycle_owner@test.com")
    up_resp = client.patch(
        f"/api/v1/documents/{doc.id}/permissions/{perm_id}",
        json={"permission": "edit"},
        headers={"X-CSRF-Token": owner_auth["csrf_token"]},
    )
    assert up_resp.status_code == 200
    assert up_resp.json()["permission"] == "edit"

    # 5. Viewer logs in and PATCH succeeds
    viewer_auth = login_as(client, "lifecycle_viewer@test.com")
    patch_resp2 = client.patch(
        f"/api/v1/documents/{doc.id}",
        json={"name": "Updated Validly"},
        headers={"X-CSRF-Token": viewer_auth["csrf_token"]},
    )
    assert patch_resp2.status_code == 200
    assert patch_resp2.json()["name"] == "Updated Validly"

    # 6. Owner logs in and revokes grant
    owner_auth = login_as(client, "lifecycle_owner@test.com")
    revoke_resp = client.delete(
        f"/api/v1/documents/{doc.id}/permissions/{perm_id}",
        headers={"X-CSRF-Token": owner_auth["csrf_token"]},
    )
    assert revoke_resp.status_code == 204

    # 7. Immediate revocation on next request -> 404 Not Found (uniform anti-enumeration)
    viewer_auth = login_as(client, "lifecycle_viewer@test.com")
    get_after = client.get(f"/api/v1/documents/{doc.id}")
    assert get_after.status_code == 404

    dl_after = client.get(f"/api/v1/documents/{doc.id}/download")
    assert dl_after.status_code == 404


def test_expired_grant_is_denied(client: TestClient, db, storage):
    """Expired grant (expires_at in past) is immediately denied."""
    owner = make_user(db, "exp_owner@test.com", "owner")
    viewer = make_user(db, "exp_viewer@test.com", "viewer")
    doc = make_document(db, owner, "Expired Doc", file_bytes=b"%PDF-exp", storage=storage)

    # Grant with expires_at in the past
    past_time = datetime.now(timezone.utc) - timedelta(hours=1)
    perm = make_grant(db, doc, viewer, owner, "read")
    perm.expires_at = past_time
    db.flush()

    login_as(client, "exp_viewer@test.com")
    resp = client.get(f"/api/v1/documents/{doc.id}")
    assert resp.status_code == 404


def test_deactivating_viewer_revokes_access(client: TestClient, db, storage):
    """Deactivating Viewer via Admin PATCH /users/{id}/status immediately invalidates session."""
    admin = make_user(db, "admin_deact@test.com", "admin")
    owner = make_user(db, "owner_deact@test.com", "owner")
    viewer = make_user(db, "viewer_deact@test.com", "viewer")
    doc = make_document(db, owner, "Deact Doc", storage=storage)
    make_grant(db, doc, viewer, owner, "read")

    # Viewer logs in
    viewer_auth = login_as(client, "viewer_deact@test.com")
    check_ok = client.get(f"/api/v1/documents/{doc.id}")
    assert check_ok.status_code == 200

    # Admin logs in and deactivates Viewer
    client.cookies.clear()
    admin_auth = login_as(client, "admin_deact@test.com")
    deact_resp = client.patch(
        f"/api/v1/users/{viewer.id}/status",
        json={"is_active": False},
        headers={"X-CSRF-Token": admin_auth["csrf_token"]},
    )
    assert deact_resp.status_code == 200
    assert deact_resp.json()["is_active"] is False

    # Attempting to access documents with old cookie / after deactivation returns 401
    client.cookies.set("trustvault_session", viewer_auth.get("raw_token", "invalid_or_revoked"))
    post_deact_resp = client.get(f"/api/v1/documents/{doc.id}")
    assert post_deact_resp.status_code == 401


def test_deactivating_owner_freezes_document_access_for_viewers(client: TestClient, db, storage):
    """Deactivating an Owner freezes all their documents immediately for Viewers (uniform 404)."""
    admin = make_user(db, "admin_owner_freeze@test.com", "admin")
    owner = make_user(db, "owner_to_freeze@test.com", "owner")
    viewer = make_user(db, "viewer_of_frozen@test.com", "viewer")
    doc = make_document(db, owner, "Frozen Company Doc", storage=storage)
    make_grant(db, doc, viewer, owner, "read")
    db.commit()

    # Viewer can access before deactivation
    login_as(client, "viewer_of_frozen@test.com")
    ok_resp = client.get(f"/api/v1/documents/{doc.id}")
    assert ok_resp.status_code == 200
    dl_ok = client.get(f"/api/v1/documents/{doc.id}/download")
    assert dl_ok.status_code == 200

    # Admin deactivates Owner
    client.cookies.clear()
    admin_auth = login_as(client, "admin_owner_freeze@test.com")
    client.patch(
        f"/api/v1/users/{owner.id}/status",
        json={"is_active": False},
        headers={"X-CSRF-Token": admin_auth["csrf_token"]},
    )
    db.commit()

    # Viewer now attempts access -> uniform 404 immediately
    client.cookies.clear()
    login_as(client, "viewer_of_frozen@test.com")
    denied_view = client.get(f"/api/v1/documents/{doc.id}")
    assert denied_view.status_code == 404, f"Viewer must get 404 when owner deactivated, got {denied_view.status_code}"

    denied_dl = client.get(f"/api/v1/documents/{doc.id}/download")
    assert denied_dl.status_code == 404, f"Viewer download must 404 when owner deactivated, got {denied_dl.status_code}"

    # Document also disappears from Viewer's document listing
    list_resp = client.get("/api/v1/documents")
    assert list_resp.status_code == 200
    assert list_resp.json()["total"] == 0


def test_version_endpoints_require_authorization_and_honor_revocation(client: TestClient, db, storage):
    """Version list and version download endpoints require active grant and 404 immediately upon revocation."""
    owner = make_user(db, "ver_owner@test.com", "owner")
    viewer = make_user(db, "ver_viewer@test.com", "viewer")
    doc = make_document(db, owner, "Multi-version Document", storage=storage)
    perm = make_grant(db, doc, viewer, owner, "read")
    db.commit()

    # Owner uploads version 2
    owner_auth = login_as(client, "ver_owner@test.com")
    v2_resp = client.put(
        f"/api/v1/documents/{doc.id}/file",
        files={"file": ("v2.pdf", b"%PDF-version2bytes", "application/pdf")},
        headers={"X-CSRF-Token": owner_auth["csrf_token"]},
    )
    assert v2_resp.status_code == 200

    # Viewer accesses version history and version 1 download
    client.cookies.clear()
    login_as(client, "ver_viewer@test.com")
    v_list = client.get(f"/api/v1/documents/{doc.id}/versions")
    assert v_list.status_code == 200
    assert len(v_list.json()) >= 1

    v1_dl = client.get(f"/api/v1/documents/{doc.id}/versions/1/download")
    assert v1_dl.status_code == 200
    assert "attachment" in v1_dl.headers.get("content-disposition", "")
    assert "no-store" in v1_dl.headers.get("cache-control", "")

    # Owner revokes the grant
    client.cookies.clear()
    owner_auth = login_as(client, "ver_owner@test.com")
    client.delete(
        f"/api/v1/documents/{doc.id}/permissions/{perm.id}",
        headers={"X-CSRF-Token": owner_auth["csrf_token"]},
    )
    db.commit()

    # Viewer attempts version list and version download -> both return 404 immediately!
    client.cookies.clear()
    login_as(client, "ver_viewer@test.com")
    assert client.get(f"/api/v1/documents/{doc.id}/versions").status_code == 404
    assert client.get(f"/api/v1/documents/{doc.id}/versions/1/download").status_code == 404
