# Local PostgreSQL

The local PostgreSQL service is defined in `docker-compose.yml` as `postgres`.

Default local values:

- Host: `localhost`
- Port: `5432`
- Database: `society_connect`
- User: `society`
- Password: `society`

Runtime URLs:

```text
DATABASE_URL=postgresql://society:society@localhost:5432/society_connect?schema=public
DIRECT_URL=postgresql://society:society@localhost:5432/society_connect?schema=public
```

Use `DIRECT_URL` for migrations and administrative tasks. Use the runtime database URL for application queries.

Phase 1 does not redesign the Prisma schema or force the current app to use this local database unless `.env` points to it.

The same PostgreSQL container also creates a separate `keycloak` database for local Keycloak through `infra/postgres/init/001-keycloak-database.sql`.
