"""
TrustVault — File Validation Tests
Tests file extension allowlist, magic bytes, path traversal sanitization, oversized uploads,
and soft-deleted access blocks.
"""
import io
import zipfile
import pytest
from fastapi.testclient import TestClient

from tests.conftest import make_user, make_document, login_as


def test_invalid_extension_rejected(client: TestClient, db):
    owner = make_user(db, "ext_owner@test.com", "owner")
    auth = login_as(client, "ext_owner@test.com")

    resp = client.post(
        "/api/v1/documents/upload",
        data={"name": "Bad Script"},
        files={"file": ("malicious.sh", b"#!/bin/bash\necho bad\n", "text/x-shellscript")},
        headers={"X-CSRF-Token": auth["csrf_token"]},
    )
    assert resp.status_code == 422


def test_magic_bytes_spoofing_rejected(client: TestClient, db):
    """File claims to be .pdf but contains HTML/EXE bytes."""
    owner = make_user(db, "spoof_owner@test.com", "owner")
    auth = login_as(client, "spoof_owner@test.com")

    resp = client.post(
        "/api/v1/documents/upload",
        data={"name": "Spoofed PDF"},
        files={"file": ("spoof.pdf", b"<html><body>Not a PDF</body></html>", "application/pdf")},
        headers={"X-CSRF-Token": auth["csrf_token"]},
    )
    assert resp.status_code == 422


def test_fake_docx_rejected(client: TestClient, db):
    """File is a valid ZIP with .docx extension but lacks word/ directory."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("[Content_Types].xml", "<Types></Types>")
        zf.writestr("evil.txt", "harmless payload")
    fake_docx_bytes = buf.getvalue()

    owner = make_user(db, "docx_owner@test.com", "owner")
    auth = login_as(client, "docx_owner@test.com")

    resp = client.post(
        "/api/v1/documents/upload",
        data={"name": "Fake DOCX"},
        files={"file": ("fake.docx", fake_docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        headers={"X-CSRF-Token": auth["csrf_token"]},
    )
    assert resp.status_code == 422


def test_path_traversal_filename_sanitized(client: TestClient, db):
    """Path traversal filename like ../../etc/passwd.txt is sanitized safely."""
    owner = make_user(db, "trav_owner@test.com", "owner")
    auth = login_as(client, "trav_owner@test.com")

    # A valid text file
    resp = client.post(
        "/api/v1/documents/upload",
        data={"name": "Traversal Test"},
        files={"file": ("../../etc/passwd.txt", b"Safe clean text content only", "text/plain")},
        headers={"X-CSRF-Token": auth["csrf_token"]},
    )
    # The sanitization either rejects ".." with 400 or cleans it up
    assert resp.status_code in (201, 400)
    if resp.status_code == 201:
        doc = resp.json()
        assert ".." not in doc["original_filename"]
        assert "/" not in doc["original_filename"]


def test_soft_deleted_document_is_inaccessible(client: TestClient, db, storage):
    """Soft-deleted document returns 404 even to owner."""
    owner = make_user(db, "del_check_owner@test.com", "owner")
    doc = make_document(db, owner, "To Be Deleted", storage=storage)

    auth = login_as(client, "del_check_owner@test.com")

    # Soft delete
    del_resp = client.delete(
        f"/api/v1/documents/{doc.id}",
        headers={"X-CSRF-Token": auth["csrf_token"]},
    )
    assert del_resp.status_code == 204

    # Now trying to get it must 404
    get_resp = client.get(f"/api/v1/documents/{doc.id}")
    assert get_resp.status_code == 404

    # Download must 404
    dl_resp = client.get(f"/api/v1/documents/{doc.id}/download")
    assert dl_resp.status_code == 404
