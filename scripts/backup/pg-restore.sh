#!/usr/bin/env bash
set -euo pipefail

BACKUP_FILE="${1:-}"
if [[ -z "$BACKUP_FILE" ]]; then
  echo "Usage: pg-restore.sh <backup.sql>" >&2
  exit 1
fi
if [[ -z "${RESTORE_DATABASE_URL:-}" ]]; then
  echo "RESTORE_DATABASE_URL is required" >&2
  exit 1
fi

psql "$RESTORE_DATABASE_URL" -f "$BACKUP_FILE"
psql "$RESTORE_DATABASE_URL" -c 'SELECT COUNT(*) AS societies FROM "Society";'
psql "$RESTORE_DATABASE_URL" -c 'SELECT COUNT(*) AS users FROM "User";'
echo "Restore completed from ${BACKUP_FILE}"
