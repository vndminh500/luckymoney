import { expect, test, type Page } from "@playwright/test";

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

test("an invalid month shows a message", async ({ page }) => {
  await registerAndSignIn(page);
  await page.goto("/?month=2026-13");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Tháng không hợp lệ.");
});
