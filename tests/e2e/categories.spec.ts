import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "mat-khau-e2e-123";

async function registerAndSignIn(page: Page): Promise<void> {
  await page.goto("/register");
  await page
    .getByLabel("Email")
    .fill(`e2e-cat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`);
  await page.getByLabel("Mật khẩu").fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await expect(page).toHaveURL("/");
}

const row = (page: Page, list: string, name: string) =>
  page.getByRole("list", { name: list }).getByRole("listitem").filter({ hasText: name });

test("add, rename, archive and restore a category", async ({ page }) => {
  await registerAndSignIn(page);
  await page.getByRole("link", { name: "Danh mục" }).click();
  await expect(page).toHaveURL("/categories");

  // Add
  const addForm = page.getByRole("form", { name: "Thêm danh mục" });
  await addForm.getByLabel("Tên danh mục").fill("Cà phê");
  await addForm.getByLabel("Biểu tượng").fill("☕");
  await addForm.getByRole("button", { name: "Thêm danh mục" }).click();
  await expect(row(page, "Danh mục chi", "Cà phê")).toHaveCount(1);
  await expect(addForm.getByLabel("Tên danh mục")).toHaveValue("");

  // Duplicate name of the same type
  await addForm.getByLabel("Tên danh mục").fill("Cà phê");
  await addForm.getByRole("button", { name: "Thêm danh mục" }).click();
  await expect(addForm.getByText(/Đã có danh mục cùng tên/)).toBeVisible();

  // Rename
  await row(page, "Danh mục chi", "Cà phê").getByRole("button", { name: "Đổi tên" }).click();
  await page.getByLabel("Tên mới cho Cà phê").fill("Cà phê sáng");
  await page.getByRole("button", { name: "Lưu tên" }).click();
  await expect(row(page, "Danh mục chi", "Cà phê sáng")).toHaveCount(1);

  // Archive: moves to the archived list
  await row(page, "Danh mục chi", "Cà phê sáng").getByRole("button", { name: "Lưu trữ" }).click();
  await expect(row(page, "Danh mục đã lưu trữ", "Cà phê sáng")).toHaveCount(1);
  await expect(row(page, "Danh mục chi", "Cà phê sáng")).toHaveCount(0);

  // Restore
  await row(page, "Danh mục đã lưu trữ", "Cà phê sáng")
    .getByRole("button", { name: "Khôi phục" })
    .click();
  await expect(row(page, "Danh mục chi", "Cà phê sáng")).toHaveCount(1);
});

test("an archived category is not offered for new transactions but stays on old ones", async ({
  page,
}) => {
  await registerAndSignIn(page);

  // An old transaction in "Ăn uống"
  await page.goto("/transactions/new");
  await page.getByLabel("Số tiền").fill("45k");
  await page.getByLabel("Danh mục").selectOption({ label: "🍜 Ăn uống" });
  await page.getByLabel("Ngày").fill("2026-07-10");
  await page.getByRole("button", { name: "Lưu giao dịch" }).click();
  await expect(page.getByRole("status")).toContainText("Đã lưu giao dịch.");

  await page.goto("/categories");
  await row(page, "Danh mục chi", "Ăn uống").getByRole("button", { name: "Lưu trữ" }).click();
  await expect(row(page, "Danh mục đã lưu trữ", "Ăn uống")).toHaveCount(1);

  await page.goto("/transactions/new");
  await expect(page.getByLabel("Danh mục").locator("option", { hasText: "Ăn uống" })).toHaveCount(
    0,
  );

  await page.goto("/transactions?month=2026-07");
  const list = page.getByRole("list", { name: "Giao dịch" });
  await expect(list).toContainText("Ăn uống");
  await expect(list).toContainText("(đã lưu trữ)");
});

test("category API: list, create, conflict, update, archive", async ({ page }) => {
  await registerAndSignIn(page);

  const created = await page.request.post("/api/categories", {
    data: { name: "Thú cưng", type: "EXPENSE", icon: "🐶" },
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json();

  const duplicate = await page.request.post("/api/categories", {
    data: { name: "Thú cưng", type: "EXPENSE" },
  });
  expect(duplicate.status()).toBe(409);

  const renamed = await page.request.patch(`/api/categories/${id}`, { data: { name: "Mèo" } });
  expect(await renamed.json()).toMatchObject({ id, name: "Mèo", icon: "🐶" });

  expect((await page.request.post(`/api/categories/${id}/archive`)).status()).toBe(200);
  const active = await (await page.request.get("/api/categories")).json();
  const all = await (await page.request.get("/api/categories?includeArchived=true")).json();
  expect(active.map((c: { id: string }) => c.id)).not.toContain(id);
  expect(all.find((c: { id: string }) => c.id === id)).toMatchObject({ archived: true });

  const restored = await page.request.post(`/api/categories/${id}/restore`);
  expect(await restored.json()).toMatchObject({ archived: false });
});
