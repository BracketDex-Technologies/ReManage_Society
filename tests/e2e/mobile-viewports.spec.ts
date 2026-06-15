import { expect, test } from "@playwright/test";

const routes = ["/login", "/dashboard", "/visitors"];

for (const path of routes) {
  test(`mobile viewport renders ${path}`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response).not.toBeNull();
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator("body")).toBeVisible();
  });
}
