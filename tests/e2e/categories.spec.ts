import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "mat-khau-e2e-123";

async function registerAndSignIn(page: Page): Promise<void> {
  await page.goto("/register");
  await page
    .getByLabel("Email")
    .fill(`e2e-cat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await expect(page).toHaveURL("/");
}

const row = (page: Page, list: string, name: string) =>
  page.getByRole("list", { name: list }).getByRole("listitem").filter({ hasText: name });

test("add, rename, archive and restore a category", async ({ page }) => {
  await registerAndSignIn(page);
  await page.getByRole("link", { name: "Danh mục" }).click();
  await expect(page).toHaveURL("/categories");

  // Add, picking the icon from the everyday activities
  const addForm = page.getByRole("form", { name: "Thêm danh mục" });
  await addForm.getByLabel("Tên danh mục").fill("Cà phê");
  const picker = addForm.getByRole("button", { name: /^Biểu tượng:/ });
  await expect(picker).toHaveAccessibleName("Biểu tượng: chưa chọn");
  await picker.click();
  const panel = addForm.getByRole("dialog", { name: "Biểu tượng" });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("group", { name: "Đi lại" })).toBeVisible();
  // Search works without diacritics.
  await panel.getByLabel("Tìm hoạt động").fill("ca phe");
  await expect(panel.getByRole("group")).toHaveCount(1);
  await panel.getByRole("button", { name: "Cà phê" }).click();
  await expect(panel).toBeHidden();
  await expect(picker).toHaveAccessibleName("Biểu tượng: Cà phê");
  await expect(picker).toBeFocused();
  await addForm.getByRole("button", { name: "Thêm danh mục" }).click();
  await expect(row(page, "Danh mục chi", "Cà phê")).toHaveCount(1);
  await expect(row(page, "Danh mục chi", "Cà phê")).toContainText("☕");
  await expect(addForm.getByLabel("Tên danh mục")).toHaveValue("");
  await expect(picker).toHaveAccessibleName("Biểu tượng: chưa chọn");

  // Escape closes the picker without choosing.
  await picker.click();
  await expect(panel).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();

  // Duplicate name of the same type
  await addForm.getByLabel("Tên danh mục").fill("Cà phê");
  await addForm.getByRole("button", { name: "Thêm danh mục" }).click();
  await expect(addForm.getByText(/Đã có danh mục cùng tên/)).toBeVisible();

  // Edit the name and the icon
  const coffee = row(page, "Danh mục chi", "Cà phê");
  await coffee.getByRole("button", { name: "Sửa" }).click();
  await page.getByLabel("Tên mới cho Cà phê").fill("Cà phê sáng");
  await coffee.getByRole("button", { name: "Biểu tượng: Cà phê" }).click();
  await coffee.getByRole("button", { name: "Trà sữa" }).click();
  await coffee.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(row(page, "Danh mục chi", "Cà phê sáng")).toHaveCount(1);
  await expect(row(page, "Danh mục chi", "Cà phê sáng")).toContainText("🧋");

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
