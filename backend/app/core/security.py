"""
TrustVault — Security Utilities
Argon2id password hashing, opaque session token generation, SHA-256 hashing.
"""
from datetime import datetime, timezone
import hashlib
import secrets
from typing import Optional
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError

# Argon2id hasher with OWASP-recommended parameters (time=2, memory=65536, parallelism=2)
_ph = PasswordHasher(
    time_cost=2,
    memory_cost=65536,
    parallelism=2,
    hash_len=32,
    salt_len=16,
)

# Dummy hash for timing-safe "user not found" path in login
_DUMMY_HASH = _ph.hash("TrustVault_dummy_password_for_timing_safety_12345!")


def hash_password(password: str) -> str:
    """Hash a password with Argon2id. Returns the full hash string."""
    return _ph.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """
    Verify a password against its Argon2id hash.
    Returns True if match, False otherwise.
    TIMING-SAFE: always takes ~same time whether hash is real or dummy.
    """
    try:
        return _ph.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def dummy_verify_password() -> None:
    """
    Run a dummy Argon2id verification to consume ~same time as a real verify.
    Call this when a login email is not found to prevent timing-based user enumeration.
    """
    try:
        _ph.verify(_DUMMY_HASH, "dummy_password_that_will_never_match_XYZ_9999!")
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        pass  # Expected — this is intentional


def generate_session_token() -> str:
    """Generate a cryptographically secure opaque session token (URL-safe base64, 32 bytes entropy)."""
    return secrets.token_urlsafe(32)


def generate_csrf_token() -> str:
    """Generate a cryptographically secure CSRF token."""
    return secrets.token_urlsafe(32)


def sha256_hex(data: str) -> str:
    """Return SHA-256 hex digest of a UTF-8 string."""
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


def sha256_bytes_hex(data: bytes) -> str:
    """Return SHA-256 hex digest of raw bytes."""
    return hashlib.sha256(data).hexdigest()


def constant_time_compare(a: str, b: str) -> bool:
    """Constant-time string comparison to prevent timing attacks."""
    return secrets.compare_digest(a.encode("utf-8"), b.encode("utf-8"))


def ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """
    Ensure a datetime is timezone-aware in UTC.
    If naive (e.g. from SQLite or naive client), attaches timezone.utc.
    If already aware (e.g. from PostgreSQL TIMESTAMPTZ), converts to UTC.
    If None, returns None.
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

