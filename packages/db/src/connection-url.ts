const NOT_CONFIGURED = "not-configured";

export function redactDatabaseUrl(databaseUrl: string | undefined): string {
  if (!databaseUrl) {
    return NOT_CONFIGURED;
  }

  try {
    const parsed = new URL(databaseUrl);
    const credentials = parsed.username || parsed.password ? "<credentials>@" : "";
    const pathname = parsed.pathname === "/" ? "" : parsed.pathname;

    return `${parsed.protocol}//${credentials}${parsed.host}${pathname}`;
  } catch {
    return "invalid-url";
  }
}
