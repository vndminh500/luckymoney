import { expect, test, type Page } from "./fixtures";

const PASSWORD = "mat-khau-e2e-123";

async function registerAndSignIn(page: Page): Promise<void> {
  await page.goto("/register");
  await page
    .getByLabel("Email")
    .fill(`e2e-list-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await expect(page).toHaveURL("/");
}

async function addExpense(page: Page, amount: string, date: string, note: string): Promise<void> {
  await page.goto("/transactions/new");
  await page.getByLabel("Số tiền").fill(amount);
  await page.getByLabel("Danh mục").selectOption({ label: "🍜 Ăn uống" });
  await page.getByLabel("Ngày").fill(date);
  await page.getByLabel("Ghi chú (không bắt buộc)").fill(note);
  await page.getByRole("button", { name: "Lưu giao dịch" }).click();
  await expect(page.getByRole("status")).toContainText("Đã lưu giao dịch.");
}

test("a new transaction shows up in the list of its month only", async ({ page }) => {
  await registerAndSignIn(page);
  await addExpense(page, "45k", "2026-10-15", "Bún chả");

  await page.getByRole("link", { name: "Xem danh sách" }).click();
  await expect(page).toHaveURL("/transactions?month=2026-10");
  await expect(page.getByRole("heading", { name: "Tháng 10/2026" })).toBeVisible();
  const list = page.getByRole("list", { name: "Giao dịch" });
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expect(list).toContainText("Ăn uống");
  await expect(list).toContainText("Bún chả");
  await expect(list).toContainText("15/10/2026");
  await expect(list).toContainText("−45.000");

  await page.getByRole("link", { name: "Tháng sau" }).click();
  await expect(page.getByRole("heading", { name: "Tháng 11/2026" })).toBeVisible();
  await expect(page.getByText("Không có giao dịch nào trong tháng 11/2026.")).toBeVisible();
});

test("filters by type and paginates through the API", async ({ page }) => {
  await registerAndSignIn(page);
  await addExpense(page, "10k", "2026-09-01", "A");
  await addExpense(page, "20k", "2026-09-02", "B");
  await addExpense(page, "30k", "2026-09-03", "C");

  const response = await page.request.get("/api/transactions?month=2026-09&pageSize=2&page=2");
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body).toMatchObject({ month: "2026-09", page: 2, pageSize: 2, total: 3 });
  expect(body.items).toHaveLength(1);
  expect(body.items[0]).toMatchObject({ amount: 10_000, note: "A" });
  expect(body.items[0]).not.toHaveProperty("userId");

  await page.goto("/transactions?month=2026-09");
  await page.getByLabel("Loại").selectOption("INCOME");
  await page.getByRole("button", { name: "Lọc" }).click();
  await expect(page).toHaveURL(/type=INCOME/);
  await expect(page.getByText("Không có giao dịch nào trong tháng 9/2026.")).toBeVisible();
});

test("an invalid query returns 400 from the API and a message on the page", async ({ page }) => {
  await registerAndSignIn(page);

  const response = await page.request.get("/api/transactions?month=2026-13");
  expect(response.status()).toBe(400);
  expect((await response.json()).error).toBe("VALIDATION_ERROR");

  await page.goto("/transactions?month=2026-13");
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Bộ lọc không hợp lệ.");
});
