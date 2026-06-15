# Local Keycloak

The local Keycloak service is defined in `docker-compose.yml` as `keycloak`.

Default local values:

- URL: `http://localhost:8080`
- Admin user: `admin`
- Admin password: `admin`
- Realm target: `society-connect`
- Web client target: `society-web`

Phase 1 only starts the service. Phase 2 will define realms, clients, roles, MFA policy, invite/OTP workflows, and the NestJS/Next.js OIDC integration.

Keycloak stores its local data in a separate `keycloak` database inside the same PostgreSQL container.

Phase 2 adds `society-connect-realm.json` as the local realm import. Docker Compose mounts this directory into `/opt/keycloak/data/import` and starts Keycloak with `--import-realm`.

The realm defines:

- `society-connect` realm.
- Confidential `society-api` OpenID Connect client.
- `society_memberships` access-token mapper.
- `platform_roles` access-token mapper.
- TOTP required action for MFA enrollment.

The database is created by `infra/postgres/init/001-keycloak-database.sql` when the local PostgreSQL volume is initialized for the first time. If the Postgres volume already exists, run the database creation manually or recreate the local volume with `docker compose down -v`.
