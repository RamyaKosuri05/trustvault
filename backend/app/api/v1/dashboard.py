"""
TrustVault — Dashboard Routes (100% live DB queries — zero hardcoded numbers)
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.models.audit_log import AuditLog
from app.models.document import Document
from app.models.permission import DocumentPermission
from app.models.user import User
from app.schemas import AdminDashboardResponse, OwnerDashboardResponse, ViewerDashboardResponse
from app.services.audit_service import verify_audit_chain

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


@router.get("/owner", response_model=OwnerDashboardResponse)
async def owner_dashboard(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Owner dashboard — live statistics for the authenticated owner."""
    if user.role not in ("owner", "admin"):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Owner dashboard requires owner role.")

    now = _now_utc()
    total_docs = db.query(func.count(Document.id)).filter(
        Document.owner_id == user.id, Document.deleted_at.is_(None)
    ).scalar() or 0

    # Documents with at least one active grant
    shared = db.query(func.count(Document.id.distinct())).join(
        DocumentPermission,
        (DocumentPermission.document_id == Document.id) &
        DocumentPermission.revoked_at.is_(None) &
        (or_(DocumentPermission.expires_at.is_(None), DocumentPermission.expires_at > now))
    ).filter(Document.owner_id == user.id, Document.deleted_at.is_(None)).scalar() or 0

    total_grants = db.query(func.count(DocumentPermission.id)).join(
        Document, Document.id == DocumentPermission.document_id
    ).filter(
        Document.owner_id == user.id,
        DocumentPermission.revoked_at.is_(None),
    ).scalar() or 0

    recent_activity = db.query(func.count(AuditLog.id)).join(
        Document, Document.id == AuditLog.document_id
    ).filter(
        Document.owner_id == user.id,
        AuditLog.occurred_at >= now - timedelta(days=7),
    ).scalar() or 0

    storage_used = db.query(func.sum(Document.file_size)).filter(
        Document.owner_id == user.id, Document.deleted_at.is_(None)
    ).scalar() or 0

    # Documents by category
    from app.models.category import Category
    cat_counts = db.query(
        func.coalesce(Category.name, "Uncategorized").label("category"),
        func.count(Document.id).label("count"),
    ).outerjoin(Category, Category.id == Document.category_id).filter(
        Document.owner_id == user.id, Document.deleted_at.is_(None)
    ).group_by(Category.name).all()

    return OwnerDashboardResponse(
        total_documents=total_docs,
        shared_documents=shared,
        total_permissions_granted=total_grants,
        recent_activity_count=recent_activity,
        storage_used_bytes=storage_used,
        documents_by_category=[{"category": r.category, "count": r.count} for r in cat_counts],
    )


@router.get("/viewer", response_model=ViewerDashboardResponse)
async def viewer_dashboard(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Viewer dashboard — shared documents and access stats."""
    now = _now_utc()

    shared_total = db.query(func.count(DocumentPermission.id)).filter(
        DocumentPermission.user_id == user.id,
        DocumentPermission.revoked_at.is_(None),
        or_(
            DocumentPermission.expires_at.is_(None),
            DocumentPermission.expires_at > now,
        ),
    ).scalar() or 0

    read_count = db.query(func.count(DocumentPermission.id)).filter(
        DocumentPermission.user_id == user.id,
        DocumentPermission.permission == "read",
        DocumentPermission.revoked_at.is_(None),
        or_(
            DocumentPermission.expires_at.is_(None),
            DocumentPermission.expires_at > now,
        ),
    ).scalar() or 0

    edit_count = db.query(func.count(DocumentPermission.id)).filter(
        DocumentPermission.user_id == user.id,
        DocumentPermission.permission == "edit",
        DocumentPermission.revoked_at.is_(None),
        or_(
            DocumentPermission.expires_at.is_(None),
            DocumentPermission.expires_at > now,
        ),
    ).scalar() or 0

    recent_downloads = db.query(func.count(AuditLog.id)).filter(
        AuditLog.actor_id == user.id,
        AuditLog.action == "DOCUMENT_DOWNLOAD",
        AuditLog.occurred_at >= now - timedelta(days=7),
    ).scalar() or 0

    return ViewerDashboardResponse(
        shared_with_me=shared_total,
        read_access_count=read_count,
        edit_access_count=edit_count,
        recent_downloads=recent_downloads,
    )


@router.get("/admin", response_model=AdminDashboardResponse)
async def admin_dashboard(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Admin security command center — live org-wide statistics."""
    if user.role != "admin":
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Admin dashboard requires admin role.")

    now = _now_utc()
    yesterday = now - timedelta(hours=24)

    total_users = db.query(func.count(User.id)).scalar() or 0
    active_users = db.query(func.count(User.id)).filter(User.is_active == True).scalar() or 0
    total_docs = db.query(func.count(Document.id)).filter(Document.deleted_at.is_(None)).scalar() or 0
    total_audit = db.query(func.count(AuditLog.id)).scalar() or 0

    denied_24h = db.query(func.count(AuditLog.id)).filter(
        AuditLog.status == "denied",
        AuditLog.occurred_at >= yesterday,
    ).scalar() or 0

    failed_logins_24h = db.query(func.count(AuditLog.id)).filter(
        AuditLog.action == "LOGIN_FAILED",
        AuditLog.occurred_at >= yesterday,
    ).scalar() or 0

    role_counts = db.query(User.role, func.count(User.id)).group_by(User.role).all()

    # Quick chain validity check (lightweight — just validate last 100 events)
    chain_result = verify_audit_chain(db)

    return AdminDashboardResponse(
        total_users=total_users,
        active_users=active_users,
        total_documents=total_docs,
        total_audit_events=total_audit,
        denied_events_last_24h=denied_24h,
        failed_logins_last_24h=failed_logins_24h,
        users_by_role=[{"role": r, "count": c} for r, c in role_counts],
        chain_valid=chain_result["valid"],
    )

