import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "mat-khau-e2e-123";

/** Unique per test so tests stay independent without cleaning the database. */
function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function register(page: Page, email: string, name = "Người Thử"): Promise<void> {
  await page.goto("/register");
  await page.getByLabel("Tên (không bắt buộc)").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng ký" }).click();
}

async function login(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
}

test.describe("guests", () => {
  test("are redirected from the app to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/login");
    await expect(page.getByRole("heading", { name: "Đăng nhập" })).toBeVisible();
  });

  test("keep the requested page as callbackUrl", async ({ page }) => {
    await page.goto("/transactions?month=2026-11");
    const url = new URL(page.url());
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("callbackUrl")).toBe("/transactions?month=2026-11");
    // Exactly one form: each input has a single label (accessible name "Email", not "Email Email").
    await expect(page.locator('form:has(input[name="email"])')).toHaveCount(1);
    await expect(page.getByRole("textbox", { name: "Email", exact: true })).toHaveCount(1);
  });

  test("get 401 JSON from protected APIs", async ({ request }) => {
    const response = await request.get("/api/transactions");
    expect(response.status()).toBe(401);
    expect(await response.json()).toMatchObject({ error: "UNAUTHENTICATED" });
  });
});

test("register, sign out, and sign in again", async ({ page, context }) => {
  const email = uniqueEmail();

  await register(page, email);
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "Xin chào, Người Thử" })).toBeVisible();

  // Session cookie: httpOnly and expiring (PRD F1).
  const sessionCookie = (await context.cookies()).find((c) => c.name.includes("session-token"));
  expect(sessionCookie?.httpOnly).toBe(true);
  expect(sessionCookie?.expires).toBeGreaterThan(Date.now() / 1000);
  expect(sessionCookie?.expires).toBeLessThanOrEqual(Date.now() / 1000 + 7 * 24 * 60 * 60 + 60);

  // Signed-in users skip the login page.
  await page.goto("/login");
  await expect(page).toHaveURL("/");

  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL("/login");
  await page.goto("/");
  await expect(page).toHaveURL("/login");

  await login(page, email);
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "Xin chào, Người Thử" })).toBeVisible();
});

test("wrong password shows an error and keeps the email", async ({ page }) => {
  const email = uniqueEmail();
  await register(page, email);
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL("/login");

  await login(page, email, "wrong-password");
  // Scoped to <main>: Next.js' route announcer is also role="alert".
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Email hoặc mật khẩu không đúng.",
  );
  await expect(page.getByLabel("Email")).toHaveValue(email);
  await expect(page).toHaveURL("/login");
});

test("registering an existing email shows a field error", async ({ page }) => {
  const email = uniqueEmail();
  await register(page, email);
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL("/login");

  await register(page, email.toUpperCase());
  await expect(page.getByText("Email này đã được đăng ký.")).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");
});

test("login returns to the callbackUrl", async ({ page }) => {
  const email = uniqueEmail();
  await register(page, email);
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL("/login");

  await page.goto("/login?callbackUrl=%2F%3Ffrom%3De2e");
  await login(page, email);
  await expect(page).toHaveURL("/?from=e2e");
});
