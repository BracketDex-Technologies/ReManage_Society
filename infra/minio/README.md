# Local MinIO

The local MinIO service is defined in `docker-compose.yml` as `minio`.

Default local endpoints:

- S3 API: `http://localhost:9000`
- Console: `http://localhost:9001`
- Root user: `minioadmin`
- Root password: `minioadmin`

Runtime values:

```text
S3_ENDPOINT=http://localhost:9000
S3_REGION=local
S3_BUCKET=society-connect-local
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_FORCE_PATH_STYLE=true
```

Phase 2 adds API-side SigV4 presigned URL generation through `S3PresignedUrlService` and tenant-scoped upload intents through `FileStoragePolicyService`.

Local MinIO still needs to be running for live upload/download verification.

