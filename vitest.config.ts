import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@society/community-core": path.resolve(__dirname, "packages/community-core/src/index.ts"),
      "@society/config": path.resolve(__dirname, "packages/config/src/index.ts"),
      "@society/db": path.resolve(__dirname, "packages/db/src/index.ts"),
      "@society/finance-core": path.resolve(__dirname, "packages/finance-core/src/index.ts"),
      "@society/operations-core": path.resolve(__dirname, "packages/operations-core/src/index.ts"),
      "@society/security/rate-limit-server": path.resolve(__dirname, "packages/security/src/rate-limit-server.ts"),
      "@society/security": path.resolve(__dirname, "packages/security/src/index.ts"),
      "@society/society-core": path.resolve(__dirname, "packages/society-core/src/index.ts"),
      "@society/test": path.resolve(__dirname, "packages/test/src/index.ts"),
      "@society/ux-core": path.resolve(__dirname, "packages/ux-core/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: [
      "packages/**/*.test.ts",
      "apps/**/*.test.ts",
      "src/**/*.test.ts",
      "tests/**/*.test.ts",
    ],
    exclude: [
      "node_modules/**",
      ".next/**",
      "apps/worker/**/*.test.ts",
      "tests/e2e/**",
    ],
  },
});
