"""
TrustVault — Centralized Authorization Engine

authorize_document_access() is the SINGLE non-bypassable gate for every document operation.
Every document endpoint MUST call this function. No exceptions. No shortcuts.

DESIGN RATIONALE:
- Checks document existence and soft-delete state FIRST (returns 404 to prevent BOLA probing)
- Checks user.is_active to catch mid-session deactivation
- Checks ownership (bypass for owner-level operations)
- Enforces Admin content-access restriction (admin can see metadata, NOT file bytes)
- Checks active, non-expired permission grants from DB (not from cache)
- Logs DENIED events in INDEPENDENT transactions (persist through HTTPException rollbacks)
- Returns 404 (not 403) when user has no visibility — prevents document existence discovery
- Returns 403 only when user has read visibility but insufficient permission level
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.document import Document
from app.models.permission import DocumentPermission
from app.models.user import User
from app.services.audit_service import record_audit_event_independent

PermissionLevel = Literal["metadata_admin_or_grant", "read", "edit", "owner"]


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def authorize_document_access(
    db: Session,
    user: User,
    document_id: uuid.UUID,
    required_permission: PermissionLevel,
    action_name: str,
    request_meta: dict,
) -> Document:
    """
    Central authorization gate. Must be called before ANY document operation.
    
    Args:
        db: SQLAlchemy session (must be the request session for transactional consistency)
        user: Authenticated User ORM object (pre-loaded, is_active already checked in dependency)
        document_id: UUID of the requested document
        required_permission: One of "metadata_admin_or_grant", "read", "edit", "owner"
        action_name: Audit log action name (e.g., "DOCUMENT_DOWNLOAD")
        request_meta: dict with "ip_address" and "user_agent" for audit logging
    
    Returns:
        Document ORM object if access is authorized.
    
    Raises:
        404: If document doesn't exist, is soft-deleted, OR user has no visibility
             (deliberately uniform to prevent BOLA probing via 403/404 differentials)
        403: If user has read visibility but insufficient permission level
        401: If user account was deactivated mid-session
    """
    ip = request_meta.get("ip_address")
    ua = request_meta.get("user_agent")

    # --- Step 1: Verify user is active (catches mid-session deactivation) ---
    if not user or not user.is_active:
        record_audit_event_independent(
            action="DEACTIVATED_USER_ACCESS_ATTEMPT",
            status="denied",
            actor_id=user.id if user else None,
            document_id=document_id,
            ip_address=ip,
            user_agent=ua,
            details={"action": action_name, "reason": "user_deactivated"},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account deactivated.",
        )

    # --- Step 2: Query Document with populate_existing to bypass SQLAlchemy identity cache ---
    document = (
        db.query(Document)
        .filter(Document.id == document_id)
        .populate_existing()
        .first()
    )

    # --- Step 3: Document not found or soft-deleted → 404 (always, regardless of who's asking) ---
    if document is None or document.deleted_at is not None:
        record_audit_event_independent(
            action="DOCUMENT_NOT_FOUND_OR_DELETED",
            status="denied",
            actor_id=user.id,
            document_id=document_id,
            ip_address=ip,
            user_agent=ua,
            details={"action": action_name, "reason": "not_found_or_deleted"},
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )

    # --- Step 4: Check if document owner account is deactivated ---
    doc_owner = db.query(User).filter(User.id == document.owner_id).first()
    if doc_owner and not doc_owner.is_active:
        if not (user.role == "admin" and required_permission == "metadata_admin_or_grant"):
            record_audit_event_independent(
                action="DEACTIVATED_OWNER_DOCUMENT_ACCESS",
                status="denied",
                actor_id=user.id,
                document_id=document.id,
                ip_address=ip,
                user_agent=ua,
                details={
                    "action": action_name,
                    "reason": "document_owner_account_deactivated",
                    "owner_id": str(document.owner_id),
                },
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found.",
            )

    # --- Step 5: Check ownership (owner has all permissions on their own document) ---
    is_owner = (document.owner_id == user.id)

    if is_owner:
        # Owners can do anything EXCEPT for required_permission="owner" being needed for
        # specific ops — owner satisfies owner-level too.
        return document

    # --- Step 5: Admin role check ---
    if user.role == "admin":
        if required_permission == "metadata_admin_or_grant":
            # Admin may view metadata inventory — allowed
            return document
        else:
            # Admin cannot download, edit, delete, or manage permissions without explicit grant
            record_audit_event_independent(
                action="ADMIN_CONTENT_ACCESS_BLOCKED",
                status="denied",
                actor_id=user.id,
                document_id=document.id,
                ip_address=ip,
                user_agent=ua,
                details={
                    "action": action_name,
                    "required_permission": required_permission,
                    "reason": "admin_cannot_access_file_content_without_explicit_grant",
                },
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Administrators cannot access document file content without an explicit "
                    "permission grant from the document owner."
                ),
            )

    # --- Step 6: Query active, non-expired permission grant from DB ---
    now = _now_utc()
    grant = (
        db.query(DocumentPermission)
        .filter(
            DocumentPermission.document_id == document.id,
            DocumentPermission.user_id == user.id,
            DocumentPermission.revoked_at.is_(None),
            # expires_at IS NULL (never expires) OR expires_at > now
            (
                DocumentPermission.expires_at.is_(None)
                | (DocumentPermission.expires_at > now)
            ),
        )
        .populate_existing()
        .first()
    )

    # No grant at all → user has no visibility → 404 (uniform with non-existent UUIDs)
    if grant is None:
        record_audit_event_independent(
            action="UNAUTHORIZED_DOCUMENT_ACCESS",
            status="denied",
            actor_id=user.id,
            document_id=document.id,
            ip_address=ip,
            user_agent=ua,
            details={
                "action": action_name,
                "required_permission": required_permission,
                "reason": "no_active_grant",
            },
        )
        # Return 404 — attacker cannot determine if document exists vs. forbidden
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )

    # --- Step 7: Evaluate permission hierarchy ---
    has_read = grant.permission in ("read", "edit")
    has_edit = grant.permission == "edit"

    # "owner" required — no non-owner grant can satisfy this
    if required_permission == "owner":
        record_audit_event_independent(
            action="PERMISSION_DENIED",
            status="denied",
            actor_id=user.id,
            document_id=document.id,
            ip_address=ip,
            user_agent=ua,
            details={
                "action": action_name,
                "required_permission": "owner",
                "user_grant": grant.permission,
                "reason": "owner_level_required",
            },
        )
        # User has read visibility so they know the doc exists → 403
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the document owner can perform this action.",
        )

    if required_permission == "edit" and not has_edit:
        record_audit_event_independent(
            action="PERMISSION_DENIED",
            status="denied",
            actor_id=user.id,
            document_id=document.id,
            ip_address=ip,
            user_agent=ua,
            details={
                "action": action_name,
                "required_permission": "edit",
                "user_grant": grant.permission,
                "reason": "edit_permission_required",
            },
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Edit permission required. You have read-only access.",
        )

    if required_permission in ("read", "metadata_admin_or_grant") and not has_read:
        # Shouldn't reach here if grant exists, but be explicit
        record_audit_event_independent(
            action="PERMISSION_DENIED",
            status="denied",
            actor_id=user.id,
            document_id=document.id,
            ip_address=ip,
            user_agent=ua,
            details={
                "action": action_name,
                "required_permission": required_permission,
                "user_grant": grant.permission,
                "reason": "insufficient_permission",
            },
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions.",
        )

    # --- Step 8: All checks passed — return document ---
    return document


def check_mid_stream_revocation(
    db: Session,
    user: User,
    document_id: uuid.UUID,
    request_meta: dict,
) -> bool:
    """
    Lightweight check for mid-stream download revocation.
    Returns True if access is still valid, False if revoked/deactivated.
    Called periodically during chunked file transfer.
    """
    # Re-query user active status
    fresh_user = db.query(User).filter(User.id == user.id).populate_existing().first()
    if not fresh_user or not fresh_user.is_active:
        return False

    is_owner = db.query(Document).filter(
        Document.id == document_id,
        Document.owner_id == user.id,
        Document.deleted_at.is_(None),
    ).first() is not None

    if is_owner:
        return True

    # Check active grant still exists
    now = _now_utc()
    grant = db.query(DocumentPermission).filter(
        DocumentPermission.document_id == document_id,
        DocumentPermission.user_id == user.id,
        DocumentPermission.revoked_at.is_(None),
        (
            DocumentPermission.expires_at.is_(None)
            | (DocumentPermission.expires_at > now)
        ),
    ).first()

    return grant is not None

