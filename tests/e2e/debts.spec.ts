import { expect, test, type Page } from "./fixtures";

const PASSWORD = "mat-khau-e2e-123";

async function registerAndSignIn(page: Page): Promise<void> {
  await page.goto("/register");
  await page
    .getByLabel("Email")
    .fill(`e2e-debt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await expect(page).toHaveURL("/");
}

test("add a debt with an even schedule, pay part of it, then delete it", async ({ page }) => {
  await registerAndSignIn(page);
  await page.getByRole("link", { name: "Sổ nợ" }).click();
  await expect(page).toHaveURL("/debts");
  await expect(page.getByText("Chưa có khoản nợ nào.")).toBeVisible();

  await page.getByRole("link", { name: "+ Thêm khoản nợ" }).click();
  await expect(page).toHaveURL("/debts/new");
  await page.getByLabel("Người cho vay").fill("Anh Hùng");
  await page.getByLabel("Số tiền nợ").fill("3tr");
  await page.getByLabel("Số kỳ").fill("3");
  await page.getByLabel("Kỳ đầu tiên").fill("2030-01-05");
  await page.getByRole("button", { name: "Chia đều" }).click();

  const schedule = page.getByRole("list", { name: "Các kỳ trả" });
  await expect(schedule.getByRole("listitem")).toHaveCount(3);
  await expect(page.getByLabel("Ngày trả kỳ 3")).toHaveValue("05/03/2030");
  await expect(page.getByText("✓ Khớp số tiền nợ")).toBeVisible();

  // A schedule that no longer adds up is refused with a clear message.
  await page.getByLabel("Số tiền kỳ 3").fill("500000");
  await expect(page.getByText(/Còn thiếu/)).toBeVisible();
  await page.getByRole("button", { name: "Thêm khoản nợ" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Tổng các kỳ trả phải bằng số tiền nợ." }),
  ).toBeVisible();
  // What was typed survives the error.
  await expect(page.getByLabel("Người cho vay")).toHaveValue("Anh Hùng");
  await page.getByLabel("Số tiền kỳ 3").fill("1000000");
  await page.getByRole("button", { name: "Thêm khoản nợ" }).click();

  await expect(page).toHaveURL(/\/debts\/[^/]+$/);
  await expect(page.getByRole("heading", { name: "Anh Hùng" })).toBeVisible();
  const installments = page.getByRole("list", { name: "Lịch trả" }).getByRole("listitem");
  await expect(installments).toHaveCount(3);
  await expect(installments.first()).toContainText("Sắp tới");

  // Pay 1.5tr: the first installment is paid, the second half paid.
  const payForm = page.getByRole("form", { name: "Ghi lần trả" });
  await expect(payForm.getByLabel("Số tiền")).toHaveValue("1000000");
  await payForm.getByLabel("Số tiền").fill("1.5tr");
  await payForm.getByRole("button", { name: "Ghi lần trả" }).click();
  await expect(installments.nth(0)).toContainText("Đã trả");
  await expect(installments.nth(1)).toContainText("Trả một phần");
  await expect(
    page.getByRole("list", { name: "Các lần đã trả" }).getByRole("listitem"),
  ).toHaveCount(1);

  await page.getByRole("link", { name: "‹ Sổ nợ" }).click();
  await expect(page.getByRole("definition").first()).toContainText("1.500.000");
  const card = page.getByRole("list", { name: "Khoản nợ" }).getByRole("listitem");
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("Anh Hùng");
  await card.getByRole("link").click();

  await page.getByRole("button", { name: "Xóa" }).click();
  const dialog = page.getByRole("dialog", { name: "Xóa khoản nợ với Anh Hùng?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Xóa khoản nợ" }).click();
  await expect(page).toHaveURL("/debts");
  await expect(page.getByText("Chưa có khoản nợ nào.")).toBeVisible();
});

test("an overdue installment shows on the list and the debt page", async ({ page }) => {
  await registerAndSignIn(page);
  const created = await page.request.post("/api/debts", {
    data: {
      direction: "THEY_OWE",
      counterparty: "Lan",
      principal: 500_000,
      startDate: "2026-01-01",
      installments: [{ dueDate: "2026-02-01", amount: 500_000 }],
    },
  });
  expect(created.status()).toBe(201);

  await page.goto("/debts");
  const card = page.getByRole("list", { name: "Khoản nợ" }).getByRole("listitem");
  await expect(card).toContainText("Quá hạn");
  await expect(card).toContainText("Nợ tôi");
  await card.getByRole("link").click();
  await expect(page.getByRole("form", { name: "Ghi lần thu" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Lịch trả" })).toContainText("Quá hạn");
});

test("settle a debt with several installments after confirming, then undo it", async ({ page }) => {
  await registerAndSignIn(page);
  const created = await page.request.post("/api/debts", {
    data: {
      direction: "I_OWE",
      counterparty: "Ngân hàng",
      principal: 3_000_000,
      startDate: "2026-01-01",
      installments: [
        { dueDate: "2030-01-05", amount: 1_000_000 },
        { dueDate: "2030-02-05", amount: 1_000_000 },
        { dueDate: "2030-03-05", amount: 1_000_000 },
      ],
    },
  });
  const { id } = await created.json();
  await page.request.post(`/api/debts/${id}/payments`, {
    data: { amount: 500_000, paidOn: "2026-02-01" },
  });

  await page.goto(`/debts/${id}`);
  const settle = page.getByRole("button", { name: "Đã tất toán" });
  const dialog = page.getByRole("dialog", { name: "Tất toán khoản nợ với Ngân hàng?" });

  // Cancel changes nothing.
  await settle.click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("2.500.000");
  await expect(dialog).toContainText("3 kỳ còn lại");
  await dialog.getByRole("button", { name: "Hủy" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("list", { name: "Lịch trả" })).not.toContainText("Đã trả");

  // Confirm: everything paid, the debt is done, the button is gone.
  await settle.click();
  await dialog.getByRole("button", { name: "Xác nhận tất toán" }).click();
  await expect(dialog).toBeHidden();
  const installments = page.getByRole("list", { name: "Lịch trả" }).getByRole("listitem");
  await expect(installments.filter({ hasText: "Đã trả" })).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "Đã trả xong" })).toBeVisible();
  await expect(settle).toHaveCount(0);
  const payments = page.getByRole("list", { name: "Các lần đã trả" }).getByRole("listitem");
  await expect(payments.first()).toContainText("2.500.000");
  await expect(payments.first()).toContainText("Tất toán");

  // A mistake can be undone like any payment.
  await payments
    .first()
    .getByRole("button", { name: /^Hoàn tác/ })
    .click();
  await expect(settle).toBeVisible();

  // A single-installment debt has no settle button.
  const single = await page.request.post("/api/debts", {
    data: {
      direction: "THEY_OWE",
      counterparty: "Lan",
      principal: 100_000,
      startDate: "2026-01-01",
      installments: [{ dueDate: "2030-01-01", amount: 100_000 }],
    },
  });
  await page.goto(`/debts/${(await single.json()).id}`);
  await expect(page.getByRole("heading", { name: "Lan" })).toBeVisible();
  await expect(settle).toHaveCount(0);
});
