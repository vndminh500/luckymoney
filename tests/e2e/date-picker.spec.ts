import { expect, test, type Page } from "./fixtures";

const PASSWORD = "mat-khau-e2e-123";

async function registerAndSignIn(page: Page): Promise<void> {
  await page.goto("/register");
  await page
    .getByLabel("Email")
    .fill(`e2e-date-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await expect(page).toHaveURL("/");
}

const dmy = (key: string) => key.split("-").reverse().join("/");

/** Today and yesterday as the app computes them (Vietnam time). */
function vietnamDays(): { today: string; yesterday: string } {
  const now = Date.now() + 7 * 3_600_000;
  const key = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  return { today: key(now), yesterday: key(now - 86_400_000) };
}

test("pick a transaction date with the mouse, the keyboard and the shortcuts", async ({ page }) => {
  await registerAndSignIn(page);
  await page.goto("/transactions/new");
  const { today, yesterday } = vietnamDays();
  const field = page.getByLabel("Ngày", { exact: true });
  await expect(field).toHaveValue(dmy(today));

  // Mouse: open, the 15th of the shown month.
  const openButton = page.getByRole("button", { name: "Mở lịch" });
  await openButton.click();
  const calendar = page.getByRole("dialog", { name: "Chọn ngày" });
  await expect(calendar).toBeVisible();
  // It opens on the chosen day, which has focus and is marked as today.
  const todayCell = calendar.getByRole("button", { pressed: true });
  await expect(todayCell).toBeFocused();
  await expect(todayCell).toHaveAttribute("aria-current", "date");
  const month = today.slice(0, 7);
  await calendar
    .getByRole("button", { name: new RegExp(`, 15 tháng ${Number(month.slice(5))} năm`) })
    .click();
  await expect(calendar).toBeHidden();
  await expect(field).toHaveValue(dmy(`${month}-15`));
  await expect(openButton).toBeFocused();

  // Keyboard: open with Enter, one day right, one week down, pick with Enter.
  await page.keyboard.press("Enter");
  await expect(calendar.getByRole("button", { pressed: true })).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(field).toHaveValue(dmy(`${month}-23`));

  // Escape closes without changing anything.
  await openButton.click();
  await page.keyboard.press("PageDown");
  await page.keyboard.press("Escape");
  await expect(calendar).toBeHidden();
  await expect(field).toHaveValue(dmy(`${month}-23`));

  // Shortcut for things that just happened.
  await openButton.click();
  await calendar.getByRole("button", { name: "Hôm qua" }).click();
  await expect(field).toHaveValue(dmy(yesterday));

  // Typing works too, and nonsense is called out.
  await field.fill("31/02/2026");
  await expect(page.getByText("Ngày không hợp lệ, ví dụ: 24/11/2026.")).toBeVisible();
  await field.fill("05082026");
  await field.blur();
  await expect(field).toHaveValue("05/08/2026");
  await expect(page.getByText("Ngày không hợp lệ")).toHaveCount(0);

  // The picked day is what gets saved.
  await page.getByLabel("Số tiền").fill("45k");
  await page.getByLabel("Danh mục").selectOption({ label: "🍜 Ăn uống" });
  await page.getByRole("button", { name: "Lưu giao dịch" }).click();
  // The new-transaction page stays open for the next one and links to that month.
  await expect(page.getByRole("status")).toContainText("Đã lưu giao dịch.");
  await expect(page.getByRole("link", { name: "Xem danh sách" })).toHaveAttribute(
    "href",
    "/transactions?month=2026-08",
  );
});

test("a birth date far in the past is quick to reach through the year view", async ({ page }) => {
  await registerAndSignIn(page);
  await page.goto("/account");
  const field = page.getByLabel("Ngày sinh");
  await expect(field).toHaveValue("");
  await page.getByRole("button", { name: "Mở lịch" }).click();
  const calendar = page.getByRole("dialog", { name: "Chọn ngày sinh" });

  // Title -> months -> years; the future cannot be picked.
  await calendar.getByRole("button", { name: /Chọn tháng khác$/ }).click();
  await calendar.getByRole("button", { name: /Chọn năm khác$/ }).click();
  await expect(calendar.getByRole("button", { name: "2040" })).toHaveCount(0);
  // From the block of 12 years holding this year back to 1992–2003.
  const blocks = Math.floor(Number(vietnamDays().today.slice(0, 4)) / 12) - Math.floor(1995 / 12);
  for (let i = 0; i < blocks; i++) {
    await calendar.getByRole("button", { name: "12 năm trước" }).click();
  }
  await calendar.getByRole("button", { name: "1995", exact: true }).click();
  await calendar.getByRole("button", { name: "Tháng 4", exact: true }).click();
  await calendar.getByRole("button", { name: "Chủ Nhật, 30 tháng 4 năm 1995" }).click();
  await expect(field).toHaveValue("30/04/1995");

  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  // Wait for the save itself before reloading.
  await expect(
    page.getByRole("status").filter({ hasText: "Đã lưu thông tin cá nhân." }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Ngày sinh")).toHaveValue("30/04/1995");
});
