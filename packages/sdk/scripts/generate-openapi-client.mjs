import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import openapiTS, { astToString } from "openapi-typescript";

const baseUrl = (process.env.NEST_API_BASE_URL || "http://localhost:4000")
  .replace(/\/$/, "");
const outputDir = path.join(process.cwd(), "packages", "sdk", "generated");
const specPath = path.join(outputDir, "mobile-v1.openapi.json");
const typesPath = path.join(outputDir, "mobile-v1.ts");

async function main() {
  const specUrl = `${baseUrl}/docs-json`;
  const response = await fetch(specUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch OpenAPI spec from ${specUrl} (${response.status})`);
  }

  const spec = filterMobileContract(await response.json());
  if (Object.keys(spec.paths).length === 0) {
    throw new Error("OpenAPI document does not contain any /api/mobile/v1 paths");
  }

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(specPath, `${JSON.stringify(spec, null, 2)}\n`, "utf8");
  const ast = await openapiTS(spec);
  writeFileSync(typesPath, astToString(ast), "utf8");
  console.log(`Generated ${Object.keys(spec.paths).length} mobile paths at ${specPath}`);
  console.log(`Generated TypeScript client types at ${typesPath}`);
}

function filterMobileContract(document) {
  const paths = Object.fromEntries(
    Object.entries(document.paths ?? {})
      .filter(([path]) => path.startsWith("/api/mobile/v1"))
      .sort(([left], [right]) => left.localeCompare(right)),
  );
  const schemaNames = referencedSchemas(paths, document.components?.schemas ?? {});
  const securityNames = referencedSecuritySchemes(paths, document.security ?? []);
  const schemas = sortEntries(
    Object.fromEntries(
      [...schemaNames]
        .sort()
        .flatMap((name) => document.components?.schemas?.[name] ? [[name, document.components.schemas[name]]] : []),
    ),
  );
  const securitySchemes = sortEntries(
    Object.fromEntries(
      [...securityNames]
        .sort()
        .flatMap((name) => document.components?.securitySchemes?.[name] ? [[name, document.components.securitySchemes[name]]] : []),
    ),
  );

  return {
    openapi: document.openapi,
    info: document.info,
    paths,
    components: {
      ...(Object.keys(schemas).length > 0 ? { schemas } : {}),
      ...(Object.keys(securitySchemes).length > 0 ? { securitySchemes } : {}),
    },
  };
}

function referencedSchemas(value, allSchemas, names = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) referencedSchemas(item, allSchemas, names);
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (key === "$ref" && typeof item === "string") {
        const match = /^#\/components\/schemas\/(.+)$/.exec(item);
        if (match && !names.has(match[1])) {
          names.add(match[1]);
          referencedSchemas(allSchemas[match[1]], allSchemas, names);
        }
      } else {
        referencedSchemas(item, allSchemas, names);
      }
    }
  }
  return names;
}

function referencedSecuritySchemes(paths, globalSecurity) {
  const names = new Set();
  const collect = (security) => {
    for (const requirement of security ?? []) {
      for (const name of Object.keys(requirement)) names.add(name);
    }
  };
  collect(globalSecurity);
  for (const path of Object.values(paths)) {
    for (const operation of Object.values(path)) collect(operation.security);
  }
  return names;
}

function sortEntries(entries) {
  return Object.fromEntries(Object.entries(entries).sort(([left], [right]) => left.localeCompare(right)));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
