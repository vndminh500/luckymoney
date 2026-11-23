import { expect, test } from "@playwright/test";

// The e2e server runs with a fake Google client id (playwright.config.ts).
// Requests to Google are intercepted, so these tests never leave localhost.

test("Google button starts the OAuth flow with the right parameters", async ({ page }) => {
  let authorizeUrl: URL | undefined;
  await page.route("https://accounts.google.com/**", async (route) => {
    authorizeUrl = new URL(route.request().url());
    await route.fulfill({ status: 200, contentType: "text/html", body: "<p>fake google</p>" });
  });

  await page.goto("/login?callbackUrl=%2F%3Ffrom%3Dgoogle");
  await page.getByRole("button", { name: "Tiếp tục với Google" }).click();
  await expect(page.getByText("fake google")).toBeVisible();

  expect(authorizeUrl?.pathname).toBe("/o/oauth2/v2/auth");
  const params = authorizeUrl?.searchParams;
  expect(params?.get("client_id")).toBe("e2e-fake-client-id.apps.googleusercontent.com");
  expect(params?.get("redirect_uri")).toBe("http://localhost:3100/api/auth/callback/google");
  expect(params?.get("response_type")).toBe("code");
  expect(params?.get("scope")?.split(" ")).toEqual(
    expect.arrayContaining(["openid", "email", "profile"]),
  );
  // CSRF / code-injection protection is on.
  expect(params?.get("code_challenge_method")).toBe("S256");
  expect(
    params?.get("state") ?? params?.get("nonce") ?? params?.get("code_challenge"),
  ).toBeTruthy();
});

test("register page offers Google too", async ({ page }) => {
  await page.goto("/register");
  await expect(page.getByRole("button", { name: "Tiếp tục với Google" })).toBeVisible();
});

test.describe("sign-in errors from the Google flow", () => {
  test("explains an email that belongs to a password account", async ({ page }) => {
    await page.goto("/login?error=OAuthAccountNotLinked");
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(
      "Email này đã được đăng ký bằng mật khẩu. Hãy đăng nhập bằng email và mật khẩu.",
    );
  });

  test("explains an unverified Google email", async ({ page }) => {
    await page.goto("/login?error=AccessDenied");
    await expect(page.getByRole("main").getByRole("alert")).toContainText("email đã được xác minh");
  });

  test("shows a generic message for other errors", async ({ page }) => {
    await page.goto("/login?error=Configuration");
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(
      "Đăng nhập không thành công. Vui lòng thử lại.",
    );
  });
});
