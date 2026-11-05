"""
TrustVault — Authentication Service
Handles registration, login, logout, session management.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Response
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    hash_password,
    verify_password,
    dummy_verify_password,
    generate_session_token,
    generate_csrf_token,
    sha256_hex,
)
from app.models.session import UserSession
from app.models.user import User
from app.services.audit_service import record_audit_event, record_audit_event_independent

COOKIE_NAME = "trustvault_session"


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def create_session(
    db: Session,
    user: User,
    ip_address: Optional[str],
    user_agent: Optional[str],
) -> tuple[str, str]:
    """
    Create a new session for the user.
    Returns (raw_session_token, raw_csrf_token) — only raw tokens leave this function.
    DB stores only SHA-256 hashes.
    """
    raw_token = generate_session_token()
    raw_csrf = generate_csrf_token()
    token_hash = sha256_hex(raw_token)
    csrf_hash = sha256_hex(raw_csrf)

    session = UserSession(
        id=uuid.uuid4(),
        user_id=user.id,
        token_hash=token_hash,
        csrf_token_hash=csrf_hash,
        ip_address=ip_address,
        user_agent=user_agent,
        expires_at=_now_utc() + timedelta(hours=settings.SESSION_EXPIRE_HOURS),
        created_at=_now_utc(),
        last_used_at=_now_utc(),
    )
    db.add(session)
    db.flush()  # Get session ID without committing yet
    return raw_token, raw_csrf


def set_session_cookie(response: Response, raw_token: str) -> None:
    """Set the HttpOnly session cookie on the response."""
    response.set_cookie(
        key=COOKIE_NAME,
        value=raw_token,
        httponly=True,
        secure=settings.SESSION_COOKIE_SECURE,
        samesite=settings.SESSION_COOKIE_SAMESITE,
        domain=settings.SESSION_COOKIE_DOMAIN or None,
        max_age=settings.SESSION_EXPIRE_HOURS * 3600,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    """Clear the session cookie (logout)."""
    response.delete_cookie(
        key=COOKIE_NAME,
        httponly=True,
        secure=settings.SESSION_COOKIE_SECURE,
        samesite=settings.SESSION_COOKIE_SAMESITE,
        domain=settings.SESSION_COOKIE_DOMAIN or None,
        path="/",
    )


def revoke_session(db: Session, session: UserSession) -> None:
    """Revoke a specific session."""
    session.revoked_at = _now_utc()
    db.flush()


def revoke_all_user_sessions(db: Session, user_id: uuid.UUID) -> int:
    """Revoke all active sessions for a user. Returns count revoked."""
    now = _now_utc()
    result = (
        db.query(UserSession)
        .filter(
            UserSession.user_id == user_id,
            UserSession.revoked_at.is_(None),
        )
        .all()
    )
    for s in result:
        s.revoked_at = now
    db.flush()
    return len(result)


def authenticate_user(
    db: Session,
    email: str,
    password: str,
) -> Optional[User]:
    """
    Authenticate a user by email/password.
    TIMING-SAFE: always runs Argon2id verification (dummy if email not found)
    to prevent timing-based user enumeration attacks.
    Returns User if valid, None if invalid credentials.
    """
    # Normalize email to lowercase
    normalized_email = email.lower().strip()

    user = db.query(User).filter(User.email == normalized_email).first()

    if user is None:
        # Run dummy verification to consume ~same time as real verification
        dummy_verify_password()
        return None

    if not verify_password(password, user.password_hash):
        return None

    return user

