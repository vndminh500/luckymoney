import { defineConfig } from "vitest/config";

// Vitest does not load .env into process.env; load it if present (local dev).
try {
  process.loadEnvFile();
} catch {
  // No .env file: rely on the existing environment (CI).
}

export default defineConfig({
  resolve: {
    // Resolve the "@/*" alias from tsconfig.json (built into Vite 8).
    tsconfigPaths: true,
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["tests/integration/global-setup.ts"],
          setupFiles: ["tests/integration/setup.ts"],
          // Tests share one database and truncate it, so files must not run in parallel.
          fileParallelism: false,
          env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? "" },
          testTimeout: 20_000,
          // next-auth imports "next/server" without an extension, which Node's ESM
          // resolver rejects; letting Vite transform it resolves the import.
          server: { deps: { inline: ["next-auth"] } },
        },
      },
    ],
  },
});
