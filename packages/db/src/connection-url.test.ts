import { describe, expect, it } from "vitest";
import { redactDatabaseUrl } from "./connection-url.ts";

describe("redactDatabaseUrl", () => {
  it("redacts username, password, and query parameters from PostgreSQL URLs", () => {
    const redacted = redactDatabaseUrl(
      "postgresql://society:secret@localhost:5432/society_connect?schema=public",
    );

    expect(redacted).toBe("postgresql://<credentials>@localhost:5432/society_connect");
    expect(redacted).not.toContain("society:secret");
    expect(redacted).not.toContain("schema=public");
  });

  it("returns a stable placeholder when the database URL is missing", () => {
    expect(redactDatabaseUrl(undefined)).toBe("not-configured");
  });
});
