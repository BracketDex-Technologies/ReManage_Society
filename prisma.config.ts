import 'dotenv/config'
import { defineConfig } from 'prisma/config'

const schemaPath = 'prisma/schema.prisma'
const migrationsPath = 'prisma/migrations'
const databaseUrl = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim()

export default defineConfig({
  schema: schemaPath,
  migrations: { path: migrationsPath },
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
})
