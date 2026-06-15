import { describe, expect, it } from "vitest";
import { requireDatabaseUrl } from "./prisma.ts";

describe("requireDatabaseUrl", () => {
  it("accepts PostgreSQL connection strings", () => {
    const url = "postgresql://user:secret@example.neon.tech/neondb?sslmode=require";
    expect(requireDatabaseUrl(url)).toBe(url);
  });

  it("rejects missing connection strings", () => {
    expect(() => requireDatabaseUrl("")).toThrow("project .env file");
  });

  it("rejects non-PostgreSQL connection strings", () => {
    expect(() => requireDatabaseUrl("mysql://user:secret@localhost/database")).toThrow(
      "postgresql:// or postgres://",
    );
  });
});
