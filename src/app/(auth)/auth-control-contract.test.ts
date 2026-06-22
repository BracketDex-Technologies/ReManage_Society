import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const authFiles = [
  "src/app/(auth)/login/LoginForm.tsx",
  "src/app/(auth)/join/page.tsx",
  "src/app/(auth)/register/page.tsx",
].map((file) => readFileSync(resolve(process.cwd(), file), "utf8"));

describe("auth utility controls", () => {
   it("credits BracketDex Technologies in the login footer", () => {
    const loginForm = authFiles[0];

    expect(loginForm).toContain("Powered by BracketDex Technologies");
    expect(loginForm).not.toContain("BracketDexTechnologies.in");
  
  });

  it("marks password reveal controls as input icon buttons", () => {
    for (const source of authFiles) {
      expect(source).toContain("input-icon-button");
    }
  });
});
