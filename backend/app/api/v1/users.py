"""
TrustVault — User Management Routes
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session
import math

from app.core.dependencies import get_current_user, get_db, get_request_meta, require_role
from app.core.rate_limit import limiter
from app.core.security import hash_password
from app.models.user import User
from app.schemas import (
    PaginatedResponse, UserCreateRequest, UserLookupResponse,
    UserResponse, UserStatusUpdateRequest,
)
from app.services.audit_service import record_audit_event
from app.services.auth_service import revoke_all_user_sessions

router = APIRouter(prefix="/users", tags=["Users"])


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin")),
    meta: dict = Depends(get_request_meta),
):
    """
    Provision a new user account (admin only).
    Supports provisioning users with admin, owner, or viewer roles.
    """
    normalized_email = body.email.lower().strip()
    existing = db.query(User).filter(User.email == normalized_email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email address already exists.",
        )

    new_user = User(
        id=uuid.uuid4(),
        full_name=body.full_name,
        email=normalized_email,
        password_hash=hash_password(body.password),
        role=body.role,
        is_active=True,
    )
    db.add(new_user)

    record_audit_event(
        db=db,
        action="USER_PROVISIONED",
        status="success",
        actor_id=user.id,
        ip_address=meta.get("ip_address"),
        user_agent=meta.get("user_agent"),
        details={
            "created_user_id": str(new_user.id),
            "created_email": new_user.email,
            "created_role": new_user.role,
        },
    )

    db.commit()
    db.refresh(new_user)
    return new_user


@router.get("", response_model=PaginatedResponse[UserResponse])
async def list_users(
    request: Request,
    q: str = Query(None, description="Search by name or email"),
    role: str = Query(None),
    is_active: bool = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin")),
    meta: dict = Depends(get_request_meta),
):
    """List users (admin only)."""
    query = db.query(User)
    if q:
        query = query.filter(
            (User.full_name.ilike(f"%{q}%")) | (User.email.ilike(f"%{q}%"))
        )
    if role:
        query = query.filter(User.role == role)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    total = query.count()
    offset = (page - 1) * page_size
    users = query.order_by(User.created_at.desc()).offset(offset).limit(page_size).all()

    return PaginatedResponse(
        items=users,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 0,
    )


@router.get("/lookup", response_model=UserLookupResponse)
@limiter.limit("20/minute")
async def lookup_user_by_email(
    request: Request,
    email: str = Query(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin", "owner")),
    meta: dict = Depends(get_request_meta),
):
    """
    Exact email lookup for granting permissions.
    Returns minimal user info (id, full_name, email, role).
    Only active users returned — prevents granting to deactivated accounts.
    Rate limited to prevent user enumeration via lookup endpoint.
    """
    normalized = email.lower().strip()
    target = db.query(User).filter(
        User.email == normalized,
        User.is_active == True,
    ).first()

    if not target:
        raise HTTPException(status_code=404, detail="User not found.")

    return UserLookupResponse.model_validate(target)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get user by ID. Admin can get any user; others can only get themselves."""
    if user.role != "admin" and user.id != user_id:
        raise HTTPException(status_code=403, detail="Access denied.")

    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    return target


@router.patch("/{user_id}/status", response_model=UserResponse)
async def update_user_status(
    user_id: uuid.UUID,
    body: UserStatusUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin")),
    meta: dict = Depends(get_request_meta),
):
    """
    Activate/deactivate a user (admin only).
    - Cannot deactivate yourself
    - Cannot deactivate the last active admin
    - Deactivating immediately revokes ALL active sessions
    """
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")

    # Cannot deactivate self
    if target.id == user.id:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account.")

    # Cannot deactivate the last active admin
    if target.role == "admin" and not body.is_active:
        active_admins = db.query(User).filter(
            User.role == "admin", User.is_active == True, User.id != target.id
        ).count()
        if active_admins == 0:
            raise HTTPException(
                status_code=400,
                detail="Cannot deactivate the last active administrator.",
            )

    old_status = target.is_active
    target.is_active = body.is_active

    revoked_sessions = 0
    if not body.is_active:
        # Immediately revoke all active sessions in the same transaction
        revoked_sessions = revoke_all_user_sessions(db, target.id)

    record_audit_event(
        db=db,
        action="USER_STATUS_CHANGED",
        status="success",
        actor_id=user.id,
        ip_address=meta.get("ip_address"),
        user_agent=meta.get("user_agent"),
        details={
            "target_user_id": str(target.id),
            "target_email": target.email,
            "old_status": old_status,
            "new_status": body.is_active,
            "sessions_revoked": revoked_sessions,
        },
    )
    db.commit()
    db.refresh(target)
    return target

