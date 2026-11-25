import { expect, test, type Page } from "./fixtures";

const PASSWORD = "mat-khau-e2e-123";

async function registerAndSignIn(page: Page): Promise<void> {
  await page.goto("/register");
  await page
    .getByLabel("Email")
    .fill(`e2e-save-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await expect(page).toHaveURL("/");
}

test("create a jar, deposit, withdraw, undo, rename and delete it", async ({ page }) => {
  await registerAndSignIn(page);
  await page.getByRole("link", { name: "Tích góp" }).click();
  await expect(page).toHaveURL("/savings");
  await expect(page.getByText("Chưa có hũ nào.")).toBeVisible();

  // Create, with a message either way.
  const addForm = page.getByRole("form", { name: "Tạo hũ mới" });
  await addForm.getByRole("button", { name: "Tạo hũ" }).click();
  await expect(addForm.getByRole("alert")).toContainText("Chưa tạo được hũ.");
  await addForm.getByLabel("Tên hũ").fill("Quỹ khẩn cấp");
  await addForm.getByRole("button", { name: "Tạo hũ" }).click();
  await expect(addForm.getByRole("status")).toHaveText("Đã tạo hũ “Quỹ khẩn cấp”.");
  const jars = page.getByRole("list", { name: "Các hũ" }).getByRole("listitem");
  await expect(jars).toHaveCount(1);
  await jars.first().getByRole("link").click();
  await expect(page.getByRole("heading", { name: "Quỹ khẩn cấp" })).toBeVisible();

  // An empty jar cannot be withdrawn from.
  const entryForm = page.getByRole("form", { name: "Nạp hoặc rút" });
  await expect(entryForm.getByRole("radio", { name: "− Rút tiền" })).toBeDisabled();

  // Deposit 2tr, then withdraw 500k.
  await entryForm.getByLabel("Số tiền").fill("2tr");
  await entryForm.getByLabel("Ghi chú").fill("Lương");
  await entryForm.getByRole("button", { name: "Nạp vào hũ" }).click();
  await expect(entryForm.getByRole("status")).toHaveText("Đã nạp 2.000.000 ₫ vào hũ.");
  await expect(page.getByText("Hũ đang trống")).toHaveCount(0);

  await entryForm.getByText("Rút tiền").click();
  await entryForm.getByLabel("Số tiền").fill("3tr");
  await entryForm.getByRole("button", { name: "Rút khỏi hũ" }).click();
  await expect(entryForm.getByText("Số tiền rút lớn hơn số dư của hũ.")).toBeVisible();
  await entryForm.getByLabel("Số tiền").fill("500k");
  await entryForm.getByRole("button", { name: "Rút khỏi hũ" }).click();
  await expect(entryForm.getByRole("status")).toHaveText("Đã rút 500.000 ₫ khỏi hũ.");

  const history = page.getByRole("list", { name: "Lịch sử nạp rút" }).getByRole("listitem");
  await expect(history).toHaveCount(2);
  await expect(history.first()).toContainText("500.000");
  await expect(history.first()).toContainText("Số dư sau: 1.500.000");

  // The deposit cannot be undone while its money is out; the withdrawal can.
  await history
    .nth(1)
    .getByRole("button", { name: /^Hoàn tác lần nạp/ })
    .click();
  await expect(history.nth(1).getByRole("alert")).toContainText("Không hoàn tác được");
  await history
    .first()
    .getByRole("button", { name: /^Hoàn tác lần rút/ })
    .click();
  await expect(history).toHaveCount(1);

  // Rename.
  await page.getByRole("button", { name: "Sửa" }).click();
  const editForm = page.getByRole("form", { name: "Sửa hũ Quỹ khẩn cấp" });
  await editForm.getByLabel("Tên hũ").fill("Quỹ dự phòng");
  await editForm.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(page.getByRole("heading", { name: "Quỹ dự phòng" })).toBeVisible();

  // The list shows the jar and the total.
  await page.getByRole("link", { name: "‹ Tích góp" }).click();
  await expect(page.getByRole("region", { name: "Tổng tiền tích góp" })).toContainText("2.000.000");
  await jars.first().getByRole("link").click();

  // Delete, after confirming.
  await page.getByRole("button", { name: "Xóa" }).click();
  const dialog = page.getByRole("dialog", { name: "Xóa hũ “Quỹ dự phòng”?" });
  await expect(dialog).toContainText("2.000.000");
  await dialog.getByRole("button", { name: "Xóa hũ" }).click();
  await expect(page).toHaveURL("/savings");
  await expect(page.getByText("Chưa có hũ nào.")).toBeVisible();
});

test("savings never change the income and expense on the overview", async ({ page }) => {
  await registerAndSignIn(page);
  const jar = await (await page.request.post("/api/savings", { data: { name: "Du lịch" } })).json();
  const today = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
  const entry = await page.request.post(`/api/savings/${jar.id}/entries`, {
    data: { kind: "DEPOSIT", amount: 5_000_000, occurredOn: today },
  });
  expect(entry.status()).toBe(201);

  const summary = await (
    await page.request.get(`/api/stats/summary?month=${today.slice(0, 7)}`)
  ).json();
  expect(summary).toMatchObject({ income: 0, expense: 0 });
});
