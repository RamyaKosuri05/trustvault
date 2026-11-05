#!/usr/bin/env bash
set -e

echo "[STARTUP] Running database migrations (alembic upgrade head)..."
alembic upgrade head

if [ "$ALLOW_DEMO_SEED" = "true" ]; then
    echo "[STARTUP] ALLOW_DEMO_SEED=true detected. Seeding idempotent demo data..."
    python -m app.scripts.seed_demo --confirm-demo-seed || echo "[STARTUP] Seed finished."
fi

PORT="${PORT:-8000}"
echo "[STARTUP] Launching TrustVault API on port $PORT..."
exec gunicorn app.main:app -w 2 -k uvicorn.workers.UvicornWorker --bind "0.0.0.0:$PORT" --forwarded-allow-ips="*" --timeout 120 --access-logfile -

