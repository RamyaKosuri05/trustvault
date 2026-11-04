"""
TrustVault — FastAPI Application Entry Point
"""
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.v1 import auth, users, categories, documents, permissions, audit, dashboard
from app.core.config import settings
from app.core.rate_limit import limiter, rate_limit_exceeded_handler
from app.middleware.security_headers import SecurityHeadersMiddleware

_start_time = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan — startup and shutdown events."""
    # Startup: verify storage backend is accessible
    from app.services.storage_service import get_storage
    try:
        storage = get_storage()
        print(f"[TrustVault] Storage backend: {settings.STORAGE_BACKEND}")
    except Exception as e:
        print(f"[TrustVault] WARNING: Storage backend initialization failed: {e}")
    yield
    # Shutdown (cleanup if needed)


app = FastAPI(
    title="TrustVault API",
    description=(
        "Secure document sharing platform with per-document authorization, "
        "tamper-evident audit trail, and immediate permission revocation."
    ),
    version=settings.APP_VERSION,
    docs_url="/api/docs" if not settings.is_production else None,
    redoc_url="/api/redoc" if not settings.is_production else None,
    openapi_url="/api/openapi.json" if not settings.is_production else None,
    lifespan=lifespan,
)

# ---- Rate Limiter ----
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# ---- CORS ----
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,  # Required for HttpOnly cookie cross-origin
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-CSRF-Token", "Authorization"],
    expose_headers=["X-CSRF-Token"],
)

# ---- Security Headers ----
app.add_middleware(SecurityHeadersMiddleware)

# ---- API Routers ----
API_PREFIX = "/api/v1"

app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(users.router, prefix=API_PREFIX)
app.include_router(categories.router, prefix=API_PREFIX)
app.include_router(documents.router, prefix=API_PREFIX)
app.include_router(permissions.router, prefix=API_PREFIX)
app.include_router(audit.router, prefix=API_PREFIX)
app.include_router(dashboard.router, prefix=API_PREFIX)


@app.get("/api/v1/health")
async def health_check(request: Request):
    """Health check endpoint — verifies DB connectivity."""
    from app.db.session import SessionLocal
    db_ok = False
    try:
        db = SessionLocal()
        db.execute(__import__("sqlalchemy").text("SELECT 1"))
        db.close()
        db_ok = True
    except Exception:
        pass

    uptime_seconds = int(time.time() - _start_time)
    return {
        "status": "healthy" if db_ok else "degraded",
        "database": "connected" if db_ok else "disconnected",
        "uptime_seconds": uptime_seconds,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ---- Global Exception Handler ----
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Global error handler — returns sanitized error messages.
    NEVER exposes stack traces or internal details in production.
    """
    import sys
    print(f"[TrustVault] Unhandled exception: {exc}", file=sys.stderr)

    if settings.is_production:
        return JSONResponse(
            status_code=500,
            content={"error": "internal_server_error", "message": "An unexpected error occurred."},
        )
    else:
        import traceback
        return JSONResponse(
            status_code=500,
            content={
                "error": "internal_server_error",
                "message": str(exc),
                "detail": traceback.format_exc() if not settings.is_production else None,
            },
        )

