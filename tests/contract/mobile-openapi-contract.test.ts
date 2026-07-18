import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const generatedContractPath = "packages/sdk/generated/mobile-v1.openapi.json";
const expectedPaths = [
  "/api/mobile/v1/auth/otp/request",
  "/api/mobile/v1/auth/otp/verify",
  "/api/mobile/v1/auth/password",
  "/api/mobile/v1/session/active-role",
  "/api/mobile/v1/session/bootstrap",
  "/api/mobile/v1/session/logout",
  "/api/mobile/v1/session/refresh",
];

type OpenApiOperation = {
  requestBody?: { content?: Record<string, { schema?: unknown }> };
  responses?: Record<string, { content?: Record<string, { schema?: unknown }> }>;
  security?: Array<Record<string, string[]>>;
};

describe("mobile v1 generated OpenAPI contract", () => {
  it("contains only the seven locked mobile foundation paths", () => {
    expect(existsSync(generatedContractPath)).toBe(true);
    if (!existsSync(generatedContractPath)) return;

    const document = JSON.parse(readFileSync(generatedContractPath, "utf8")) as {
      paths: Record<string, Record<string, OpenApiOperation>>;
    };
    const paths = Object.keys(document.paths);

    expect(paths).toEqual(expectedPaths);
    expect(paths.some((path) => path.startsWith("/api/v1") || path.includes("/_next") || path.startsWith("/api/auth"))).toBe(false);
  });

  it("describes JSON payloads and bearer protection for the mobile operations", () => {
    expect(existsSync(generatedContractPath)).toBe(true);
    if (!existsSync(generatedContractPath)) return;

    const document = JSON.parse(readFileSync(generatedContractPath, "utf8")) as {
      paths: Record<string, Record<string, OpenApiOperation>>;
    };

    for (const [path, methods] of Object.entries(document.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        const success = Object.entries(operation.responses ?? {}).find(([status]) => status.startsWith("2"))?.[1];
        expect(success?.content?.["application/json"]?.schema, `${method.toUpperCase()} ${path} response`).toBeDefined();

        if (["post", "put", "patch"].includes(method)) {
          expect(operation.requestBody?.content?.["application/json"]?.schema, `${method.toUpperCase()} ${path} request`).toBeDefined();
        }
      }
    }

    for (const path of ["/api/mobile/v1/session/bootstrap", "/api/mobile/v1/session/active-role"]) {
      const operation = document.paths[path][path.endsWith("bootstrap") ? "get" : "put"];
      expect(operation.security).toEqual([{ bearer: [] }]);
    }
  });
});
