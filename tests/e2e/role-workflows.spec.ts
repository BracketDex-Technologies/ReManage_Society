import { expect, test } from "@playwright/test";

const publicRoutes = [
  { path: "/login", title: /login|sign/i },
  { path: "/dashboard", redirectOrShell: true },
  { path: "/visitors", redirectOrShell: true },
  { path: "/my-bills", redirectOrShell: true },
  { path: "/complaints", redirectOrShell: true },
  { path: "/maintenance", redirectOrShell: true },
];

for (const route of publicRoutes) {
  test(`route ${route.path} responds without server error`, async ({ page }) => {
    const response = await page.goto(route.path);
    expect(response).not.toBeNull();
    expect(response?.status()).toBeLessThan(500);
  });
}

test("home page responds without server error", async ({ page }) => {
  const response = await page.goto("/");
  expect(response).not.toBeNull();
  expect(response?.status()).toBeLessThan(500);
});
