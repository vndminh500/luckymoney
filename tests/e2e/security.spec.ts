import { expect, test } from "./fixtures";

test("pages send the security headers", async ({ request }) => {
  const response = await request.get("/login");
  const headers = response.headers();

  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["content-security-policy"]).toContain("object-src 'none'");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["strict-transport-security"]).toContain("max-age=");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("too many sign-in attempts for one email are refused with a clear message", async ({
  page,
}) => {
  const email = `e2e-limit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  const submit = page.getByRole("button", { name: "Đăng nhập", exact: true });
  /**
   * Submits once and waits until the form is idle again: React resets the
   * password input when the action settles, so filling before that could be
   * wiped and send an empty password (rejected before it counts).
   */
  const passwordInput = page.getByLabel("Mật khẩu", { exact: true });
  const attempt = async (password: string): Promise<void> => {
    await page.getByLabel("Email").fill(email);
    await passwordInput.fill(password);
    await Promise.all([
      page.waitForResponse((response) => response.request().method() === "POST"),
      submit.click(),
    ]);
    await expect(passwordInput).toHaveValue("");
    await expect(submit).toBeEnabled();
  };

  await page.goto("/login");
  const alert = page.locator("form").getByRole("alert");
  const limited = "Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 15 phút.";
  // The exact limit and its edge cases are covered in tests/integration/rate-limit.test.ts.
  for (let i = 1; i <= 10; i++) {
    await attempt(`sai-${i}`);
    await expect(alert).toHaveText("Email hoặc mật khẩu không đúng.");
  }
  await attempt("sai-11");
  await expect(alert).toHaveText(limited);
  // The page still works under the CSP: no script or style was blocked.
  expect(errors.filter((text) => text.includes("Content Security Policy"))).toEqual([]);
});
