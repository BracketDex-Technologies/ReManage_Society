import { expect, test } from "@playwright/test";

test("login page reflects selected Hindi locale", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("society-language", "hi");
  });

  await page.goto("/login");

  const signInHeading = page.getByRole("heading", { name: /साइन इन|खाते/i });
  await expect(signInHeading).toBeVisible();
});

test("login page reflects selected Marathi locale", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("society-language", "mr");
  });

  await page.goto("/login");

  const signInHeading = page.getByRole("heading", { name: /साइन इन|खात्यात/i });
  await expect(signInHeading).toBeVisible();
});
