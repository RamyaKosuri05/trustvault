"""
TrustVault — Authorization Matrix Tests (BOLA/IDOR)
Tests cross-user access control across every document endpoint.

CRITICAL: These tests prove the security boundary. The mutation verification
script (verify_mutation_test.py) will disable authorize_document_access and
run these tests — they MUST FAIL when authorization is bypassed.
"""
import uuid
import pytest
from fastapi.testclient import TestClient

from tests.conftest import make_user, make_document, make_grant, login_as


class TestOwnerCrossUserIsolation:
    """Owner A cannot access, modify, or delete Owner B's documents."""

    def test_owner_cannot_view_other_owner_document(self, client: TestClient, db, storage):
        owner_a = make_user(db, "owner_a@test.com", "owner")
        owner_b = make_user(db, "owner_b@test.com", "owner")
        doc_b = make_document(db, owner_b, "Secret B", storage=storage)

        login_as(client, "owner_a@test.com")
        auth = login_as(client, "owner_a@test.com")
        resp = client.get(f"/api/v1/documents/{doc_b.id}")
        # Must return 404 (not 403) — anti-enumeration
        assert resp.status_code == 404, f"Cross-owner view must 404, got {resp.status_code}"

    def test_owner_cannot_download_other_owner_document(self, client: TestClient, db, storage):
        owner_a = make_user(db, "dl_owner_a@test.com", "owner")
        owner_b = make_user(db, "dl_owner_b@test.com", "owner")
        doc_b = make_document(db, owner_b, "Secret DL B", storage=storage)

        login_as(client, "dl_owner_a@test.com")
        resp = client.get(f"/api/v1/documents/{doc_b.id}/download")
        assert resp.status_code == 404

    def test_owner_cannot_patch_other_owner_document(self, client: TestClient, db, storage):
        owner_a = make_user(db, "patch_a@test.com", "owner")
        owner_b = make_user(db, "patch_b@test.com", "owner")
        doc_b = make_document(db, owner_b, "Patch Target B", storage=storage)

        auth = login_as(client, "patch_a@test.com")
        resp = client.patch(
            f"/api/v1/documents/{doc_b.id}",
            json={"name": "Hacked Name"},
            headers={"X-CSRF-Token": auth["csrf_token"]},
        )
        assert resp.status_code == 404

    def test_owner_cannot_delete_other_owner_document(self, client: TestClient, db, storage):
        owner_a = make_user(db, "del_a@test.com", "owner")
        owner_b = make_user(db, "del_b@test.com", "owner")
        doc_b = make_document(db, owner_b, "Delete Target B", storage=storage)

        auth = login_as(client, "del_a@test.com")
        resp = client.delete(
            f"/api/v1/documents/{doc_b.id}",
            headers={"X-CSRF-Token": auth["csrf_token"]},
        )
        assert resp.status_code == 404

    def test_owner_cannot_manage_permissions_on_other_owner_doc(self, client: TestClient, db, storage):
        owner_a = make_user(db, "perm_a@test.com", "owner")
        owner_b = make_user(db, "perm_b@test.com", "owner")
        viewer = make_user(db, "viewer_perm@test.com", "viewer")
        doc_b = make_document(db, owner_b, "Perm Target B", storage=storage)

        auth = login_as(client, "perm_a@test.com")
        resp = client.post(
            f"/api/v1/documents/{doc_b.id}/permissions",
            json={"email": "viewer_perm@test.com", "permission": "read"},
            headers={"X-CSRF-Token": auth["csrf_token"]},
        )
        assert resp.status_code == 404


class TestViewerRestrictions:
    """Viewer can only access documents with active grants."""

    def test_viewer_cannot_access_unshared_document(self, client: TestClient, db, storage):
        owner = make_user(db, "v_owner@test.com", "owner")
        viewer = make_user(db, "v_viewer@test.com", "viewer")
        doc = make_document(db, owner, "Unshared Doc", storage=storage)

        login_as(client, "v_viewer@test.com")
        resp = client.get(f"/api/v1/documents/{doc.id}")
        assert resp.status_code == 404

    def test_viewer_cannot_download_unshared_document(self, client: TestClient, db, storage):
        owner = make_user(db, "vdl_owner@test.com", "owner")
        viewer = make_user(db, "vdl_viewer@test.com", "viewer")
        doc = make_document(db, owner, "Unshared DL", storage=storage)

        login_as(client, "vdl_viewer@test.com")
        resp = client.get(f"/api/v1/documents/{doc.id}/download")
        assert resp.status_code == 404

    def test_viewer_read_grant_allows_view_and_download(self, client: TestClient, db, storage):
        owner = make_user(db, "vr_owner@test.com", "owner")
        viewer = make_user(db, "vr_viewer@test.com", "viewer")
        doc = make_document(db, owner, "Read Doc", file_bytes=b"%PDF-read-test", storage=storage)
        make_grant(db, doc, viewer, owner, "read")

        login_as(client, "vr_viewer@test.com")
        resp = client.get(f"/api/v1/documents/{doc.id}")
        assert resp.status_code == 200

        resp = client.get(f"/api/v1/documents/{doc.id}/download")
        assert resp.status_code == 200

    def test_viewer_read_grant_cannot_patch(self, client: TestClient, db, storage):
        owner = make_user(db, "vro_owner@test.com", "owner")
        viewer = make_user(db, "vro_viewer@test.com", "viewer")
        doc = make_document(db, owner, "Read Only Doc", storage=storage)
        make_grant(db, doc, viewer, owner, "read")

        auth = login_as(client, "vro_viewer@test.com")
        resp = client.patch(
            f"/api/v1/documents/{doc.id}",
            json={"name": "Hacked"},
            headers={"X-CSRF-Token": auth["csrf_token"]},
        )
        assert resp.status_code == 403

    def test_viewer_edit_grant_allows_patch(self, client: TestClient, db, storage):
        owner = make_user(db, "ve_owner@test.com", "owner")
        viewer = make_user(db, "ve_viewer@test.com", "viewer")
        doc = make_document(db, owner, "Editable Doc", storage=storage)
        make_grant(db, doc, viewer, owner, "edit")

        auth = login_as(client, "ve_viewer@test.com")
        resp = client.patch(
            f"/api/v1/documents/{doc.id}",
            json={"name": "Updated Name"},
            headers={"X-CSRF-Token": auth["csrf_token"]},
        )
        assert resp.status_code == 200

    def test_viewer_cannot_delete_even_with_edit_grant(self, client: TestClient, db, storage):
        owner = make_user(db, "vdel_owner@test.com", "owner")
        viewer = make_user(db, "vdel_viewer@test.com", "viewer")
        doc = make_document(db, owner, "No Delete", storage=storage)
        make_grant(db, doc, viewer, owner, "edit")

        auth = login_as(client, "vdel_viewer@test.com")
        resp = client.delete(
            f"/api/v1/documents/{doc.id}",
            headers={"X-CSRF-Token": auth["csrf_token"]},
        )
        assert resp.status_code == 403

    def test_viewer_cannot_grant_permissions(self, client: TestClient, db, storage):
        owner = make_user(db, "vgrant_owner@test.com", "owner")
        viewer = make_user(db, "vgrant_viewer@test.com", "viewer")
        other = make_user(db, "vgrant_other@test.com", "viewer")
        doc = make_document(db, owner, "Grant Test", storage=storage)
        make_grant(db, doc, viewer, owner, "edit")

        auth = login_as(client, "vgrant_viewer@test.com")
        resp = client.post(
            f"/api/v1/documents/{doc.id}/permissions",
            json={"email": "vgrant_other@test.com", "permission": "read"},
            headers={"X-CSRF-Token": auth["csrf_token"]},
        )
        assert resp.status_code == 403


class TestAdminRestrictions:
    """Admin can see metadata inventory but CANNOT download files without explicit grant."""

    def test_admin_can_list_documents(self, client: TestClient, db, storage):
        admin = make_user(db, "admin_list@test.com", "admin")
        owner = make_user(db, "owner_list@test.com", "owner")
        doc = make_document(db, owner, "Admin List Test", storage=storage)

        login_as(client, "admin_list@test.com")
        resp = client.get("/api/v1/documents")
        assert resp.status_code == 200
        # Admin sees the document but can_download should be False
        items = resp.json()["items"]
        matching = [i for i in items if str(i["id"]) == str(doc.id)]
        if matching:
            assert matching[0]["can_download"] == False
            assert matching[0]["user_permission"] == "metadata_only"

    def test_admin_cannot_download_without_grant(self, client: TestClient, db, storage):
        """CRITICAL: Admin CANNOT download files without explicit grant. Must return 403."""
        admin = make_user(db, "admin_dl@test.com", "admin")
        owner = make_user(db, "owner_dl@test.com", "owner")
        doc = make_document(db, owner, "Admin DL Test", file_bytes=b"%PDF-admin-test", storage=storage)

        login_as(client, "admin_dl@test.com")
        resp = client.get(f"/api/v1/documents/{doc.id}/download")
        assert resp.status_code == 403, f"Admin must NOT download without grant, got {resp.status_code}"

    def test_admin_cannot_grant_self_access(self, client: TestClient, db, storage):
        """Admin cannot grant themselves permission on another owner's document."""
        admin = make_user(db, "admin_self@test.com", "admin")
        owner = make_user(db, "owner_self@test.com", "owner")
        doc = make_document(db, owner, "Admin Self Grant", storage=storage)

        auth = login_as(client, "admin_self@test.com")
        resp = client.post(
            f"/api/v1/documents/{doc.id}/permissions",
            json={"email": "admin_self@test.com", "permission": "read"},
            headers={"X-CSRF-Token": auth["csrf_token"]},
        )
        # Admin sees document as metadata only, but cannot grant permissions (owner required)
        assert resp.status_code == 403

    def test_admin_download_audit_log_created_on_403(self, client: TestClient, db, storage):
        """403 on admin download must still create DENIED audit log entry."""
        admin = make_user(db, "admin_audit@test.com", "admin")
        owner = make_user(db, "owner_audit@test.com", "owner")
        doc = make_document(db, owner, "Audit Test", file_bytes=b"%PDF-audit", storage=storage)

        login_as(client, "admin_audit@test.com")
        resp = client.get(f"/api/v1/documents/{doc.id}/download")
        assert resp.status_code == 403

        from app.models.audit_log import AuditLog
        log = db.query(AuditLog).filter(
            AuditLog.action == "ADMIN_CONTENT_ACCESS_BLOCKED",
            AuditLog.status == "denied",
            AuditLog.actor_id == admin.id,
        ).first()
        assert log is not None, "ADMIN_CONTENT_ACCESS_BLOCKED must be logged on 403"

    def test_admin_cannot_patch_other_owner_document(self, client: TestClient, db, storage):
        """Admin cannot PATCH document metadata on other owner's document without grant."""
        admin = make_user(db, "admin_patch@test.com", "admin")
        owner = make_user(db, "owner_patch@test.com", "owner")
        doc = make_document(db, owner, "Secret Admin Patch", storage=storage)

        auth = login_as(client, "admin_patch@test.com")
        resp = client.patch(
            f"/api/v1/documents/{doc.id}",
            json={"name": "Admin Tampered"},
            headers={"X-CSRF-Token": auth["csrf_token"]},
        )
        assert resp.status_code == 403

    def test_admin_cannot_delete_other_owner_document(self, client: TestClient, db, storage):
        """Admin cannot DELETE other owner's document."""
        admin = make_user(db, "admin_del@test.com", "admin")
        owner = make_user(db, "owner_del@test.com", "owner")
        doc = make_document(db, owner, "Secret Admin Del", storage=storage)

        auth = login_as(client, "admin_del@test.com")
        resp = client.delete(
            f"/api/v1/documents/{doc.id}",
            headers={"X-CSRF-Token": auth["csrf_token"]},
        )
        assert resp.status_code == 403

    def test_admin_cannot_put_version_on_other_owner_document(self, client: TestClient, db, storage):
        """Admin cannot PUT file new version on other owner's document."""
        admin = make_user(db, "admin_ver@test.com", "admin")
        owner = make_user(db, "owner_ver@test.com", "owner")
        doc = make_document(db, owner, "Secret Admin Ver", storage=storage)

        auth = login_as(client, "admin_ver@test.com")
        resp = client.put(
            f"/api/v1/documents/{doc.id}/file",
            files={"file": ("v2.pdf", b"%PDF-v2newcontent", "application/pdf")},
            headers={"X-CSRF-Token": auth["csrf_token"]},
        )
        assert resp.status_code == 403


class TestSearchAntiEnumeration:
    """Search/list must NOT leak document names/metadata for unauthorized documents."""

    def test_viewer_search_returns_no_ungranted_results(self, client: TestClient, db, storage):
        """Searching 'Salary' as Viewer returns 0 results (no metadata leak)."""
        owner = make_user(db, "salary_owner@test.com", "owner")
        viewer = make_user(db, "salary_viewer@test.com", "viewer")
        doc = make_document(db, owner, "Employee Salary 2026", storage=storage)
        # NO grant to viewer

        login_as(client, "salary_viewer@test.com")
        resp = client.get("/api/v1/documents?q=Salary")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0, f"Viewer must see 0 ungranted results, got {data['total']}"
        assert len(data["items"]) == 0

    def test_search_wildcard_escaping_does_not_leak_unauthorized(self, client: TestClient, db, storage):
        """Passing % or _ in query string escapes LIKE pattern properly."""
        owner = make_user(db, "wildcard_owner@test.com", "owner")
        viewer = make_user(db, "wildcard_viewer@test.com", "viewer")
        make_document(db, owner, "Confidential Secret 1", storage=storage)
        make_document(db, owner, "Confidential Secret 2", storage=storage)

        login_as(client, "wildcard_viewer@test.com")
        # Attacker tries searching '%' or '_' to match all or probe
        resp_pct = client.get("/api/v1/documents?q=%")
        assert resp_pct.status_code == 200
        assert resp_pct.json()["total"] == 0

        resp_underscore = client.get("/api/v1/documents?q=_")
        assert resp_underscore.status_code == 200
        assert resp_underscore.json()["total"] == 0

    def test_download_security_headers_enforced(self, client: TestClient, db, storage):
        """Download responses enforce strict attachment, no-cache, and nosniff headers."""
        owner = make_user(db, "headers_owner@test.com", "owner")
        doc = make_document(db, owner, "Headers Test", file_bytes=b"%PDF-safe", storage=storage)

        login_as(client, "headers_owner@test.com")
        resp = client.get(f"/api/v1/documents/{doc.id}/download")
        assert resp.status_code == 200

        headers = resp.headers
        assert "attachment" in headers.get("content-disposition", "")
        assert "nosniff" == headers.get("x-content-type-options")
        assert "no-store" in headers.get("cache-control", "")
        assert "no-cache" in headers.get("cache-control", "")
        assert "must-revalidate" in headers.get("cache-control", "")


class TestUnauthenticated:
    def test_all_document_endpoints_require_auth(self, client: TestClient):
        fake_id = uuid.uuid4()
        endpoints = [
            ("GET", f"/api/v1/documents"),
            ("GET", f"/api/v1/documents/{fake_id}"),
            ("GET", f"/api/v1/documents/{fake_id}/download"),
            ("PATCH", f"/api/v1/documents/{fake_id}"),
            ("DELETE", f"/api/v1/documents/{fake_id}"),
        ]
        for method, path in endpoints:
            resp = client.request(method, path)
            assert resp.status_code == 401, f"{method} {path} must require auth, got {resp.status_code}"

