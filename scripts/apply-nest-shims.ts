import { Project, SyntaxKind } from "ts-morph";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { resolveRouteDisposition } from "../src/lib/api/route-disposition.js";

const ROOT = process.cwd();
const INVENTORY_FILE = path.join(ROOT, "docs", "api", "legacy-route-inventory.md");

function getShimFiles() {
  const content = readFileSync(INVENTORY_FILE, "utf8");
  const lines = content.split("\n");
  const shimFiles = [];
  for (const line of lines) {
    if (line.includes("| shim-to-nest |")) {
      const parts = line.split("|").map(p => p.trim());
      const fileRaw = parts[4]; // The source file column
      if (fileRaw) {
        const filePath = fileRaw.replace(/`/g, "");
        shimFiles.push(path.join(ROOT, filePath));
      }
    }
  }
  return shimFiles;
}

const shimFiles = getShimFiles();
const project = new Project({
  tsConfigFilePath: path.join(ROOT, "tsconfig.json"),
});

console.log(`Found ${shimFiles.length} files to shim.`);

for (const filePath of shimFiles) {
  const sourceFile = project.getSourceFile(filePath) || project.addSourceFileAtPath(filePath);
  const disposition = resolveRouteDisposition(filePath);
  
  if (!disposition.nestEquivalent) {
    console.warn(`Skipping ${filePath} - no nest equivalent`);
    continue;
  }

  const nestPath = disposition.nestEquivalent.replace("POST ", "").replace("/*", "");
  const apiPath = disposition.routePath;

  // Add import if not exists
  let hasImport = false;
  for (const imp of sourceFile.getImportDeclarations()) {
    if (imp.getModuleSpecifierValue() === "@/lib/api/nest-shim") {
      hasImport = true;
      const namedImports = imp.getNamedImports().map(n => n.getName());
      if (!namedImports.includes("shimOrFallback")) {
        imp.addNamedImport("shimOrFallback");
      }
      break;
    }
  }

  if (!hasImport) {
    sourceFile.addImportDeclaration({
      moduleSpecifier: "@/lib/api/nest-shim",
      namedImports: ["shimOrFallback"]
    });
  }

  // Find all exported async functions GET, POST, PUT, PATCH, DELETE
  const exportedFunctions = sourceFile.getFunctions().filter(f => f.isExported() && ["GET", "POST", "PUT", "PATCH", "DELETE"].includes(f.getName() || ""));

  for (const func of exportedFunctions) {
    const name = func.getName();
    if (!name) continue;

    func.setIsExported(false);
    const legacyName = `legacy${name}`;
    func.rename(legacyName);

    sourceFile.addVariableStatement({
      isExported: true,
      declarations: [{
        name: name,
        initializer: `shimOrFallback({ legacyRoute: "${apiPath}", nestPath: "${nestPath}", method: "${name}" }, ${legacyName})`
      }]
    });
    console.log(`Shimmed ${name} in ${filePath}`);
  }

  sourceFile.saveSync();
}

console.log("Done.");
