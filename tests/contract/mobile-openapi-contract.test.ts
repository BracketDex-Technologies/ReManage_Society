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

type Schema = {
  $ref?: string;
  type?: string;
  enum?: unknown[];
  properties?: Record<string, Schema>;
};

type OpenApiDocument = {
  paths: Record<string, Record<string, OpenApiOperation>>;
  components: { schemas: Record<string, Schema> };
};

function readContract(): OpenApiDocument {
  return JSON.parse(readFileSync(generatedContractPath, "utf8")) as OpenApiDocument;
}

function schemaFor(document: OpenApiDocument, schema: Schema | undefined): Schema {
  expect(schema).toBeDefined();
  if (!schema?.$ref) return schema as Schema;
  const match = /^#\/components\/schemas\/(.+)$/.exec(schema.$ref);
  expect(match).not.toBeNull();
  return document.components.schemas[match![1]];
}

describe("mobile v1 generated OpenAPI contract", () => {
  it("contains only the seven locked mobile foundation paths", () => {
    expect(existsSync(generatedContractPath)).toBe(true);
    if (!existsSync(generatedContractPath)) return;

    const document = readContract();
    const paths = Object.keys(document.paths);

    expect(paths).toEqual(expectedPaths);
    expect(paths.some((path) => path.startsWith("/api/v1") || path.includes("/_next") || path.startsWith("/api/auth"))).toBe(false);
  });

  it("describes JSON payloads and bearer protection for the mobile operations", () => {
    expect(existsSync(generatedContractPath)).toBe(true);
    if (!existsSync(generatedContractPath)) return;

    const document = readContract();

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

  it("publishes useful typed logout and bootstrap response data", () => {
    expect(existsSync(generatedContractPath)).toBe(true);
    if (!existsSync(generatedContractPath)) return;

    const document = readContract();
    const logout = schemaFor(
      document,
      document.paths["/api/mobile/v1/session/logout"].post.responses?.["200"]?.content?.["application/json"]?.schema as Schema,
    );
    expect(logout.properties?.loggedOut).toMatchObject({ type: "boolean", enum: [true] });

    const bootstrap = schemaFor(
      document,
      document.paths["/api/mobile/v1/session/bootstrap"].get.responses?.["200"]?.content?.["application/json"]?.schema as Schema,
    );
    const user = schemaFor(document, bootstrap.properties?.user);
    const society = schemaFor(document, bootstrap.properties?.society);
    const featureFlags = schemaFor(document, bootstrap.properties?.featureFlags);
    const notificationPolicy = schemaFor(document, bootstrap.properties?.notificationPolicy);

    expect(user.properties).toMatchObject({
      id: { type: "string" },
      name: { type: "string" },
      email: { type: "string" },
    });
    expect(society.properties).toMatchObject({
      id: { type: "string" },
      name: { type: "string" },
    });
    expect(featureFlags.properties).toMatchObject({
      residentShell: { type: "boolean", enum: [true] },
      guardShell: { type: "boolean", enum: [true] },
      nativePush: { type: "boolean", enum: [false] },
      guardOffline: { type: "boolean", enum: [false] },
    });

    for (const [channel, expected] of Object.entries({
      critical: { enabled: true, configurable: false },
      transactional: { enabled: true, configurable: true },
      community: { enabled: false, configurable: true },
    })) {
      const policy = schemaFor(document, notificationPolicy.properties?.[channel]);
      expect(policy.properties).toMatchObject({
        enabled: { type: "boolean", enum: [expected.enabled] },
        configurable: { type: "boolean", enum: [expected.configurable] },
      });
    }
  });
});
