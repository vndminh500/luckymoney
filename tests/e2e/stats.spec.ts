import { expect, test, type Page } from "@playwright/test";

async function registerAndSignIn(page: Page): Promise<void> {
  await page.goto("/register");
  await page
    .getByLabel("Email")
    .fill(`e2e-stats-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`);
  await page.getByLabel("Mật khẩu", { exact: true }).fill("mat-khau-e2e-123");
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await expect(page).toHaveURL("/");
}

/** Seeds a few transactions in 2026 through the API (Asia/Ho_Chi_Minh). */
async function seed(page: Page): Promise<void> {
  const categories: { id: string; name: string; type: string }[] = await (
    await page.request.get("/api/categories")
  ).json();
  const id = (name: string, type: string) =>
    categories.find((c) => c.name === name && c.type === type)?.id;
  const rows = [
    ["EXPENSE", 45_000, "Ăn uống", "2026-11-23T05:00:00Z"], // Mon 23/11
    ["EXPENSE", 30_000, "Đi lại", "2026-11-25T05:00:00Z"], // Wed 25/11
    ["INCOME", 15_000_000, "Lương", "2026-11-27T02:00:00Z"], // Fri 27/11
    ["EXPENSE", 20_000, "Ăn uống", "2026-11-30T05:00:00Z"], // next week
    ["EXPENSE", 100_000, "Mua sắm", "2026-03-10T05:00:00Z"], // March
  ] as const;
  for (const [type, amount, name, occurredAt] of rows) {
    const response = await page.request.post("/api/transactions", {
      data: { type, amount, categoryId: id(name, type), occurredAt },
    });
    expect(response.status()).toBe(201);
  }
}

test("week, month and year statistics with a bar chart", async ({ page }) => {
  await registerAndSignIn(page);
  await seed(page);

  await page
    .getByRole("navigation", { name: "Chính" })
    .getByRole("link", { name: "Thống kê" })
    .click();
  await expect(page).toHaveURL("/stats");

  // Week of 23/11/2026.
  await page.goto("/stats?period=week&date=2026-11-25");
  await expect(page.getByRole("heading", { name: "Tuần 23/11 – 29/11/2026" })).toBeVisible();
  const totals = page.getByRole("region", { name: "Tổng kết kỳ" });
  await expect(totals).toContainText(/Thu\s*\+15\.000\.000\s₫/);
  await expect(totals).toContainText(/Chi\s*−75\.000\s₫/);
  await expect(page.getByRole("img", { name: /Biểu đồ cột chi theo ngày/ })).toBeVisible();

  // Next week.
  await page.getByRole("link", { name: "Tuần sau" }).click();
  await expect(page.getByRole("heading", { name: "Tuần 30/11 – 06/12/2026" })).toBeVisible();
  await expect(totals).toContainText(/Chi\s*−20\.000\s₫/);

  // Month: switching keeps the date.
  await page
    .getByRole("navigation", { name: "Kỳ thống kê" })
    .getByRole("link", { name: "Tháng" })
    .click();
  await expect(page.getByRole("heading", { name: "Tháng 11/2026" })).toBeVisible();
  // The whole of November, including 30/11 from the next week.
  await expect(totals).toContainText(/Chi\s*−95\.000\s₫/);

  // Year: one bucket per month.
  await page
    .getByRole("navigation", { name: "Kỳ thống kê" })
    .getByRole("link", { name: "Năm" })
    .click();
  await expect(page.getByRole("heading", { name: "Năm 2026" })).toBeVisible();
  await expect(totals).toContainText(/Chi\s*−195\.000\s₫/);

  // Switch the series to income; the table lists the months with activity.
  await page.getByRole("button", { name: "Thu", exact: true }).click();
  await expect(page.getByRole("img", { name: /Biểu đồ cột thu theo tháng/ })).toBeVisible();
  await page.getByText("Xem dạng bảng").click();
  const table = page.getByRole("table", { name: "Thu và chi theo kỳ" });
  await expect(table.getByRole("row")).toHaveCount(3); // header + March + November
  await expect(table.getByRole("row", { name: /Tháng 3\/2026/ })).toContainText(/100\.000\s₫/);
  await expect(table.getByRole("row", { name: /Tháng 11\/2026/ })).toContainText(/15\.000\.000\s₫/);
});

test("an invalid period shows a message", async ({ page }) => {
  await registerAndSignIn(page);
  await page.goto("/stats?period=day");
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Kỳ thống kê không hợp lệ.");
});
