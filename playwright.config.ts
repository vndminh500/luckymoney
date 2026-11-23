import { defineConfig, devices } from "@playwright/test";

// Load .env for local runs; CI provides the variables directly.
try {
  process.loadEnvFile();
} catch {
  // No .env file.
}

const PORT = 3100;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "tests/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Always test the production build (CI builds in a separate step). Using
    // `next start` also avoids clashing with a running `next dev`: Next.js allows
    // only one dev server per project directory.
    command: isCI ? `npm run start -- -p ${PORT}` : `npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !isCI,
    timeout: 300_000,
    // The app under test talks to the dedicated e2e database, never the dev one.
    env: {
      DATABASE_URL: process.env.E2E_DATABASE_URL ?? "",
      AUTH_SECRET: process.env.AUTH_SECRET ?? "",
      AUTH_TRUST_HOST: "true",
    },
  },
});
