import { defineConfig } from "prisma/config";

// Prisma 7 does not load .env automatically. Load it if present (local dev);
// in CI/hosting the variables come from the environment instead.
try {
  process.loadEnvFile();
} catch {
  // No .env file: rely on the existing environment.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.ts",
  },
  datasource: {
    // Optional so `prisma generate` works without a database (e.g. CI type-check).
    // Commands that need a database (migrate, seed) fail with a clear error if missing.
    url: process.env.DATABASE_URL,
  },
});
