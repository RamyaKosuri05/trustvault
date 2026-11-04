"""
TrustVault — FastAPI Dependencies
Provides reusable dependency injection for authentication, session validation,
CSRF checking, and database access.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import Cookie, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.csrf import validate_csrf, STATE_CHANGING_METHODS, CSRF_EXEMPT_PATHS
from app.core.security import sha256_hex
from app.db.session import get_db
from app.models.session import UserSession
from app.models.user import User


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def get_session_token(trustvault_session: str | None = Cookie(default=None)) -> str | None:
    """Extract raw session token from HttpOnly cookie."""
    return trustvault_session


def get_current_session(
    request: Request,
    db: Session = Depends(get_db),
    raw_token: str | None = Depends(get_session_token),
) -> UserSession:
    """
    Validate the session cookie, returning the active UserSession.
    Raises 401 if missing, expired, or revoked.
    Does NOT check CSRF — that's done in get_current_user for state-changing routes.
    """
    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in.",
        )

    token_hash = sha256_hex(raw_token)
    now = _now_utc()

    session = (
        db.query(UserSession)
        .filter(
            UserSession.token_hash == token_hash,
            UserSession.revoked_at.is_(None),
            UserSession.expires_at > now,
        )
        .first()
    )

    if session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid. Please log in again.",
        )

    # Update last_used_at (best-effort — don't fail auth if this update fails)
    try:
        session.last_used_at = now
        db.commit()
    except Exception:
        db.rollback()

    return session


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
    session: UserSession = Depends(get_current_session),
) -> User:
    """
    Load and return the authenticated User.
    Also validates CSRF token for state-changing requests.
    Raises 401 if user deactivated (also revokes session).
    Raises 403 if CSRF token invalid.
    """
    # Validate CSRF on state-changing methods
    if (
        request.method in STATE_CHANGING_METHODS
        and request.url.path not in CSRF_EXEMPT_PATHS
    ):
        if not validate_csrf(request, session.csrf_token_hash):
            # Import here to avoid circular imports — audit log recorded in auth router
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="CSRF token missing or invalid.",
                headers={"X-CSRF-Error": "true"},
            )

    # Load user fresh from DB (not from session cache) — catches mid-session deactivation
    user = db.query(User).filter(User.id == session.user_id).first()

    if user is None or not user.is_active:
        # Revoke the session immediately
        try:
            session.revoked_at = _now_utc()
            db.commit()
        except Exception:
            db.rollback()

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account deactivated or not found. Please contact your administrator.",
        )

    return user


def require_role(*roles: str):
    """
    Dependency factory that enforces role-based access.
    Usage: Depends(require_role("admin")) or Depends(require_role("admin", "owner"))
    """
    def _check_role(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role(s): {', '.join(roles)}.",
            )
        return user
    return _check_role


def get_request_meta(request: Request) -> dict:
    """Extract client IP and user-agent for audit logging."""
    # Respect X-Forwarded-For from trusted proxy (Render/Vercel)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        ip = forwarded_for.split(",")[0].strip()
    else:
        ip = request.client.host if request.client else "unknown"

    user_agent = request.headers.get("User-Agent", "")[:512]
    return {"ip_address": ip, "user_agent": user_agent}

