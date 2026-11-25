import { expect, test } from "./fixtures";

test("guests can fetch everything an install or the Android app needs", async ({ request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  const data = await manifest.json();
  expect(data).toMatchObject({ name: "Lucky Money", display: "standalone", start_url: "/" });
  for (const icon of data.icons as { src: string }[]) {
    const response = await request.get(icon.src);
    expect(response.status(), icon.src).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
  }

  const worker = await request.get("/sw.js");
  expect(worker.status()).toBe(200);
  expect(worker.headers()["cache-control"]).toContain("no-cache");

  const offline = await request.get("/offline.html");
  expect(offline.status()).toBe(200);
  expect(await offline.text()).toContain("Không có kết nối mạng");

  const links = await request.get("/.well-known/assetlinks.json");
  expect(links.status()).toBe(200);
  expect(await links.json()).toEqual([]);
});

test("the login page links the manifest and the theme colour", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#30AFFF");
});

test("without a network the installed app shows the offline page", async ({ page, context }) => {
  await page.goto("/login");
  // Wait until the service worker is installed and controls the page.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }),
      );
    }
  });

  await context.setOffline(true);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Không có kết nối mạng" })).toBeVisible();
  await context.setOffline(false);
  await page.getByRole("link", { name: "Thử lại" }).click();
  await expect(page).toHaveURL("/login");
});
