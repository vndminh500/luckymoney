import { expect, test, type Page } from "./fixtures";

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

test("add, edit and delete a category", async ({ page }) => {
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
  // A success message says what was added, and where.
  await expect(addForm.getByRole("status")).toHaveText("Đã thêm danh mục “Cà phê” vào mục Chi.");
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
  // A failure says so at the top of the form; the old success message is gone.
  await expect(addForm.getByRole("alert")).toHaveText(
    "Chưa thêm được danh mục. Xem lỗi ở ô được đánh dấu bên dưới.",
  );
  await expect(addForm.getByRole("status")).toHaveCount(0);
  // An empty name is a failure too.
  await addForm.getByLabel("Tên danh mục").fill("");
  await addForm.getByRole("button", { name: "Thêm danh mục" }).click();
  await expect(addForm.getByRole("alert")).toContainText("Chưa thêm được danh mục.");

  // Edit the name and the icon
  const coffee = row(page, "Danh mục chi", "Cà phê");
  await coffee.getByRole("button", { name: "Sửa" }).click();
  await page.getByLabel("Tên mới cho Cà phê").fill("Cà phê sáng");
  await coffee.getByRole("button", { name: "Biểu tượng: Cà phê" }).click();
  await coffee.getByRole("button", { name: "Trà sữa" }).click();
  await coffee.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(row(page, "Danh mục chi", "Cà phê sáng")).toHaveCount(1);
  await expect(row(page, "Danh mục chi", "Cà phê sáng")).toContainText("🧋");

  // Delete: a confirmation dialog first; Cancel keeps the category.
  const morning = row(page, "Danh mục chi", "Cà phê sáng");
  await expect(morning).toContainText("Chưa có giao dịch");
  await morning.getByRole("button", { name: "Xóa" }).click();
  const dialog = page.getByRole("dialog", { name: "Xóa danh mục?" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Cà phê sáng");
  await dialog.getByRole("button", { name: "Hủy" }).click();
  await expect(dialog).toBeHidden();
  await expect(morning).toHaveCount(1);

  await morning.getByRole("button", { name: "Xóa" }).click();
  await dialog.getByRole("button", { name: "Xóa danh mục" }).click();
  await expect(morning).toHaveCount(0);
});

test("a category with transactions cannot be deleted; the dialog says why", async ({ page }) => {
  await registerAndSignIn(page);
  await page.goto("/transactions/new");
  await page.getByLabel("Số tiền").fill("45k");
  await page.getByLabel("Danh mục").selectOption({ label: "🍜 Ăn uống" });
  await page.getByRole("button", { name: "Lưu giao dịch" }).click();
  await expect(page.getByRole("status")).toContainText("Đã lưu giao dịch.");

  await page.goto("/categories");
  const food = row(page, "Danh mục chi", "Ăn uống");
  await expect(food).toContainText("1 giao dịch");
  await food.getByRole("button", { name: "Xóa" }).click();
  const dialog = page.getByRole("dialog", { name: "Chưa xóa được danh mục" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("còn 1 giao dịch");
  await expect(dialog.getByRole("button", { name: "Xóa danh mục" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(food).toHaveCount(1);
});

test("category API: list, create, conflict, update, delete", async ({ page }) => {
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
  expect(await renamed.json()).toMatchObject({ id, name: "Mèo", icon: "🐶", transactionCount: 0 });

  // A category with a transaction: 409 with the count in the message.
  const spent = await page.request.post("/api/transactions", {
    data: { type: "EXPENSE", amount: 1000, categoryId: id, occurredAt: "2026-11-05T05:00:00Z" },
  });
  const blocked = await page.request.delete(`/api/categories/${id}`);
  expect(blocked.status()).toBe(409);
  expect((await blocked.json()).message).toContain("1 giao dịch");

  // Once its transaction is deleted, the category can go.
  expect((await page.request.delete(`/api/transactions/${(await spent.json()).id}`)).status()).toBe(
    204,
  );
  expect((await page.request.delete(`/api/categories/${id}`)).status()).toBe(204);
  const all = await (await page.request.get("/api/categories")).json();
  expect(all.map((c: { id: string }) => c.id)).not.toContain(id);
});
