import { expect, test, type Page } from "@playwright/test";

async function registerAndSignIn(page: Page): Promise<void> {
  await page.goto("/register");
  await page
    .getByLabel("Email")
    .fill(`e2e-set-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`);
  await page.getByLabel("Mật khẩu", { exact: true }).fill("mat-khau-e2e-123");
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await expect(page).toHaveURL("/");
}

async function categoryId(page: Page, name: string): Promise<string> {
  const categories: { id: string; name: string; type: string }[] = await (
    await page.request.get("/api/categories")
  ).json();
  const found = categories.find((c) => c.name === name && c.type === "EXPENSE");
  if (!found) throw new Error(`missing category ${name}`);
  return found.id;
}

async function spend(page: Page, name: string, amount: number, occurredAt: string) {
  const response = await page.request.post("/api/transactions", {
    data: { type: "EXPENSE", amount, categoryId: await categoryId(page, name), occurredAt },
  });
  expect(response.status()).toBe(201);
}

test("the avatar menu leads to the settings sections", async ({ page }) => {
  await registerAndSignIn(page);
  await page.getByRole("button", { name: "Tài khoản của bạn" }).click();
  await page
    .getByRole("navigation", { name: "Tài khoản", exact: true })
    .getByRole("link", { name: "Cài đặt" })
    .click();
  await expect(page).toHaveURL("/settings");
  await expect(page.getByRole("navigation", { name: "Mục cài đặt" }).getByRole("link")).toHaveText([
    "Tùy chỉnh tài chính",
    "Giao diện",
    "Thông báo",
    "Về ứng dụng",
  ]);
  await page.getByRole("link", { name: "Về ứng dụng" }).click();
  await expect(page.getByText(/Phiên bản \d+\.\d+\.\d+/)).toBeVisible();
});

test("amount format, date format and week start change what the app shows", async ({ page }) => {
  await registerAndSignIn(page);
  await spend(page, "Ăn uống", 45_000, "2026-11-22T05:00:00Z"); // Sunday 22/11 in Vietnam

  await page.goto("/settings");
  await page.getByText("Chữ đ").click();
  await page.getByText("Năm-tháng-ngày").click();
  await page.getByText("Chủ Nhật").click();
  await page.getByRole("button", { name: "Lưu tùy chỉnh" }).click();
  await expect(page.getByRole("status")).toHaveText("Đã lưu tùy chỉnh tài chính.");

  await page.goto("/transactions?month=2026-11");
  const list = page.getByRole("list", { name: "Giao dịch" });
  await expect(list).toContainText(/−45\.000\sđ/);
  await expect(list).toContainText("2026-11-22");

  // Weeks now start on Sunday, so 22/11 opens its own week.
  await page.goto("/stats?period=week&date=2026-11-24");
  await expect(page.getByRole("heading", { name: "Tuần 22/11 – 28/11/2026" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Tổng kết kỳ" })).toContainText(/−45\.000\sđ/);

  // Short amounts.
  await page.goto("/settings");
  await page.getByText("Rút gọn", { exact: true }).click();
  await page.getByRole("button", { name: "Lưu tùy chỉnh" }).click();
  await expect(page.getByRole("status")).toBeVisible();
  await page.goto("/?month=2026-11");
  await expect(page.getByRole("region", { name: "Tổng quan tháng" })).toContainText("−45k");
});

test("the theme applies at once and survives a reload", async ({ page }) => {
  await registerAndSignIn(page);
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "system");

  await page.goto("/settings/appearance");
  await page.getByText("Tối", { exact: true }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("status")).toHaveText("Đã lưu giao diện.");

  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "dark");
  // Dark surfaces are in effect even though the browser prefers light.
  const background = await page
    .locator(".dash-shell")
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(background).toBe("rgb(6, 27, 43)");

  await page.getByText("Sáng", { exact: true }).click();
  await expect(html).toHaveAttribute("data-theme", "light");
});

test("budget alerts on the dashboard follow the notification switches", async ({ page }) => {
  await registerAndSignIn(page);
  const food = await categoryId(page, "Ăn uống");
  const budget = await page.request.put("/api/budgets", {
    data: { categoryId: food, month: "2026-11", amount: 100_000 },
  });
  expect(budget.status()).toBe(200);
  await spend(page, "Ăn uống", 85_000, "2026-11-10T05:00:00Z");

  await page.goto("/?month=2026-11");
  const alerts = page.getByRole("region", { name: "Cảnh báo ngân sách" });
  await expect(alerts).toContainText("Ăn uống: sắp chạm hạn mức (85%)");

  await page.goto("/settings/notifications");
  const warningSwitch = page.getByRole("switch", { name: /Sắp chạm hạn mức/ });
  await page.getByText("Sắp chạm hạn mức", { exact: true }).click();
  await expect(warningSwitch).not.toBeChecked();
  await page.getByRole("button", { name: "Lưu thông báo" }).click();
  await expect(page.getByRole("status")).toHaveText("Đã lưu thông báo.");

  await page.goto("/?month=2026-11");
  await expect(page.getByRole("heading", { name: "Tháng 11/2026" })).toBeVisible();
  await expect(alerts).toHaveCount(0);
});
