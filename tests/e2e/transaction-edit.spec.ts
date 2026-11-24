import { expect, test, type Browser, type Page } from "@playwright/test";

const PASSWORD = "mat-khau-e2e-123";

async function newSignedInPage(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/register");
  await page
    .getByLabel("Email")
    .fill(`e2e-edit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`);
  await page.getByLabel("Mật khẩu").fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await expect(page).toHaveURL("/");
  return page;
}

/** Adds an expense on 2026-08-20 through the API and returns its id. */
async function addExpense(page: Page, amount: number, note: string): Promise<string> {
  await page.goto("/transactions/new");
  const categoryId = await page
    .getByLabel("Danh mục")
    .locator("option", { hasText: "Ăn uống" })
    .getAttribute("value");
  const response = await page.request.post("/api/transactions", {
    data: { type: "EXPENSE", amount, categoryId, occurredAt: "2026-08-20T05:00:00Z", note },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).id;
}

/**
 * The edit page streams behind Suspense, so Next.js keeps status 200 and renders
 * the not-found UI with a noindex tag (see Next.js notFound() docs). The API
 * routes return a real 404.
 */
async function expectNotFoundPage(page: Page, id: string): Promise<void> {
  await page.goto(`/transactions/${id}/edit`);
  await expect(page.getByRole("heading", { name: "Không tìm thấy" })).toBeVisible();
  await expect(page.getByLabel("Số tiền")).toHaveCount(0);
  await expect(page.locator('head meta[name="robots"]').first()).toHaveAttribute(
    "content",
    /noindex/,
  );
}

test("edit a transaction from the list", async ({ browser }) => {
  const page = await newSignedInPage(browser);
  await addExpense(page, 40_000, "Cà phê");

  await page.goto("/transactions?month=2026-08");
  await page.getByRole("link", { name: /Cà phê/ }).click();
  await expect(page.getByRole("heading", { name: "Sửa giao dịch" })).toBeVisible();
  await expect(page.getByLabel("Số tiền")).toHaveValue("40000");
  await expect(page.getByLabel("Ngày")).toHaveValue("2026-08-20");

  await page.getByLabel("Số tiền").fill("55k");
  await page.getByLabel("Ghi chú (không bắt buộc)").fill("Cà phê sữa");
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();

  await expect(page).toHaveURL("/transactions?month=2026-08");
  const list = page.getByRole("list", { name: "Giao dịch" });
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expect(list).toContainText("Cà phê sữa");
  await expect(list).toContainText("−55.000");
});

test("an invalid edit keeps the form with an error", async ({ browser }) => {
  const page = await newSignedInPage(browser);
  const id = await addExpense(page, 40_000, "Cà phê");

  await page.goto(`/transactions/${id}/edit`);
  await page.getByLabel("Số tiền").fill("0");
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();

  await expect(page.getByText("Số tiền phải lớn hơn 0.")).toBeVisible();
  await expect(page).toHaveURL(`/transactions/${id}/edit`);
});

test("delete a transaction: it leaves the list", async ({ browser }) => {
  const page = await newSignedInPage(browser);
  const id = await addExpense(page, 40_000, "Cà phê");
  await addExpense(page, 30_000, "Bánh mì");

  await page.goto(`/transactions/${id}/edit`);
  await page.getByRole("button", { name: "Xóa giao dịch" }).click();

  await expect(page).toHaveURL("/transactions?month=2026-08");
  const list = page.getByRole("list", { name: "Giao dịch" });
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expect(list).toContainText("Bánh mì");
  await expect(list).not.toContainText("Cà phê");

  // Gone from the API too, and its edit page shows "not found".
  expect((await page.request.get(`/api/transactions/${id}`)).status()).toBe(404);
  await expectNotFoundPage(page, id);
});

test("another user can neither see, change nor delete the transaction", async ({ browser }) => {
  const alice = await newSignedInPage(browser);
  const id = await addExpense(alice, 40_000, "Của Alice");
  const bob = await newSignedInPage(browser);

  expect((await bob.request.get(`/api/transactions/${id}`)).status()).toBe(404);
  expect(
    (await bob.request.patch(`/api/transactions/${id}`, { data: { amount: 1 } })).status(),
  ).toBe(404);
  expect((await bob.request.delete(`/api/transactions/${id}`)).status()).toBe(404);
  await expectNotFoundPage(bob, id);

  const own = await alice.request.get(`/api/transactions/${id}`);
  expect(own.status()).toBe(200);
  expect(await own.json()).toMatchObject({ amount: 40_000, note: "Của Alice" });
});

test("PATCH and DELETE through the API", async ({ browser }) => {
  const page = await newSignedInPage(browser);
  const id = await addExpense(page, 40_000, "Cà phê");

  const patched = await page.request.patch(`/api/transactions/${id}`, {
    data: { amount: 45_000 },
  });
  expect(patched.status()).toBe(200);
  expect(await patched.json()).toMatchObject({ id, amount: 45_000, note: "Cà phê" });

  const invalid = await page.request.patch(`/api/transactions/${id}`, { data: { amount: -1 } });
  expect(invalid.status()).toBe(400);

  expect((await page.request.delete(`/api/transactions/${id}`)).status()).toBe(204);
  expect((await page.request.delete(`/api/transactions/${id}`)).status()).toBe(404);
});
