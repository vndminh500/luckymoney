import { expect, test, type Page } from "./fixtures";

const PASSWORD = "mat-khau-e2e-123";

async function registerAndSignIn(page: Page): Promise<void> {
  await page.goto("/register");
  await page
    .getByLabel("Email")
    .fill(`e2e-budget-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await expect(page).toHaveURL("/");
}

async function foodCategoryId(page: Page): Promise<string> {
  const categories: { id: string; name: string; type: string }[] = await (
    await page.request.get("/api/categories")
  ).json();
  const food = categories.find((c) => c.name === "Ăn uống" && c.type === "EXPENSE");
  if (!food) throw new Error("missing default category");
  return food.id;
}

async function spend(page: Page, categoryId: string, amount: number): Promise<void> {
  const response = await page.request.post("/api/transactions", {
    data: { type: "EXPENSE", amount, categoryId, occurredAt: "2026-06-10T05:00:00Z" },
  });
  expect(response.status()).toBe(201);
}

async function setBudget(page: Page, amount: string): Promise<void> {
  const form = page.getByRole("form", { name: "Đặt ngân sách" });
  await form.getByLabel("Danh mục chi").selectOption({ label: "🍜 Ăn uống" });
  await form.getByLabel("Hạn mức").fill(amount);
  await form.getByRole("button", { name: "Lưu ngân sách" }).click();
}

test("budget warnings appear at 80% and 100%", async ({ page }) => {
  await registerAndSignIn(page);
  const food = await foodCategoryId(page);

  await page.getByRole("link", { name: "Ngân sách" }).click();
  await page.goto("/budgets?month=2026-06");
  await expect(page.getByText("Chưa có ngân sách cho tháng này.", { exact: false })).toBeVisible();

  await setBudget(page, "100k");
  const card = page.getByRole("list", { name: "Ngân sách" }).getByRole("listitem");
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("Đã dùng 0%");
  await expect(card).toContainText(/Còn 100\.000\s₫/);

  // 79,999 of 100,000: shown as 79.9%, no warning yet.
  await spend(page, food, 79_999);
  await page.reload();
  await expect(card).toContainText("Đã dùng 79,9%");
  await expect(card).not.toContainText("Sắp chạm hạn mức");

  // 80,000: warning.
  await spend(page, food, 1);
  await page.reload();
  await expect(card).toContainText("Đã dùng 80%");
  await expect(card).toContainText("Sắp chạm hạn mức");
  await expect(card.getByRole("meter")).toHaveAttribute("aria-valuenow", "80");

  // 105,000: over.
  await spend(page, food, 25_000);
  await page.reload();
  await expect(card).toContainText("Đã dùng 105%");
  await expect(card).toContainText("Vượt hạn mức");
  await expect(card).toContainText(/Đã vượt 5\.000\s₫/);
  await expect(card.getByRole("meter")).toHaveAttribute("aria-valuenow", "100");

  const api = await (await page.request.get("/api/budgets?month=2026-06")).json();
  expect(api).toEqual([
    expect.objectContaining({ spent: 105_000, amount: 100_000, percentUsed: 105, status: "over" }),
  ]);
});

test("change the limit, then delete the budget", async ({ page }) => {
  await registerAndSignIn(page);
  const food = await foodCategoryId(page);
  await spend(page, food, 105_000);

  await page.goto("/budgets?month=2026-06");
  await setBudget(page, "100k");
  const card = page.getByRole("list", { name: "Ngân sách" }).getByRole("listitem");
  await expect(card).toContainText("Vượt hạn mức");

  // Same category again updates the limit instead of adding a second budget.
  await setBudget(page, "200k");
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("Đã dùng 52,5%");
  await expect(card).toContainText(/Còn 95\.000\s₫/);

  await card.getByRole("button", { name: "Xóa ngân sách Ăn uống" }).click();
  await expect(page.getByText("Chưa có ngân sách cho tháng này.", { exact: false })).toBeVisible();
});

test("an invalid limit shows a field error", async ({ page }) => {
  await registerAndSignIn(page);
  await page.goto("/budgets?month=2026-06");
  await setBudget(page, "abc");
  await expect(page.getByText(/Hạn mức không hợp lệ/)).toBeVisible();
  await expect(page.getByLabel("Hạn mức")).toHaveAttribute("aria-invalid", "true");
});
