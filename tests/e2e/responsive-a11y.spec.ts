import { expect, test, type Page } from "@playwright/test";

/**
 * T15: every page fits a 360px phone without sideways scrolling, and the app
 * can be used with the keyboard alone.
 */

const PASSWORD = "mat-khau-e2e-123";

async function registerAndSignIn(page: Page): Promise<void> {
  await page.goto("/register");
  await page
    .getByLabel("Email")
    .fill(`nguoidungt15${Date.now()}${Math.random().toString(36).slice(2, 8)}@example.com`);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await expect(page).toHaveURL("/");
}

/** Some data so lists, charts and the debt pages are not all empty. */
async function seed(page: Page): Promise<{ transactionId: string; debtId: string; jarId: string }> {
  const categories = (await (await page.request.get("/api/categories")).json()) as {
    id: string;
    name: string;
  }[];
  const food = categories.find((c) => c.name === "Ăn uống")!.id;
  const today = new Date().toISOString().slice(0, 10);
  const transaction = await (
    await page.request.post("/api/transactions", {
      data: {
        type: "EXPENSE",
        amount: 1_234_567,
        categoryId: food,
        occurredAt: `${today}T05:00:00Z`,
        note: "Một ghi chú rất dài để kiểm tra xem dòng có bị tràn ngang trên màn hình nhỏ hay không",
      },
    })
  ).json();
  await page.request.put("/api/budgets", {
    data: { categoryId: food, month: today.slice(0, 7), amount: 1_000_000 },
  });
  const debt = await (
    await page.request.post("/api/debts", {
      data: {
        direction: "I_OWE",
        counterparty: "Nguyễn Văn Một Cái Tên Khá Dài",
        principal: 123_456_789,
        startDate: "2026-01-01",
        installments: [
          { dueDate: "2026-02-01", amount: 61_728_394 },
          { dueDate: "2099-03-01", amount: 61_728_395 },
        ],
      },
    })
  ).json();
  const jar = await (
    await page.request.post("/api/savings", {
      data: { name: "Quỹ mua nhà cho cả gia đình trong năm năm tới", icon: "🏠" },
    })
  ).json();
  await page.request.post(`/api/savings/${jar.id}/entries`, {
    data: {
      kind: "DEPOSIT",
      amount: 987_654_321,
      occurredOn: "2026-01-01",
      note: "Một ghi chú rất dài để kiểm tra xem dòng có bị tràn ngang hay không",
    },
  });
  return { transactionId: transaction.id, debtId: debt.id, jarId: jar.id };
}

async function expectNoSidewaysScroll(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.locator("main").first()).toBeVisible();
  await expect(page.getByText("Đang tải", { exact: false })).toHaveCount(0);
  const overflow = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const wide = [...document.querySelectorAll<HTMLElement>("main *")]
      .filter((el) => el.getBoundingClientRect().right > width + 1)
      .filter((el) => getComputedStyle(el).position !== "fixed")
      // Inside a strip that scrolls sideways on purpose (the section tabs) is fine.
      .filter((el) => {
        for (let up = el.parentElement; up; up = up.parentElement) {
          if (["auto", "scroll"].includes(getComputedStyle(up).overflowX)) return false;
        }
        return true;
      })
      .slice(0, 3)
      .map((el) => `${el.tagName.toLowerCase()}.${el.className.toString().slice(0, 60)}`);
    // Text wider than its own box spills onto its neighbours even when the page
    // does not scroll (e.g. numbers in narrow columns running into each other).
    const spill = [
      ...document.querySelectorAll<HTMLElement>("main dd, main dt, main p, main h1, main h2"),
    ]
      .filter((el) => getComputedStyle(el).overflowX === "visible")
      .filter((el) => el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1)
      .slice(0, 3)
      .map((el) => `${el.tagName.toLowerCase()}: ${el.textContent?.slice(0, 40)}`);
    return { scroll: document.documentElement.scrollWidth - width, wide, spill };
  });
  expect(overflow, `${path} overflows at 360px`).toEqual({ scroll: 0, wide: [], spill: [] });
}

test("every page fits a 360px wide screen", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 360, height: 740 });
  await registerAndSignIn(page);
  const { transactionId, debtId, jarId } = await seed(page);

  for (const path of [
    "/",
    "/stats",
    "/transactions",
    "/transactions/new",
    `/transactions/${transactionId}/edit`,
    "/budgets",
    "/debts",
    "/debts/new",
    `/debts/${debtId}`,
    `/debts/${debtId}/edit`,
    "/savings",
    `/savings/${jarId}`,
    "/categories",
    "/account",
    "/account/security",
    "/settings",
    "/settings/appearance",
    "/settings/notifications",
    "/settings/about",
  ]) {
    await expectNoSidewaysScroll(page, path);
  }
});

test("the sign-in pages fit a 360px wide screen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  for (const path of ["/login", "/register"]) {
    await page.goto(path);
    const scroll = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(scroll, path).toBe(0);
  }
});

test("a skip link jumps past the menu to the page content", async ({ page }) => {
  await registerAndSignIn(page);
  await page.goto("/transactions");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Bỏ qua tới nội dung chính" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Enter");
  // The next Tab lands inside the page, not on the sidebar.
  await page.keyboard.press("Tab");
  const focusedInMain = await page.evaluate(
    () => document.getElementById("noi-dung")?.contains(document.activeElement) ?? false,
  );
  expect(focusedInMain).toBe(true);
});

test("the phone menu opens and closes from the keyboard and keeps focus sensible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await registerAndSignIn(page);
  const menuButton = page.getByRole("button", { name: "Mở menu" });
  await menuButton.focus();
  await page.keyboard.press("Enter");
  await expect(menuButton).toHaveAttribute("aria-expanded", "true");

  const drawer = page.getByRole("complementary", { name: "Menu" });
  // Focus moves into the menu...
  await expect(drawer.getByRole("link", { name: "Tổng quan", exact: true })).toBeFocused();
  // ...and Escape closes it and gives focus back to the button.
  await page.keyboard.press("Escape");
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  await expect(menuButton).toBeFocused();

  // Choosing a section from the keyboard navigates and closes the menu.
  await page.keyboard.press("Enter");
  await drawer.getByRole("link", { name: "Sổ nợ" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/debts");
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
});

test("an unknown debt shows the not-found page with a way back", async ({ page }) => {
  await registerAndSignIn(page);
  await page.goto("/debts/khong-ton-tai");
  await expect(page.getByRole("heading", { name: "Không tìm thấy" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Về trang tổng quan" })).toBeVisible();
});
