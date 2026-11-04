"""
TrustVault — Permission Routes
Grant, list, update, revoke per-document permissions.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db, get_request_meta
from app.models.document import Document
from app.models.permission import DocumentPermission
from app.models.user import User
from app.schemas import PermissionGrantRequest, PermissionResponse, PermissionUpdateRequest
from app.services.audit_service import record_audit_event, record_audit_event_independent
from app.services.authorization_service import authorize_document_access

router = APIRouter(tags=["Permissions"])


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _enrich_permission(perm: DocumentPermission, db: Session) -> PermissionResponse:
    """Build enriched PermissionResponse with grantee/granter names."""
    grantee = db.query(User).filter(User.id == perm.user_id).first()
    granter = db.query(User).filter(User.id == perm.granted_by).first()
    return PermissionResponse(
        id=perm.id,
        document_id=perm.document_id,
        user_id=perm.user_id,
        permission=perm.permission,
        granted_by=perm.granted_by,
        expires_at=perm.expires_at,
        granted_at=perm.granted_at,
        updated_at=perm.updated_at,
        revoked_at=perm.revoked_at,
        grantee_name=grantee.full_name if grantee else None,
        grantee_email=grantee.email if grantee else None,
        granter_name=granter.full_name if granter else None,
    )


@router.post("/documents/{document_id}/permissions", response_model=PermissionResponse, status_code=201)
async def grant_permission(
    document_id: uuid.UUID,
    body: PermissionGrantRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    meta: dict = Depends(get_request_meta),
):
    """
    Grant read or edit permission on a document to another user.
    Only the document owner can grant permissions.
    Admin CANNOT grant permissions on other owners' documents (including to themselves!).
    """
    # Verify the caller owns this document
    doc = authorize_document_access(
        db=db, user=user, document_id=document_id,
        required_permission="owner",
        action_name="PERMISSION_GRANT",
        request_meta=meta,
    )

    # Resolve target user by email or user_id
    target_user = None
    if body.email:
        target_user = db.query(User).filter(
            User.email == body.email.lower().strip(),
            User.is_active == True,
        ).first()
    elif body.user_id:
        target_user = db.query(User).filter(
            User.id == body.user_id,
            User.is_active == True,
        ).first()

    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target user not found or inactive.",
        )

    # Cannot grant to yourself (owner granting to themselves is redundant and confusing)
    if target_user.id == user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot grant permissions to yourself (you are the owner).",
        )

    # Check for existing active grant (the partial unique index also enforces this at DB level)
    existing = db.query(DocumentPermission).filter(
        DocumentPermission.document_id == doc.id,
        DocumentPermission.user_id == target_user.id,
        DocumentPermission.revoked_at.is_(None),
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"User already has an active '{existing.permission}' grant. Use PATCH to update it.",
        )

    perm = DocumentPermission(
        id=uuid.uuid4(),
        document_id=doc.id,
        user_id=target_user.id,
        permission=body.permission,
        granted_by=user.id,
        expires_at=body.expires_at,
    )
    db.add(perm)

    record_audit_event(
        db=db, action="PERMISSION_GRANTED", status="success",
        actor_id=user.id, document_id=doc.id,
        ip_address=meta.get("ip_address"), user_agent=meta.get("user_agent"),
        details={
            "grantee_id": str(target_user.id),
            "grantee_email": target_user.email,
            "permission": body.permission,
            "expires_at": body.expires_at.isoformat() if body.expires_at else None,
        },
    )
    db.commit()
    db.refresh(perm)
    return _enrich_permission(perm, db)


@router.get("/documents/{document_id}/permissions", response_model=list[PermissionResponse])
async def list_permissions(
    document_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    meta: dict = Depends(get_request_meta),
):
    """
    List all permissions for a document.
    - Owner: sees all permissions on their document
    - Admin: sees all permissions for governance audit
    """
    # Both admin and owner can see permissions
    perm_level = "metadata_admin_or_grant" if user.role == "admin" else "owner"
    doc = authorize_document_access(
        db=db, user=user, document_id=document_id,
        required_permission=perm_level,
        action_name="PERMISSIONS_LIST",
        request_meta=meta,
    )

    perms = (
        db.query(DocumentPermission)
        .filter(DocumentPermission.document_id == doc.id)
        .order_by(DocumentPermission.granted_at.desc())
        .all()
    )
    return [_enrich_permission(p, db) for p in perms]


@router.patch("/documents/{document_id}/permissions/{permission_id}", response_model=PermissionResponse)
async def update_permission(
    document_id: uuid.UUID,
    permission_id: uuid.UUID,
    body: PermissionUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    meta: dict = Depends(get_request_meta),
):
    """Update a permission (read <-> edit, or change expiry). Owner only."""
    doc = authorize_document_access(
        db=db, user=user, document_id=document_id,
        required_permission="owner",
        action_name="PERMISSION_UPDATE",
        request_meta=meta,
    )

    perm = db.query(DocumentPermission).filter(
        DocumentPermission.id == permission_id,
        DocumentPermission.document_id == doc.id,
        DocumentPermission.revoked_at.is_(None),
    ).first()

    if not perm:
        raise HTTPException(status_code=404, detail="Permission not found or already revoked.")

    changes = {}
    if body.permission is not None:
        changes["permission"] = {"from": perm.permission, "to": body.permission}
        perm.permission = body.permission
    if body.expires_at is not None:
        changes["expires_at"] = {"to": body.expires_at.isoformat()}
        perm.expires_at = body.expires_at

    record_audit_event(
        db=db, action="PERMISSION_UPDATED", status="success",
        actor_id=user.id, document_id=doc.id,
        ip_address=meta.get("ip_address"), user_agent=meta.get("user_agent"),
        details={"permission_id": str(permission_id), "changes": changes},
    )
    db.commit()
    db.refresh(perm)
    return _enrich_permission(perm, db)


@router.delete("/documents/{document_id}/permissions/{permission_id}", status_code=204)
async def revoke_permission(
    document_id: uuid.UUID,
    permission_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    meta: dict = Depends(get_request_meta),
):
    """
    Revoke a permission grant. Owner only.
    Takes effect on the very next request by the grantee.
    """
    doc = authorize_document_access(
        db=db, user=user, document_id=document_id,
        required_permission="owner",
        action_name="PERMISSION_REVOKE",
        request_meta=meta,
    )

    perm = db.query(DocumentPermission).filter(
        DocumentPermission.id == permission_id,
        DocumentPermission.document_id == doc.id,
        DocumentPermission.revoked_at.is_(None),
    ).first()

    if not perm:
        raise HTTPException(status_code=404, detail="Permission not found or already revoked.")

    perm.revoked_at = _now_utc()

    record_audit_event(
        db=db, action="PERMISSION_REVOKED", status="success",
        actor_id=user.id, document_id=doc.id,
        ip_address=meta.get("ip_address"), user_agent=meta.get("user_agent"),
        details={
            "permission_id": str(permission_id),
            "revoked_user_id": str(perm.user_id),
            "revoked_permission": perm.permission,
        },
    )
    db.commit()

