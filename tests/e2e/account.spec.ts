import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "mat-khau-e2e-123";

async function registerAndSignIn(page: Page): Promise<string> {
  const email = `e2e-acc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await expect(page).toHaveURL("/");
  return email;
}

const avatarButton = (page: Page) => page.getByRole("button", { name: "Tài khoản của bạn" });
const accountMenu = (page: Page) =>
  page.getByRole("navigation", { name: "Tài khoản", exact: true });

test("hovering the avatar opens the menu; a click pins it, Escape closes it", async ({ page }) => {
  await registerAndSignIn(page);
  await expect(accountMenu(page)).toBeHidden();

  await avatarButton(page).hover();
  await expect(accountMenu(page)).toBeVisible();
  await expect(accountMenu(page).getByRole("link")).toHaveText(["Tài khoản", "Cài đặt"]);
  await expect(accountMenu(page).getByRole("button", { name: "Đăng xuất" })).toBeVisible();

  // Moving away closes the hover menu.
  await page.mouse.move(10, 600);
  await expect(accountMenu(page)).toBeHidden();

  await avatarButton(page).click();
  await expect(avatarButton(page)).toHaveAttribute("aria-expanded", "true");
  await page.mouse.move(10, 600);
  await expect(accountMenu(page)).toBeVisible(); // pinned by the click
  await page.keyboard.press("Escape");
  await expect(accountMenu(page)).toBeHidden();
  await expect(avatarButton(page)).toBeFocused();

  await avatarButton(page).click();
  await accountMenu(page).getByRole("link", { name: "Tài khoản" }).click();
  await expect(page).toHaveURL("/account");
});

test("edit the profile and upload an avatar", async ({ page }) => {
  const email = await registerAndSignIn(page);
  await page.goto("/account");

  await expect(page.getByLabel("Email")).toHaveValue(email);
  await expect(page.getByLabel("Email")).toHaveAttribute("readonly", "");
  await page.getByLabel("Họ tên").fill("Nguyễn Văn Minh");
  // Unique per run: the e2e database keeps users between runs.
  const suffix = Date.now().toString(36);
  await page.getByLabel("Tên đăng nhập").fill(`Minh.Nguyen${suffix}`);
  await page.getByLabel("Ngày sinh").fill("1995-04-30");
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(page.getByRole("status")).toHaveText("Đã lưu thông tin cá nhân.");

  // The menu shows the new name and username.
  await avatarButton(page).click();
  await expect(accountMenu(page).locator("..")).toContainText("Nguyễn Văn Minh");
  await expect(accountMenu(page).locator("..")).toContainText(`@minh.nguyen${suffix}`);
  await page.keyboard.press("Escape");
  await expect(avatarButton(page)).toContainText("NM"); // initials until an avatar is uploaded

  // A real PNG drawn by the browser, then cropped and resized by the page.
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 300;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no canvas");
    context.fillStyle = "#30AFFF";
    context.fillRect(0, 0, 400, 300);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page.getByLabel("Chọn ảnh đại diện").setInputFiles({
    name: "me.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  const avatarImage = avatarButton(page).locator("img");
  await expect(avatarImage).toHaveAttribute("src", /\/api\/account\/avatar\?v=\d+/);
  const response = await page.request.get((await avatarImage.getAttribute("src")) ?? "");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toMatch(/^image\/(webp|jpeg)$/);

  await page.getByRole("button", { name: "Xóa ảnh" }).click();
  await expect(avatarButton(page).locator("img")).toHaveCount(0);
});

test("a taken username is reported on its field", async ({ page, browser }) => {
  const other = await browser.newPage();
  await registerAndSignIn(other);
  await other.goto("/account");
  const taken = `u${Date.now()}`;
  await other.getByLabel("Tên đăng nhập").fill(taken);
  await other.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(other.getByRole("status")).toBeVisible();

  await registerAndSignIn(page);
  await page.goto("/account");
  await page.getByLabel("Tên đăng nhập").fill(taken.toUpperCase());
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(page.getByText("Tên đăng nhập này đã có người dùng.")).toBeVisible();
  await expect(page.getByLabel("Tên đăng nhập")).toHaveAttribute("aria-invalid", "true");
});

test("change the password, then sign in with the new one", async ({ page }) => {
  const email = await registerAndSignIn(page);
  await page.goto("/account/security");

  await page.getByLabel("Mật khẩu hiện tại").fill("sai-mat-khau");
  await page.getByLabel("Mật khẩu mới", { exact: true }).fill("mat-khau-moi-456");
  await page.getByLabel("Nhập lại mật khẩu mới").fill("mat-khau-moi-456");
  await page.getByRole("button", { name: "Đổi mật khẩu" }).click();
  await expect(page.getByText("Mật khẩu hiện tại không đúng.")).toBeVisible();

  await page.getByLabel("Mật khẩu hiện tại").fill(PASSWORD);
  await page.getByLabel("Mật khẩu mới", { exact: true }).fill("mat-khau-moi-456");
  await page.getByLabel("Nhập lại mật khẩu mới").fill("mat-khau-moi-456");
  await page.getByRole("button", { name: "Đổi mật khẩu" }).click();
  await expect(page.getByRole("status")).toHaveText("Đã đổi mật khẩu.");

  await avatarButton(page).click();
  await accountMenu(page).getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill("mat-khau-moi-456");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL("/");
});
