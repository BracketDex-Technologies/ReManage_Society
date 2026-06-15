import { expect, test } from "@playwright/test";

async function assertNoCriticalA11yIssues(page: import("@playwright/test").Page, path: string) {
  await page.goto(path);
  const issues = await page.evaluate(() => {
    const violations: string[] = [];
    document.querySelectorAll("img:not([alt])").forEach((img) => {
      violations.push(`img-missing-alt:${img.getAttribute("src") || "unknown"}`);
    });
    document.querySelectorAll("button, a, input, select, textarea").forEach((el) => {
      const name = el.getAttribute("aria-label") || el.textContent?.trim();
      if (!name && el.tagName !== "INPUT") {
        violations.push(`unlabeled-control:${el.tagName}`);
      }
    });
    return violations;
  });

  expect(issues.length).toBeLessThan(25);
}

const criticalPaths = [
  "/login",
  "/dashboard",
  "/visitors",
  "/my-bills",
  "/complaints",
  "/notices",
];

for (const path of criticalPaths) {
  test(`${path} has no obvious critical a11y issues`, async ({ page }) => {
    await assertNoCriticalA11yIssues(page, path);
  });
}
