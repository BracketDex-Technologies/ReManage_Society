import { expect, test } from "@playwright/test";

test("web app responds without a server error", async ({ page }) => {
  const response = await page.goto("/");

  expect(response).not.toBeNull();
  expect(response?.status()).toBeLessThan(500);
});
