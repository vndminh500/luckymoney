import { expect, test } from "@playwright/test";

// Sample e2e test proving the Playwright setup runs against the real app.
test("home page renders", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByText("To get started, edit the")).toBeVisible();
});
