import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "mat-khau-e2e-123";

function uniqueEmail(): string {
  return `e2e-tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function registerAndSignIn(page: Page): Promise<void> {
  await page.goto("/register");
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Mật khẩu").fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await expect(page).toHaveURL("/");
}

test("add an expense from the form", async ({ page }) => {
  await registerAndSignIn(page);
  await page.getByRole("link", { name: "Thêm giao dịch" }).click();
  await expect(page).toHaveURL("/transactions/new");

  await page.getByLabel("Số tiền").fill("50k");
  await page.getByLabel("Danh mục").selectOption({ label: "🍜 Ăn uống" });
  await page.getByLabel("Ghi chú (không bắt buộc)").fill("Phở");
  await page.getByRole("button", { name: "Lưu giao dịch" }).click();

  await expect(page.getByRole("status")).toContainText("Đã lưu giao dịch.");
  // The form resets for the next entry.
  await expect(page.getByLabel("Số tiền")).toHaveValue("");
  await expect(page.getByLabel("Ghi chú (không bắt buộc)")).toHaveValue("");
});

test("income shows only income categories", async ({ page }) => {
  await registerAndSignIn(page);
  await page.goto("/transactions/new");

  await page.getByText("Thu", { exact: true }).click();
  const options = page.getByLabel("Danh mục").locator("option:not([disabled])");
  // Only the filtering by type matters here, not the order.
  await expect(options).toHaveCount(3);
  for (const name of ["Lương", "Thưởng", "Khác"]) {
    await expect(options.filter({ hasText: name })).toHaveCount(1);
  }
});

test("invalid amount shows a field error and keeps the input", async ({ page }) => {
  await registerAndSignIn(page);
  await page.goto("/transactions/new");

  await page.getByLabel("Số tiền").fill("0");
  await page.getByLabel("Danh mục").selectOption({ label: "🍜 Ăn uống" });
  await page.getByRole("button", { name: "Lưu giao dịch" }).click();

  await expect(page.getByText("Số tiền phải lớn hơn 0.")).toBeVisible();
  await expect(page.getByLabel("Số tiền")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Số tiền")).toHaveValue("0");
});

test.describe("POST /api/transactions", () => {
  test("creates a transaction for the session user", async ({ page }) => {
    await registerAndSignIn(page);
    await page.goto("/transactions/new");
    const categoryId = await page
      .getByLabel("Danh mục")
      .locator("option", { hasText: "Ăn uống" })
      .getAttribute("value");

    const response = await page.request.post("/api/transactions", {
      data: {
        type: "EXPENSE",
        amount: 35_000,
        categoryId,
        occurredAt: "2026-11-24T05:00:00.000Z",
        userId: "someone-else",
      },
    });

    expect(response.status()).toBe(201);
    expect(await response.json()).toMatchObject({
      type: "EXPENSE",
      amount: 35_000,
      categoryId,
      occurredAt: "2026-11-24T05:00:00.000Z",
      note: null,
    });
  });

  test("returns 400 VALIDATION_ERROR for amount <= 0", async ({ page }) => {
    await registerAndSignIn(page);

    const response = await page.request.post("/api/transactions", {
      data: { type: "EXPENSE", amount: 0, categoryId: "x", occurredAt: "2026-11-24T05:00:00Z" },
    });

    expect(response.status()).toBe(400);
    expect(await response.json()).toMatchObject({
      error: "VALIDATION_ERROR",
      details: [{ field: "amount", message: expect.any(String) }],
    });
  });

  test("returns 401 when signed out", async ({ request }) => {
    const response = await request.post("/api/transactions", { data: {} });
    expect(response.status()).toBe(401);
  });
});
