# Deployment Runbook

Provider-neutral steps for Docker Compose or any Kubernetes-compatible runtime.

## Prerequisites

- Postgres 18, Valkey 8, MinIO, Keycloak 26 (see root `docker-compose.yml`)
- Env files from `.env.example` (no secrets in git)
- Optional overlay: `docker-compose.rc.yml` for app images

## Compose deploy

```powershell
docker compose -f docker-compose.yml -f docker-compose.rc.yml config
docker compose -f docker-compose.yml -f docker-compose.rc.yml up -d postgres valkey minio keycloak
docker compose -f docker-compose.yml -f docker-compose.rc.yml up -d api worker web
```

## Post-deploy smoke

1. `GET http://localhost:4000/health/live` → 200
2. `GET http://localhost:4000/health/ready` → 200 when DB up
3. `GET http://localhost:4010/health/live` → 200
4. `GET http://localhost:3000/login` → 200
5. Run staging UAT checklist: `docs/staging/uat-checklist.md`

## Keycloak MFA (privileged roles)

1. Import realm: `infra/keycloak/society-connect-realm.json`
2. Enforce TOTP required action for committee/treasurer/platform-admin users
3. Verify `amr`/`acr` claims satisfy API MFA policy

## RLS apply (staging operator)

Apply `packages/db/rls/001-tenant-isolation.sql` after setting session `app.current_society_id` in the request path.

## Rollback

```powershell
docker compose -f docker-compose.yml -f docker-compose.rc.yml down
# redeploy previous image tags
```
