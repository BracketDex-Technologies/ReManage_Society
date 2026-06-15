# Incident Response Runbook

## Severity levels

| Level | Example | Response target |
|---|---|---|
| SEV1 | Cross-tenant data exposure, payment duplication | Immediate rollback + notify stakeholders |
| SEV2 | API down, DB unreachable, auth outage | Restore within 1 hour |
| SEV3 | Degraded worker, push 503, slow p95 | Mitigate within 4 hours |
| SEV4 | Non-critical UI defect | Next business day |

## Triage checklist

1. Confirm scope: one society vs platform-wide.
2. Check `/health/live` and `/health/ready` on API (4000) and worker (4010).
3. Check Postgres, Valkey, MinIO, Keycloak container health.
4. Review recent deploys and migration applies.
5. Capture request IDs from API logs for affected mutations.

## Failure modes

| Component | Symptom | Mitigation |
|---|---|---|
| Postgres down | API `/health/ready` 503 | Restart `postgres`; restore from backup if corrupt |
| Valkey down | Rate limit falls back to in-memory per instance | Restart Valkey; accept brief uneven limits |
| MinIO down | Upload intents fail | Restart MinIO; verify bucket policy |
| Keycloak down | Bearer auth fails | Restart Keycloak; verify realm import |
| VAPID missing | `POST /api/push/dispatch` returns 503 | Expected in CI; configure VAPID in staging |
| Nest shim timeout | Legacy route slow/errors | Disable `NEST_SHIM_ENABLED`; use legacy handler |

## Rollback

1. Stop `web`, `api`, `worker` containers.
2. Deploy previous image tags (see `deployment.md`).
3. Restore database only if schema/data regression confirmed.
4. Re-run `npm run phase8:rc` smoke on staging.
