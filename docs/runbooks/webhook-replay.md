# Webhook Replay Runbook

## Razorpay payment webhooks

Idempotency key format: `razorpay:{eventId}:{paymentId}` (see `@society/finance-core`).

## Safe replay procedure

1. Confirm original webhook delivery failed (gateway dashboard + app logs).
2. Locate `eventId` and `paymentId` from Razorpay dashboard.
3. Verify idempotency key not already posted:

```sql
SELECT id, sourceType, sourceId FROM "FinancialTransaction"
WHERE "sourceId" = '<paymentId>';
```

4. Re-send signed webhook payload to the verified endpoint with the **same** `eventId`.
5. Confirm single ledger posting; `replayed: true` on duplicate API calls.

## Manual finance reconciliation job

Enqueue finance worker envelope `payment-reconciliation` (see `apps/worker/src/finance-worker.ts`) after provider outage.

## Do not

- Change `paymentId` on replay (creates duplicate charge risk).
- Replay without signature verification in production.
