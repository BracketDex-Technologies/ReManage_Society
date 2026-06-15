export interface TenantRlsPolicyOptions {
  tableName: string;
  societyColumn: string;
}

export function buildTenantRlsPolicySql(options: TenantRlsPolicyOptions): string {
  const tableName = quoteIdentifier(options.tableName);
  const societyColumn = quoteIdentifier(options.societyColumn);

  return [
    `ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE ${tableName} FORCE ROW LEVEL SECURITY;`,
    `DROP POLICY IF EXISTS tenant_isolation ON ${tableName};`,
    `CREATE POLICY tenant_isolation ON ${tableName}`,
    "  USING (",
    `    ${societyColumn} = current_setting('app.current_society_id', true)`,
    "  )",
    "  WITH CHECK (",
    `    ${societyColumn} = current_setting('app.current_society_id', true)`,
    "  );",
  ].join("\n");
}

function quoteIdentifier(identifier: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }

  return `"${identifier}"`;
}

