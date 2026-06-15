import type { Pool, PoolClient } from "pg";

const TENANT_SETTING = "app.current_society_id";

export function isTenantRlsEnabled(): boolean {
  return process.env.TENANT_RLS_ENABLED === "true";
}

export async function setTenantSession(client: PoolClient, societyId: string): Promise<void> {
  if (!societyId.trim()) {
    throw new Error("Tenant session requires a non-empty societyId");
  }

  await client.query(`SELECT set_config('${TENANT_SETTING}', $1, true)`, [societyId]);
}

export async function clearTenantSession(client: PoolClient): Promise<void> {
  await client.query(`SELECT set_config('${TENANT_SETTING}', '', true)`);
}

export async function withTenantSession<T>(
  pool: Pool,
  societyId: string,
  run: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();

  try {
    if (isTenantRlsEnabled()) {
      await setTenantSession(client, societyId);
    }

    return await run(client);
  } finally {
    if (isTenantRlsEnabled()) {
      await clearTenantSession(client).catch(() => undefined);
    }

    client.release();
  }
}
