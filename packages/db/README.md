# @society/db

`@society/db` is the shared database boundary for Prisma runtime access, migrations, seed data, and PostgreSQL database policy work.

## Phase 1 Status

The active Prisma schema and migrations intentionally remain in the root `prisma/` directory during Phase 1:

- Schema: `prisma/schema.prisma`
- Migrations: `prisma/migrations`
- Seed script: `prisma/seed.ts`
- Prisma config: `prisma.config.ts`

Keeping these files in place avoids changing current Next.js runtime behavior while the monorepo foundation is still being introduced.

Runtime Prisma ownership has moved into `packages/db/src`:

- `src/prisma.ts` creates the shared Prisma client and PostgreSQL pool.
- `src/connection-url.ts` redacts database URLs for health checks and logs.
- `src/index.ts` exports the package boundary.

The current Next.js app still imports from `src/lib/prisma.ts`; that file now re-exports this package so existing domain code keeps working while new NestJS modules use the same database boundary.

## Scripts

Run database commands from the repository root:

```powershell
npm run db:check
npm run db:validate
npm run db:generate
npm run typecheck:db
npm run db:migrate:deploy
npm run db:seed
npm run db:reset
```

`DATABASE_URL` must be the pooled Neon PostgreSQL URL used by application traffic. Set `DIRECT_URL` to the matching direct Neon URL for migrations and schema operations. No runtime dummy database fallback is provided.

The package-level scripts delegate to the root scripts so future workspace commands can target `@society/db` without duplicating Prisma configuration.

The NestJS API uses `apps/api/src/database/database.module.ts` for database readiness checks. `/health/ready` pings the database through this package and returns degraded readiness if the ping fails.

## Later Migration Work

Later phases can move the schema, migrations, seeds, RLS policies, and database test fixtures under this package once the web, API, and worker services all consume the same package boundary.
