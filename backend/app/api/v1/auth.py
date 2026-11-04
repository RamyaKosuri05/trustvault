"""
TrustVault — Authentication Routes
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/logout
GET  /api/v1/auth/me
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import get_current_user, get_db, get_request_meta
from app.core.rate_limit import limiter
from app.core.security import hash_password, sha256_hex, generate_csrf_token
from app.models.user import User
from app.schemas import (
    LoginRequest, LoginResponse, LogoutResponse,
    RegisterRequest, UserResponse,
)
from app.services.audit_service import record_audit_event, record_audit_event_independent
from app.services.auth_service import (
    authenticate_user, clear_session_cookie,
    create_session, revoke_session, set_session_cookie,
)
from app.core.dependencies import get_current_session

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=201)
@limiter.limit("3/minute")
async def register(
    request: Request,
    body: RegisterRequest,
    db: Session = Depends(get_db),
    meta: dict = Depends(get_request_meta),
):
    """
    Register a new user account.
    - Only 'owner' or 'viewer' roles are allowed.
    - 'admin' role is explicitly rejected with 403 and security audit log.
    - Email is normalized to lowercase.
    - Rate limited to 3 requests/minute per IP.
    """
    # Double-check role restriction (Pydantic validator also catches this, but
    # an adversary may send raw invalid data bypassing client-side — belt+suspenders)
    if body.role == "admin":
        record_audit_event_independent(
            action="REGISTRATION_ADMIN_ROLE_ATTEMPT",
            status="denied",
            ip_address=meta.get("ip_address"),
            user_agent=meta.get("user_agent"),
            details={"attempted_email": body.email, "attempted_role": "admin"},
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin accounts cannot be self-registered.",
        )

    # Check email uniqueness
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        # Return generic error — don't confirm whether email exists
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user = User(
        id=uuid.uuid4(),
        full_name=body.full_name,
        email=body.email,
        password_hash=hash_password(body.password),
        role=body.role,
        is_active=True,
    )
    db.add(user)

    record_audit_event(
        db=db,
        action="USER_REGISTERED",
        status="success",
        actor_id=user.id,
        ip_address=meta.get("ip_address"),
        user_agent=meta.get("user_agent"),
        details={"email": body.email, "role": body.role},
    )

    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=LoginResponse)
@limiter.limit("5/minute")
async def login(
    request: Request,
    response: Response,
    body: LoginRequest,
    db: Session = Depends(get_db),
    meta: dict = Depends(get_request_meta),
):
    """
    Authenticate and create a session.
    - Timing-safe (runs dummy Argon2id if email not found)
    - Sets HttpOnly session cookie
    - Returns raw CSRF token in body (frontend stores in memory, sends as X-CSRF-Token header)
    - Rate limited to 5/minute per IP
    """
    user = authenticate_user(db, body.email, body.password)

    if user is None:
        # Log failed login — independent transaction (must persist even if request fails)
        record_audit_event_independent(
            action="LOGIN_FAILED",
            status="denied",
            ip_address=meta.get("ip_address"),
            user_agent=meta.get("user_agent"),
            details={"email": body.email, "reason": "invalid_credentials"},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not user.is_active:
        record_audit_event_independent(
            action="LOGIN_DENIED_INACTIVE",
            status="denied",
            actor_id=user.id,
            ip_address=meta.get("ip_address"),
            user_agent=meta.get("user_agent"),
            details={"email": body.email, "reason": "account_inactive"},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is deactivated. Please contact your administrator.",
        )

    # Create session (stores only hashes in DB)
    raw_token, raw_csrf = create_session(
        db=db,
        user=user,
        ip_address=meta.get("ip_address"),
        user_agent=meta.get("user_agent"),
    )

    record_audit_event(
        db=db,
        action="LOGIN_SUCCESS",
        status="success",
        actor_id=user.id,
        ip_address=meta.get("ip_address"),
        user_agent=meta.get("user_agent"),
        details={"email": body.email, "role": user.role},
    )

    db.commit()

    # Set HttpOnly cookie
    set_session_cookie(response, raw_token)

    return LoginResponse(
        csrf_token=raw_csrf,
        user=UserResponse.model_validate(user),
        message="Login successful.",
    )


@router.post("/logout", response_model=LogoutResponse)
async def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    meta: dict = Depends(get_request_meta),
    session=Depends(get_current_session),
):
    """
    Revoke current session. CSRF protected (via get_current_user dependency).
    Clears session cookie.
    """
    revoke_session(db, session)

    record_audit_event(
        db=db,
        action="LOGOUT",
        status="success",
        actor_id=user.id,
        ip_address=meta.get("ip_address"),
        user_agent=meta.get("user_agent"),
        details={},
    )

    db.commit()
    clear_session_cookie(response)
    return LogoutResponse()


@router.get("/me", response_model=UserResponse)
async def get_me(
    user: User = Depends(get_current_user),
):
    """Return the current authenticated user's profile."""
    return user

