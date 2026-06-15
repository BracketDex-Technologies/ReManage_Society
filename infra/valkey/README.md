# Local Valkey

The local Valkey service is defined in `docker-compose.yml` as `valkey`.

Default local URL:

```text
VALKEY_URL=redis://localhost:6379
```

Future use:

- distributed rate limiting
- BullMQ queues
- short-lived cache entries
- idempotency and lock coordination where appropriate

Do not store durable business state only in Valkey.

Phase 2 adds `ValkeyRateLimitStore` as the distributed rate-limit adapter boundary. The API can use the in-memory fallback for tests, but production-like runs should connect the adapter to the local Valkey service.

