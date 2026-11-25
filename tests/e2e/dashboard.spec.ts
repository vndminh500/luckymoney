import { expect, test, type Page } from "./fixtures";

const PASSWORD = "mat-khau-e2e-123";

async function registerAndSignIn(page: Page): Promise<void> {
  await page.goto("/register");
  await page
    .getByLabel("Email")
    .fill(`e2e-dash-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await expect(page).toHaveURL("/");
}

/** Seeds June 2026 through the API (Asia/Ho_Chi_Minh, the default time zone). */
async function seedJune(page: Page): Promise<void> {
  const categories: { id: string; name: string; type: string }[] = await (
    await page.request.get("/api/categories")
  ).json();
  const id = (name: string, type: string) =>
    categories.find((c) => c.name === name && c.type === type)?.id;

  const add = async (type: string, amount: number, category: string, occurredAt: string) => {
    const response = await page.request.post("/api/transactions", {
      data: { type, amount, categoryId: id(category, type), occurredAt },
    });
    expect(response.status()).toBe(201);
    return (await response.json()).id as string;
  };

  await add("EXPENSE", 45_000, "Ăn uống", "2026-06-03T05:00:00Z");
  await add("EXPENSE", 30_000, "Đi lại", "2026-06-03T09:00:00Z");
  await add("INCOME", 15_000_000, "Lương", "2026-06-05T02:00:00Z");
  // 31/05 23:30 in Vietnam: belongs to May, not June.
  await add("EXPENSE", 99_000, "Ăn uống", "2026-05-31T16:30:00Z");
  // Deleted: must not count.
  const deleted = await add("EXPENSE", 500_000, "Mua sắm", "2026-06-10T05:00:00Z");
  expect((await page.request.delete(`/api/transactions/${deleted}`)).status()).toBe(204);
}

test("dashboard numbers match the seeded transactions", async ({ page }) => {
  await registerAndSignIn(page);
  await seedJune(page);

  await page.goto("/?month=2026-06");
  await expect(page.getByRole("heading", { name: "Tháng 6/2026" })).toBeVisible();

  const summary = page.getByRole("region", { name: "Tổng quan tháng" });
  await expect(summary).toContainText(/Thu\s*\+15\.000\.000\s₫/);
  await expect(summary).toContainText(/Chi\s*−75\.000\s₫/);
  await expect(summary).toContainText(/Số dư\s*14\.925\.000\s₫/);

  const byCategory = page.getByRole("list", { name: "Chi tiêu theo danh mục" });
  const rows = byCategory.getByRole("listitem");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText(/Ăn uống\s*60%\s*45\.000\s₫/);
  await expect(rows.nth(1)).toContainText(/Đi lại\s*40%\s*30\.000\s₫/);
  await expect(byCategory).not.toContainText("Mua sắm");
  const donut = page.getByRole("img", { name: /Biểu đồ tròn chi tiêu theo danh mục/ });
  await expect(donut).toBeVisible();
  await expect(donut).toContainText(/Tổng chi\s*75\.000\s₫/);
  await expect(donut.locator(".recharts-pie-sector")).toHaveCount(2);

  await page.getByText("Xem dạng bảng").click();
  const table = page.getByRole("table", { name: "Thu và chi theo ngày" });
  await expect(table.getByRole("row")).toHaveCount(3); // header + 03/06 + 05/06
  await expect(table.getByRole("row", { name: /03\/06/ })).toContainText(/75\.000\s₫/);
  await expect(table.getByRole("row", { name: /05\/06/ })).toContainText(/15\.000\.000\s₫/);
});

test("month navigation moves between months", async ({ page }) => {
  await registerAndSignIn(page);
  await seedJune(page);
  await page.goto("/?month=2026-06");

  await page.getByRole("link", { name: "Tháng trước" }).click();
  await expect(page.getByRole("heading", { name: "Tháng 5/2026" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Tổng quan tháng" })).toContainText(
    /Chi\s*−99\.000\s₫/,
  );

  await page.getByRole("link", { name: "Tháng sau" }).click();
  await expect(page.getByRole("heading", { name: "Tháng 6/2026" })).toBeVisible();
  await page.getByRole("link", { name: "Tháng sau" }).click();
  await expect(page.getByRole("heading", { name: "Tháng 7/2026" })).toBeVisible();
  await expect(page.getByText("Chưa có khoản chi nào trong tháng này.").first()).toBeVisible();
});

test("the month picker jumps straight to a month years back", async ({ page }) => {
  await registerAndSignIn(page);
  await page.goto("/?month=2026-06");
  const trigger = page.getByRole("button", { name: "Tháng 6/2026. Chọn tháng khác" });

  // Mouse: open, go back two years, pick March.
  await trigger.click();
  const panel = page.getByRole("dialog", { name: "Chọn tháng" });
  await expect(panel.getByRole("link", { name: "Tháng 6/2026" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await panel.getByRole("button", { name: "Năm trước" }).click();
  await panel.getByRole("button", { name: "Năm trước" }).click();
  await panel.getByRole("link", { name: "Tháng 3/2024" }).click();
  await expect(page).toHaveURL("/?month=2024-03");
  await expect(page.getByRole("heading", { name: "Tháng 3/2024" })).toBeVisible();
  await expect(panel).toBeHidden();

  // Years view: from 2024 to 2019 in three clicks.
  await page.getByRole("button", { name: "Tháng 3/2024. Chọn tháng khác" }).click();
  await panel.getByRole("button", { name: "Năm 2024. Chọn năm khác" }).click();
  await panel.getByRole("button", { name: "2019" }).click();
  await panel.getByRole("link", { name: "Tháng 11/2019" }).click();
  await expect(page).toHaveURL("/?month=2019-11");

  // "Tháng này" comes back to the current month.
  await page.getByRole("main").getByRole("link", { name: "Tháng này" }).first().click();
  await expect(page).toHaveURL(/\/\?month=\d{4}-\d{2}$/);
  await expect(page.getByRole("main").getByRole("link", { name: "Tháng này" })).toHaveCount(0);
});

test("the month picker works with the keyboard", async ({ page }) => {
  await registerAndSignIn(page);
  await page.goto("/?month=2026-06");

  const trigger = page.getByRole("button", { name: "Tháng 6/2026. Chọn tháng khác" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const panel = page.getByRole("dialog", { name: "Chọn tháng" });
  await expect(panel.getByRole("link", { name: "Tháng 6/2026" })).toBeFocused();

  await page.keyboard.press("ArrowLeft"); // May
  await page.keyboard.press("ArrowUp"); // February
  await page.keyboard.press("PageUp"); // February 2025
  await expect(panel.getByRole("link", { name: "Tháng 2/2025" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();

  await page.keyboard.press("Enter");
  await page.keyboard.press("PageUp");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/?month=2025-06");
});

test("the open month picker fits a 360px screen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await registerAndSignIn(page);
  await page.goto("/?month=2026-06");
  await page.getByRole("button", { name: "Tháng 6/2026. Chọn tháng khác" }).click();

  const box = await page.getByRole("dialog", { name: "Chọn tháng" }).boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(360);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test("an invalid month shows a message", async ({ page }) => {
  await registerAndSignIn(page);
  await page.goto("/?month=2026-13");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Tháng không hợp lệ.");
});
