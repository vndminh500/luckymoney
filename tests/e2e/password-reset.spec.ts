import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { hashResetCode } from "../../src/server/auth/reset-codes";

const PASSWORD = "mat-khau-e2e-123";
const NEW_PASSWORD = "mat-khau-moi-e2e-456";
const KNOWN_CODE = "246810";

/**
 * The e2e server has no SMTP, so the email with the code is never delivered
 * (the failure is logged and swallowed). The test plants a code it knows into
 * the e2e database instead, in the reset row the app just created.
 */
const db = new PrismaClient({ adapter: new PrismaPg(process.env.E2E_DATABASE_URL ?? "") });

test.afterAll(async () => {
  await db.$disconnect();
});

function uniqueEmail(): string {
  return `e2e-reset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function registerAndSignOut(page: Page): Promise<string> {
  const email = uniqueEmail();
  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await expect(page).toHaveURL("/");
  await page.getByRole("button", { name: "Tài khoản của bạn" }).click();
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL("/login");
  return email;
}

async function plantKnownCode(email: string): Promise<void> {
  const row = await db.passwordReset.findFirstOrThrow({
    where: { user: { email } },
    orderBy: { createdAt: "desc" },
  });
  await db.passwordReset.update({
    where: { id: row.id },
    data: { codeHash: hashResetCode(row.id, KNOWN_CODE) },
  });
}

/** From /login to the code step, with a known code planted. */
async function requestCode(page: Page, email: string): Promise<void> {
  await page.getByRole("link", { name: "Quên mật khẩu?" }).click();
  await expect(page).toHaveURL("/forgot-password");
  await expect(page.getByRole("heading", { name: "Quên mật khẩu" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Gửi mã" }).click();
  await expect(page.getByText("Nếu email đã đăng ký, mã đã được gửi.")).toBeVisible();
  await plantKnownCode(email);
}

async function enterCode(page: Page, code: string): Promise<void> {
  await page.getByLabel("Mã xác nhận").fill(code);
  await page.getByRole("button", { name: "Xác nhận" }).click();
}

test("resets the password with an email code", async ({ page }) => {
  const email = await registerAndSignOut(page);
  await requestCode(page, email);
  await enterCode(page, KNOWN_CODE);

  await expect(page).toHaveURL("/reset-password");
  await page.getByLabel("Mật khẩu mới", { exact: true }).fill(NEW_PASSWORD);
  await page.getByLabel("Nhập lại mật khẩu mới", { exact: true }).fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Đổi mật khẩu" }).click();

  const dialog = page.getByRole("dialog", { name: "Đổi mật khẩu thành công" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("link", { name: "Đăng nhập" }).click();

  await expect(page).toHaveURL("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL("/");
});

test("shows an error for a wrong code", async ({ page }) => {
  const email = await registerAndSignOut(page);
  await requestCode(page, email);
  await enterCode(page, "135799");

  await expect(page.getByText("Mã không đúng hoặc đã hết hạn.")).toBeVisible();
  await expect(page).toHaveURL("/forgot-password");
});

test("rejects mismatched passwords", async ({ page }) => {
  const email = await registerAndSignOut(page);
  await requestCode(page, email);
  await enterCode(page, KNOWN_CODE);

  await expect(page).toHaveURL("/reset-password");
  await page.getByLabel("Mật khẩu mới", { exact: true }).fill(NEW_PASSWORD);
  await page.getByLabel("Nhập lại mật khẩu mới", { exact: true }).fill("khac-hoan-toan");
  await page.getByRole("button", { name: "Đổi mật khẩu" }).click();

  await expect(page.getByText("Mật khẩu xác nhận không khớp.")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("blocks /reset-password without a verified code", async ({ page }) => {
  await page.goto("/reset-password");

  await expect(page.getByText("Phiên đặt lại đã hết hạn")).toBeVisible();
  await expect(page.getByLabel("Mật khẩu mới", { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Yêu cầu mã mới" }).click();
  await expect(page).toHaveURL("/forgot-password");
});

test("accepts a code typed in groups of two", async ({ page }) => {
  const email = await registerAndSignOut(page);
  await requestCode(page, email);
  await enterCode(page, "24 68 10");

  await expect(page).toHaveURL("/reset-password");
});

test("goes back to change the email, keeping what was typed", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill("go-nham@example.com");
  await page.getByRole("button", { name: "Gửi mã" }).click();
  await expect(page.getByLabel("Mã xác nhận")).toBeVisible();

  await page.getByRole("button", { name: "Đổi email" }).click();

  await expect(page.getByLabel("Email")).toHaveValue("go-nham@example.com");
  await expect(page.getByLabel("Mã xác nhận")).toHaveCount(0);
});

test("shows the reset page as expired when opened again after a reset", async ({ page }) => {
  const email = await registerAndSignOut(page);
  await requestCode(page, email);
  await enterCode(page, KNOWN_CODE);
  await page.getByLabel("Mật khẩu mới", { exact: true }).fill(NEW_PASSWORD);
  await page.getByLabel("Nhập lại mật khẩu mới", { exact: true }).fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Đổi mật khẩu" }).click();
  await expect(page.getByRole("dialog", { name: "Đổi mật khẩu thành công" })).toBeVisible();

  // The ticket cookie is still in the browser, but the ticket is used up.
  await page.goto("/reset-password");
  await expect(page.getByText("Phiên đặt lại đã hết hạn")).toBeVisible();
  await expect(page.getByLabel("Mật khẩu mới", { exact: true })).toHaveCount(0);
});

test("every step fits a 360px wide screen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const expectNoSidewaysScroll = async (step: string): Promise<void> => {
    const scroll = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(scroll, step).toBe(0);
  };
  const email = await registerAndSignOut(page);
  await requestCode(page, email);
  await expectNoSidewaysScroll("code step");

  await enterCode(page, "000000");
  await expect(page.getByText("Mã không đúng hoặc đã hết hạn.")).toBeVisible();
  await expectNoSidewaysScroll("wrong code");

  await enterCode(page, KNOWN_CODE);
  await expect(page).toHaveURL("/reset-password");
  await page.getByRole("button", { name: "Đổi mật khẩu" }).click();
  await expect(page.getByText(/Mật khẩu cần ít nhất/)).toBeVisible();
  await expectNoSidewaysScroll("reset form with errors");

  await page.getByLabel("Mật khẩu mới", { exact: true }).fill(NEW_PASSWORD);
  await page.getByLabel("Nhập lại mật khẩu mới", { exact: true }).fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Đổi mật khẩu" }).click();
  const dialog = page.getByRole("dialog", { name: "Đổi mật khẩu thành công" });
  await expect(dialog).toBeVisible();
  await expectNoSidewaysScroll("success dialog");
  const box = await dialog.boundingBox();
  expect(box && box.x >= 0 && box.x + box.width <= 360, "dialog inside the screen").toBe(true);
});
