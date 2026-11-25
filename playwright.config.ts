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
  // Sign-up does two scrypt hashes and lands on the dashboard (three stats
  // queries). Sequentially that takes ~1-2s, but with every worker signing up
  // at once on a cold server it can pass the 5s default.
  expect: { timeout: 10_000 },
  retries: isCI ? 2 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Always test a fresh production build, built here (also in CI) so the build
    // sees the env below: static pages such as /register read it at build time. Using
    // `next start` also avoids clashing with a running `next dev`: Next.js allows
    // only one dev server per project directory.
    command: `npm run build && npm run start -- -p ${PORT}`,
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
