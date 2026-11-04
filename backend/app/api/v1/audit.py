"""
TrustVault — Audit Trail Routes
"""
from __future__ import annotations

import math
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db, get_request_meta, require_role
from app.models.audit_log import AuditLog
from app.models.document import Document
from app.models.user import User
from app.schemas import (
    AuditCheckpointResponse, AuditLogResponse,
    ChainVerificationResponse, PaginatedResponse,
)
from app.services.audit_service import get_audit_checkpoint, verify_audit_chain
from app.services.authorization_service import authorize_document_access

router = APIRouter(prefix="/audit", tags=["Audit"])

SECURITY_ACTIONS = {
    "LOGIN_FAILED", "CSRF_VALIDATION_FAILED", "UNAUTHORIZED_DOCUMENT_ACCESS",
    "ADMIN_CONTENT_ACCESS_BLOCKED", "PERMISSION_DENIED", "FILE_VALIDATION_REJECTED",
    "REGISTRATION_ADMIN_ROLE_ATTEMPT", "DEACTIVATED_USER_ACCESS_ATTEMPT",
    "LOGIN_DENIED_INACTIVE", "DOWNLOAD_ABORTED_REVOKED", "USER_STATUS_CHANGED",
}


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _enrich_log(log: AuditLog, db: Session) -> AuditLogResponse:
    actor = db.query(User).filter(User.id == log.actor_id).first() if log.actor_id else None
    return AuditLogResponse(
        id=log.id,
        sequence_number=log.sequence_number,
        actor_id=log.actor_id,
        document_id=log.document_id,
        action=log.action,
        status=log.status,
        ip_address=log.ip_address,
        user_agent=log.user_agent,
        details=log.details,
        occurred_at=log.occurred_at,
        previous_hash=log.previous_hash,
        event_hash=log.event_hash,
        actor_name=actor.full_name if actor else None,
        actor_email=actor.email if actor else None,
    )


@router.get("/logs", response_model=PaginatedResponse[AuditLogResponse])
async def get_audit_logs(
    request: Request,
    action: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    actor_id: Optional[uuid.UUID] = Query(None),
    document_id: Optional[uuid.UUID] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    meta: dict = Depends(get_request_meta),
):
    """
    Get audit logs.
    - Admin: sees all events system-wide
    - Owner: sees ONLY events related to documents they own
    """
    query = db.query(AuditLog)

    if user.role == "admin":
        pass  # Admin sees everything
    elif user.role == "owner":
        # Owner sees only audit events for their documents
        owned_doc_ids = (
            db.query(Document.id)
            .filter(Document.owner_id == user.id)
            .subquery()
        )
        query = query.filter(AuditLog.document_id.in_(owned_doc_ids))
    else:
        raise HTTPException(status_code=403, detail="Access denied.")

    if action:
        query = query.filter(AuditLog.action == action.upper())
    if status_filter:
        query = query.filter(AuditLog.status == status_filter.lower())
    if actor_id:
        query = query.filter(AuditLog.actor_id == actor_id)
    if document_id:
        query = query.filter(AuditLog.document_id == document_id)
    if date_from:
        query = query.filter(AuditLog.occurred_at >= date_from)
    if date_to:
        query = query.filter(AuditLog.occurred_at <= date_to)

    total = query.count()
    offset = (page - 1) * page_size
    logs = query.order_by(AuditLog.sequence_number.desc()).offset(offset).limit(page_size).all()

    return PaginatedResponse(
        items=[_enrich_log(log, db) for log in logs],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 0,
    )


@router.get("/documents/{document_id}", response_model=PaginatedResponse[AuditLogResponse])
async def get_document_audit_logs(
    document_id: uuid.UUID,
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    meta: dict = Depends(get_request_meta),
):
    """Get audit logs for a specific document. Owner or admin only."""
    perm_level = "metadata_admin_or_grant" if user.role == "admin" else "owner"
    doc = authorize_document_access(
        db=db, user=user, document_id=document_id,
        required_permission=perm_level,
        action_name="AUDIT_LOG_VIEW",
        request_meta=meta,
    )

    query = db.query(AuditLog).filter(AuditLog.document_id == doc.id)
    total = query.count()
    offset = (page - 1) * page_size
    logs = query.order_by(AuditLog.sequence_number.desc()).offset(offset).limit(page_size).all()

    return PaginatedResponse(
        items=[_enrich_log(log, db) for log in logs],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 0,
    )


@router.get("/security-events", response_model=PaginatedResponse[AuditLogResponse])
async def get_security_events(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin")),
    meta: dict = Depends(get_request_meta),
):
    """Get security events (admin only) — denied attempts, failed logins, etc."""
    query = db.query(AuditLog).filter(
        (AuditLog.status == "denied") | (AuditLog.action.in_(SECURITY_ACTIONS))
    )
    total = query.count()
    offset = (page - 1) * page_size
    logs = query.order_by(AuditLog.sequence_number.desc()).offset(offset).limit(page_size).all()

    return PaginatedResponse(
        items=[_enrich_log(log, db) for log in logs],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 0,
    )


@router.get("/verify", response_model=ChainVerificationResponse)
async def verify_chain(
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """
    Run full cryptographic hash chain verification (admin only).
    Does NOT create new audit log entries (no recursion).
    """
    result = verify_audit_chain(db)
    return ChainVerificationResponse(**result)


@router.get("/export-checkpoint", response_model=AuditCheckpointResponse)
async def export_checkpoint(
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """
    Export a signed checkpoint of the current audit chain head (admin only).
    Organizations should store this externally to detect privileged DBA tampering.
    Does NOT create new audit log entries.
    """
    checkpoint = get_audit_checkpoint(db)
    return AuditCheckpointResponse(**checkpoint)

