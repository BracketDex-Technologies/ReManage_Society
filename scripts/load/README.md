# Load Test Profile (Phase 8)

Target (roadmap): **50 societies**, **15,000 users**, **300 concurrent** sessions.

This smoke script validates infrastructure wiring with **300 VUs** against four read-heavy NestJS endpoints.

## Prerequisites

- k6 installed (`choco install k6` or https://k6.io/docs/get-started/installation/)
- API running with Postgres (`docker compose -f docker-compose.yml -f docker-compose.rc.yml up -d`)
- Valid bearer token + society membership for `LOAD_SOCIETY_ID`

## Run

```powershell
$env:API_BASE_URL="http://localhost:4000"
$env:LOAD_SOCIETY_ID="society_a"
$env:LOAD_BEARER_TOKEN="<oidc-or-bff-token>"
k6 run scripts/load/k6-api-smoke.js
```

Or:

```powershell
npm run load:api
```

## Thresholds

- p95 < 750 ms (excluding third-party calls)
- error rate < 1%

## Hardware assumptions

Staging reference: 4 vCPU, 8 GB RAM, local Postgres + API container on same host.

## CI

Manual `workflow_dispatch` only — see `.github/workflows/load-test.yml`.
