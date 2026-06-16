# ReManageSociety

A professional society maintenance management platform built as a TypeScript monorepo.

The repository combines a web application, backend API, background workers, mobile support, shared packages, and infrastructure tooling for a complete society operations experience.

## What this repository contains

- `apps/api/`: Fastify/NestJS backend API service
- `apps/worker/`: background worker and automation processes
- `android/`: Capacitor Android integration and project configuration
- `packages/`: shared libraries and domain modules used across applications
- `prisma/`: database schema, migrations, and seed scripts
- `infra/`: infrastructure configuration for Keycloak, Postgres, MinIO, and local deployment
- `scripts/`: developer utilities, validation tools, and release helpers
- `src/`: shared application configuration and runtime proxy logic
- `tests/`: end-to-end and integration test suites

## Key features

- Next.js 16 web frontend with React 19
- NestJS 11 backend running on Fastify
- Prisma 7 database layer with PostgreSQL support
- Capacitor mobile support for Android
- Shared package architecture for reusable domain logic
- Automated testing with Vitest and Playwright

## Getting started

### Prerequisites

- Node.js 20 or newer
- PostgreSQL for local development
- `npm` (the repository uses an npm workspace)
- `npx cap` for Capacitor mobile workflows

### Install dependencies

```bash
npm install
```

### Environment

Create a local environment file from the example and customize values for your setup:

```bash
copy .env.example .env
```

### Run locally

Start the web application:

```bash
npm run dev:web
```

Start the API or worker separately:

```bash
npm run dev:api
npm run dev:worker
```

Start all local services together:

```bash
npm run dev:all
```

## Build and production

Build the project and generate Prisma artifacts:

```bash
npm run build
```

Run the production web server:

```bash
npm start
```

## Testing

Run the full test suite:

```bash
npm test
```

Run specific test groups:

```bash
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:security
```

## Database commands

Validate schema and generate Prisma client:

```bash
npm run db:validate
npm run db:generate
```

Apply migrations and seed the database:

```bash
npm run db:migrate
npm run db:seed
```

Reset the database and seed test data:

```bash
npm run db:reset
npm run db:seed:test-chairmen
```

## Notes

- This repository is configured as a private workspace.
- Mobile integration is implemented with Capacitor and Android tooling.
- See `docker-compose.yml` and `infra/` for local infrastructure and dependency setup.

```bash
npm run db:reset
npm run db:seed:test-chairmen
```

## Notes

- This repository is configured as a private workspace.
- Mobile integration is implemented with Capacitor and Android tooling.
- See `docker-compose.yml` and `infra/` for local infrastructure and dependency setup.
