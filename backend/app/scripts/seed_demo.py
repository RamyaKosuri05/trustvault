"""
TrustVault — Demo Seed Script
Creates demo users, categories, and documents for RISE judge evaluation.

USAGE:
  cd backend
  ALLOW_DEMO_SEED=true python -m app.scripts.seed_demo --confirm-demo-seed

NEVER run in production without explicit confirmation flag.

DEMO CREDENTIALS (document in README.md):
  Admin:  admin@trustvault.demo  / TrustVault#Admin2026!
  Owner:  owner@trustvault.demo  / TrustVault#Owner2026!
  Owner2: owner2@trustvault.demo / TrustVault#Owner2026!
  Viewer: viewer@trustvault.demo / TrustVault#Viewer2026!
"""
import argparse
import os
import sys
import uuid
from datetime import datetime, timezone

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.core.config import settings
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models import (
    AuditLog,
    Category,
    Document,
    DocumentPermission,
    DocumentVersion,
    UserSession,
    User,
)
from app.services.audit_service import record_audit_event
from app.services.storage_service import get_storage

# Valid minimal PDF binary (smallest valid PDF structure)
MINI_PDF = (
    b"%PDF-1.4\n"
    b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
    b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
    b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]\n"
    b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
    b"4 0 obj\n<< /Length 44 >>\nstream\nBT /F1 12 Tf 100 700 Td (TrustVault Demo Document) Tj ET\nendstream\nendobj\n"
    b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
    b"xref\n0 6\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n"
    b"0000000115 00000 n\n0000000266 00000 n\n0000000360 00000 n\n"
    b"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n440\n%%EOF"
)

# Valid minimal .txt content
BOARD_NOTES_TXT = (
    "Board Audit Notes - Q4 2026\n\n"
    "Confidential document owned by Owner2.\n"
    "This file is NOT accessible to Owner1 or Viewer without explicit grant.\n"
    "Security test: Cross-owner access must return 404 Not Found.\n"
).encode("utf-8")

DEMO_PASSWORD_ADMIN = "TrustVault#Admin2026!"
DEMO_PASSWORD_OWNER = "TrustVault#Owner2026!"
DEMO_PASSWORD_VIEWER = "TrustVault#Viewer2026!"


def run_seed(confirm: bool = False):
    if not confirm and not settings.ALLOW_DEMO_SEED:
        print("ERROR: Demo seed requires ALLOW_DEMO_SEED=true env var OR --confirm-demo-seed flag.")
        sys.exit(1)

    print("[SEED] Seeding TrustVault demo data...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # ---- Create Demo Users ----
        print("Creating demo users...")
        admin = _get_or_create_user(db, "Admin User", "admin@trustvault.demo", DEMO_PASSWORD_ADMIN, "admin")
        owner = _get_or_create_user(db, "Alice Owner", "owner@trustvault.demo", DEMO_PASSWORD_OWNER, "owner")
        owner2 = _get_or_create_user(db, "Bob Owner", "owner2@trustvault.demo", DEMO_PASSWORD_OWNER, "owner")
        viewer = _get_or_create_user(db, "Charlie Viewer", "viewer@trustvault.demo", DEMO_PASSWORD_VIEWER, "viewer")
        db.commit()

        # ---- Create Demo Categories ----
        print("Creating demo categories...")
        categories = {
            "HR & Compensation": "Human resources and compensation documents",
            "Legal & Contracts": "Legal agreements and client contracts",
            "Engineering & Architecture": "Technical design documents",
            "Compliance & Audit": "Compliance reports and audit records",
        }
        cat_map = {}
        for name, desc in categories.items():
            cat = db.query(Category).filter(Category.name == name).first()
            if not cat:
                cat = Category(id=uuid.uuid4(), name=name, description=desc, created_by=admin.id)
                db.add(cat)
            cat_map[name] = cat
        db.commit()

        # ---- Create Demo Documents ----
        print("Creating demo documents...")
        storage = get_storage()

        # Doc 1: Employee_Salary.pdf — NO grants (proves Viewer & Admin cannot read/download)
        doc1 = _get_or_create_document(
            db, storage, owner, cat_map["HR & Compensation"],
            name="Employee Salary Schedule 2026",
            original_filename="Employee_Salary.pdf",
            file_bytes=MINI_PDF,
            mime_type="application/pdf",
            ext=".pdf",
            description="Confidential salary data. No shares — tests that Viewer and Admin cannot access.",
        )

        # Doc 2: Client_Contract.pdf — READ grant to viewer
        doc2 = _get_or_create_document(
            db, storage, owner, cat_map["Legal & Contracts"],
            name="Client Contract — Acme Corp",
            original_filename="Client_Contract.pdf",
            file_bytes=MINI_PDF,
            mime_type="application/pdf",
            ext=".pdf",
            description="Client contract with read-only access for Viewer.",
        )
        _get_or_create_grant(db, doc2, viewer, "read", owner)

        # Doc 3: Project_Design.pdf — EDIT grant to viewer
        doc3 = _get_or_create_document(
            db, storage, owner, cat_map["Engineering & Architecture"],
            name="TrustVault System Architecture",
            original_filename="Project_Design.pdf",
            file_bytes=MINI_PDF,
            mime_type="application/pdf",
            ext=".pdf",
            description="Architecture document with edit access for Viewer.",
        )
        _get_or_create_grant(db, doc3, viewer, "edit", owner)

        # Doc 4: Board_Audit_Notes.txt — owned by owner2 (proves cross-owner isolation)
        doc4 = _get_or_create_document(
            db, storage, owner2, cat_map["Compliance & Audit"],
            name="Board Audit Notes Q4 2026",
            original_filename="Board_Audit_Notes.txt",
            file_bytes=BOARD_NOTES_TXT,
            mime_type="text/plain",
            ext=".txt",
            description="Private audit notes — only Owner2 can access this.",
        )

        db.commit()

        # ---- Seed Initial Audit Events (starts hash chain) ----
        print("Seeding initial audit events...")
        _seed_audit_events(db, admin, owner, owner2, viewer, doc1, doc2, doc3, doc4)
        db.commit()

        print("\n[SUCCESS] Demo seed complete!")
        print("\nDemo Credentials:")
        print(f"  Admin:  admin@trustvault.demo  / {DEMO_PASSWORD_ADMIN}")
        print(f"  Owner:  owner@trustvault.demo  / {DEMO_PASSWORD_OWNER}")
        print(f"  Owner2: owner2@trustvault.demo / {DEMO_PASSWORD_OWNER}")
        print(f"  Viewer: viewer@trustvault.demo / {DEMO_PASSWORD_VIEWER}")

    except Exception as e:
        db.rollback()
        print(f"\n[ERROR] Seed failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()


def _get_or_create_user(db, full_name, email, password, role):
    user = db.query(User).filter(User.email == email).first()
    if user:
        print(f"  User exists: {email}")
        return user
    user = User(
        id=uuid.uuid4(),
        full_name=full_name,
        email=email,
        password_hash=hash_password(password),
        role=role,
        is_active=True,
    )
    db.add(user)
    db.flush()
    print(f"  Created: {email} ({role})")
    return user


def _get_or_create_document(db, storage, owner, category, name, original_filename,
                             file_bytes, mime_type, ext, description=""):
    existing = db.query(Document).filter(
        Document.owner_id == owner.id,
        Document.name == name,
        Document.deleted_at.is_(None),
    ).first()
    if existing:
        print(f"  Document exists: {name}")
        # Ensure storage bytes are present in backend (self-healing)
        if not storage.exists(existing.storage_key):
            storage.put(existing.storage_key, file_bytes)
            print(f"  Restored missing storage bytes for: {name}")
        return existing

    import hashlib
    checksum = hashlib.sha256(file_bytes).hexdigest()
    storage_key = storage.generate_key()
    storage.put(storage_key, file_bytes)

    doc = Document(
        id=uuid.uuid4(),
        owner_id=owner.id,
        category_id=category.id,
        name=name,
        description=description,
        original_filename=original_filename,
        storage_key=storage_key,
        mime_type=mime_type,
        file_extension=ext,
        file_size=len(file_bytes),
        checksum_sha256=checksum,
        version_number=1,
    )
    db.add(doc)
    db.flush()
    print(f"  Created document: {name}")
    return doc


def _get_or_create_grant(db, doc, grantee, permission, granter):
    existing = db.query(DocumentPermission).filter(
        DocumentPermission.document_id == doc.id,
        DocumentPermission.user_id == grantee.id,
        DocumentPermission.revoked_at.is_(None),
    ).first()
    if existing:
        print(f"  Grant exists: {grantee.email} -> {permission} on {doc.name}")
        return existing

    perm = DocumentPermission(
        id=uuid.uuid4(),
        document_id=doc.id,
        user_id=grantee.id,
        permission=permission,
        granted_by=granter.id,
    )
    db.add(perm)
    db.flush()
    print(f"  Granted: {grantee.email} -> {permission} on {doc.name}")
    return perm


def _seed_audit_events(db, admin, owner, owner2, viewer, doc1, doc2, doc3, doc4):
    """Seed initial audit events to start the hash chain with realistic history. Idempotent."""
    has_system_init = db.query(AuditLog).filter(AuditLog.action == "SYSTEM_INITIALIZED").first()
    if has_system_init:
        print("  Audit events already seeded — skipping to preserve chain integrity.")
        return

    events = [
        {"action": "SYSTEM_INITIALIZED", "status": "success", "actor_id": admin.id,
         "details": {"message": "TrustVault demo environment initialized"}},
        {"action": "USER_REGISTERED", "status": "success", "actor_id": owner.id,
         "details": {"email": owner.email, "role": "owner"}},
        {"action": "USER_REGISTERED", "status": "success", "actor_id": owner2.id,
         "details": {"email": owner2.email, "role": "owner"}},
        {"action": "USER_REGISTERED", "status": "success", "actor_id": viewer.id,
         "details": {"email": viewer.email, "role": "viewer"}},
        {"action": "DOCUMENT_UPLOAD", "status": "success", "actor_id": owner.id,
         "document_id": doc1.id, "details": {"filename": doc1.original_filename}},
        {"action": "DOCUMENT_UPLOAD", "status": "success", "actor_id": owner.id,
         "document_id": doc2.id, "details": {"filename": doc2.original_filename}},
        {"action": "DOCUMENT_UPLOAD", "status": "success", "actor_id": owner.id,
         "document_id": doc3.id, "details": {"filename": doc3.original_filename}},
        {"action": "DOCUMENT_UPLOAD", "status": "success", "actor_id": owner2.id,
         "document_id": doc4.id, "details": {"filename": doc4.original_filename}},
        {"action": "PERMISSION_GRANTED", "status": "success", "actor_id": owner.id,
         "document_id": doc2.id, "details": {"grantee_email": viewer.email, "permission": "read"}},
        {"action": "PERMISSION_GRANTED", "status": "success", "actor_id": owner.id,
         "document_id": doc3.id, "details": {"grantee_email": viewer.email, "permission": "edit"}},
    ]

    for ev in events:
        doc_id = ev.pop("document_id", None)
        record_audit_event(
            db=db,
            document_id=doc_id,
            ip_address="127.0.0.1",
            user_agent="SeedScript/1.0",
            **ev,
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed TrustVault demo data")
    parser.add_argument("--confirm-demo-seed", action="store_true")
    args = parser.parse_args()
    run_seed(confirm=args.confirm_demo_seed)

