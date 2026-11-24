import { expect, test, type Page } from "@playwright/test";

async function registerAndSignIn(page: Page): Promise<void> {
  await page.goto("/register");
  await page
    .getByLabel("Email")
    .fill(`e2e-nav-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`);
  await page.getByLabel("Mật khẩu", { exact: true }).fill("mat-khau-e2e-123");
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await expect(page).toHaveURL("/");
}

test("the sidebar lists the sections and marks the current one", async ({ page }) => {
  await registerAndSignIn(page);
  const nav = page.getByRole("navigation", { name: "Chính" });

  await expect(nav.getByRole("link")).toHaveText([
    "Tổng quan",
    "Thống kê",
    "Giao dịch",
    "Ngân sách",
    "Danh mục",
  ]);
  await expect(nav.getByRole("link", { name: "Tổng quan" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await nav.getByRole("link", { name: "Ngân sách" }).click();
  await expect(page).toHaveURL("/budgets");
  await expect(nav.getByRole("link", { name: "Ngân sách" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(nav.getByRole("link", { name: "Tổng quan" })).not.toHaveAttribute("aria-current");

  // The top bar only holds sign-out.
  const topBar = page.getByRole("banner");
  await expect(topBar.getByRole("link")).toHaveCount(0);
  await expect(topBar.getByRole("button", { name: "Đăng xuất" })).toBeVisible();
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("the menu opens as a drawer and closes after choosing a section", async ({ page }) => {
    await registerAndSignIn(page);
    const menuButton = page.getByRole("button", { name: "Mở menu" });
    const nav = page.getByRole("navigation", { name: "Chính" });

    await expect(nav).toBeHidden();
    await menuButton.click();
    await expect(menuButton).toHaveAttribute("aria-expanded", "true");
    await expect(nav).toBeVisible();

    await nav.getByRole("link", { name: "Giao dịch" }).click();
    await expect(page).toHaveURL("/transactions");
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");

    // Escape closes it too.
    await menuButton.click();
    await expect(nav).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  });
});
