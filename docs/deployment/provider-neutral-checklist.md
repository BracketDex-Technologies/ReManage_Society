# Provider-Neutral Deployment Checklist

Use with any cloud or on-prem runtime that supports OCI containers and PostgreSQL 18.

## Images

| Image | Dockerfile | Port |
|---|---|---|
| API | `apps/api/Dockerfile` | 4000 |
| Worker | `apps/worker/Dockerfile` | 4010 |
| Web | `Dockerfile.web` | 3000 |

Validate:

```powershell
docker compose -f docker-compose.yml -f docker-compose.rc.yml config
docker build -f apps/api/Dockerfile .
docker build -f apps/worker/Dockerfile .
docker build -f Dockerfile.web .
```

## Required environment

- `DATABASE_URL`, `DIRECT_URL`
- `SESSION_SECRET` (32+ chars)
- `KEYCLOAK_ISSUER_URL`, `KEYCLOAK_JWKS_URL`, `KEYCLOAK_CLIENT_ID`
- `VALKEY_URL`
- `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
- `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_API_URL`
- `RAZORPAY_*` (when payments enabled)

## Infrastructure

- [ ] Postgres 18 with daily logical backups (`scripts/backup/pg-dump.sh`)
- [ ] Valkey for distributed rate limits
- [ ] MinIO or S3-compatible private bucket
- [ ] Keycloak realm imported (`infra/keycloak/society-connect-realm.json`)
- [ ] TLS termination at ingress (neutral: any reverse proxy)
- [ ] Secrets in vault/secret manager (not in image layers)

## Database

- [ ] `npm run db:validate` passes in CI
- [ ] Apply RLS SQL on staging: `packages/db/rls/001-tenant-isolation.sql`
- [ ] Restore drill completed (`docs/runbooks/backup-restore.md`)

## Post-deploy verification

- [ ] `npm run phase8:rc` (or staging equivalent)
- [ ] Staging UAT checklist signed (`docs/staging/uat-checklist.md`)
- [ ] Load smoke p95 < 750 ms (`scripts/load/README.md`)
