"""
TrustVault — CSRF Protection
Implements Double-Submit + Server-side CSRF token verification.

Flow:
1. On login, generate a CSRF token, store SHA-256(csrf_token) in the session row.
2. Return the raw CSRF token in the JSON login response body (not in a cookie).
3. Frontend stores it in memory (React state / AuthContext) and sends it as X-CSRF-Token header.
4. On every state-changing request (POST/PUT/PATCH/DELETE), extract X-CSRF-Token header,
   hash it, compare to session's csrf_token_hash using constant-time compare.
5. If mismatch or missing → 403 + CSRF_VALIDATION_FAILED audit log.

This protects against CSRF attacks because:
- An attacker's forged cross-site request cannot read the CSRF token from the JSON body (SOP).
- HttpOnly cookie is sent automatically by browser, but attacker cannot read or set X-CSRF-Token.
"""
from fastapi import Request, HTTPException, status
from app.core.security import sha256_hex, constant_time_compare

CSRF_HEADER = "X-CSRF-Token"
STATE_CHANGING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

# Routes exempt from CSRF (safe reads, or the login/register that bootstraps the token)
CSRF_EXEMPT_PATHS = {
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/health",
}


def get_csrf_token_from_request(request: Request) -> str | None:
    """Extract the CSRF token from the X-CSRF-Token header."""
    return request.headers.get(CSRF_HEADER)


def validate_csrf(request: Request, session_csrf_hash: str) -> bool:
    """
    Validate the CSRF token from the request header against the session's stored hash.
    Returns True if valid, False if invalid or missing.
    Does NOT raise — caller is responsible for raising HTTPException and logging denied event.
    """
    if request.method not in STATE_CHANGING_METHODS:
        return True  # GET/HEAD/OPTIONS are safe methods

    if request.url.path in CSRF_EXEMPT_PATHS:
        return True

    csrf_token = get_csrf_token_from_request(request)
    if not csrf_token:
        return False

    # Hash the submitted token and compare to stored hash (constant-time)
    submitted_hash = sha256_hex(csrf_token)
    return constant_time_compare(submitted_hash, session_csrf_hash)

