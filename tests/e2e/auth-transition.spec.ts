import { expect, test, type Page } from "@playwright/test";

/**
 * Login and register forms differ in height and the auth column is centered,
 * so the tab bar has to move when switching. It must glide, not jump.
 */
async function tabBarTrack(page: Page, tab: string): Promise<number[]> {
  const nav = page.getByRole("navigation", { name: "Tài khoản" });
  await nav.evaluate(() => {
    const element = document.querySelector('nav[aria-label="Tài khoản"]');
    const samples: number[] = [];
    (window as unknown as { __samples: number[] }).__samples = samples;
    const start = performance.now();
    const sample = (): void => {
      samples.push(element?.getBoundingClientRect().top ?? NaN);
      if (performance.now() - start < 2000) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await nav.getByRole("link", { name: tab }).click();
  await page.waitForTimeout(2100);
  return page.evaluate(() => (window as unknown as { __samples: number[] }).__samples);
}

function largestStep(samples: number[]): number {
  let largest = 0;
  for (let i = 1; i < samples.length; i++) {
    largest = Math.max(largest, Math.abs(samples[i] - samples[i - 1]));
  }
  return largest;
}

test("the tab bar glides between sign-in and sign-up", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto("/login");
  await page.waitForTimeout(800);

  const toRegister = await tabBarTrack(page, "Đăng ký");
  const toLogin = await tabBarTrack(page, "Đăng nhập");

  for (const [name, samples] of [
    ["to register", toRegister],
    ["to login", toLogin],
  ] as const) {
    const travel = Math.abs(samples.at(-1)! - samples[0]);
    expect(travel, `${name}: the bar does move`).toBeGreaterThan(20);
    // A jump moves the whole way in one frame. A glide spreads it out; the bound
    // is relative so dropped frames on a busy machine do not fail it.
    expect(largestStep(samples), `${name}: no frame jumps`).toBeLessThanOrEqual(travel / 2);
  }
});

test("reduced motion switches without animating", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto("/login");
  await page
    .getByRole("navigation", { name: "Tài khoản" })
    .getByRole("link", { name: "Đăng ký" })
    .click();
  await expect(page.getByRole("heading", { name: "Tạo tài khoản" })).toBeVisible();
  const heightTransition = await page
    .getByTestId("auth-height")
    .evaluate((element) => getComputedStyle(element).transitionProperty);
  expect(heightTransition).toBe("none");
});
