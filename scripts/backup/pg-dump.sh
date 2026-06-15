#!/usr/bin/env bash
set -euo pipefail

DB="${POSTGRES_DB:-society_connect}"
USER="${POSTGRES_USER:-society}"
PASSWORD="${POSTGRES_PASSWORD:-society}"
HOST="${POSTGRES_HOST:-localhost}"
PORT="${POSTGRES_PORT:-5432}"
OUT_DIR="${OUTPUT_DIR:-backups}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
OUT_FILE="${OUT_DIR}/society_connect-${STAMP}.sql"

mkdir -p "$OUT_DIR"
export PGPASSWORD="$PASSWORD"
pg_dump -h "$HOST" -p "$PORT" -U "$USER" -d "$DB" -F p -f "$OUT_FILE"
cp "$OUT_FILE" "${OUT_DIR}/society_connect-latest.sql"
echo "Backup written to ${OUT_FILE}"
