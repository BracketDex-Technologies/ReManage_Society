import "dotenv/config";
import pg from "pg";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL?.trim() || process.env.DIRECT_URL?.trim();

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is missing. Add the pooled Neon connection string to the project .env file and restart the server.",
  );
}

const parsed = new URL(connectionString);
if (!parsed.hostname.endsWith(".neon.tech")) {
  throw new Error(`DATABASE_URL must point to Neon. Received host: ${parsed.hostname}`);
}

const pool = new Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 1_000,
  allowExitOnIdle: true,
});

try {
  const result = await pool.query(
    "SELECT current_database() AS database_name, current_user AS database_user, version() AS server_version",
  );
  const row = result.rows[0];
  console.log(`Connected to Neon database "${row.database_name}" as "${row.database_user}".`);
  console.log(row.server_version);
} finally {
  await pool.end();
}
