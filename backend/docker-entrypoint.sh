#!/bin/sh
set -e

echo "[entrypoint] ensuring database schema (seed only if empty)..."
python -m app.bootstrap

echo "[entrypoint] starting API on :8000"
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
