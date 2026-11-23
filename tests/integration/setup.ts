import { afterAll, beforeEach } from "vitest";

import { prisma } from "@/server/db";

import { requireTestDatabaseUrl } from "../test-database";

// Re-check inside the worker: DATABASE_URL is what the app code actually uses.
requireTestDatabaseUrl("DATABASE_URL", "_test");

/** Every test starts from an empty database. */
beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Transaction", "Budget", "Category", "Account", "User" RESTART IDENTITY CASCADE',
  );
});

afterAll(async () => {
  await prisma.$disconnect();
});
