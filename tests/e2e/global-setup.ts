import { migrateDatabase, requireTestDatabaseUrl } from "../test-database";

/** Runs once before the e2e suite: bring the e2e database up to date. */
export default function globalSetup(): void {
  migrateDatabase(requireTestDatabaseUrl("E2E_DATABASE_URL", "_e2e"));
  if (!process.env.AUTH_SECRET) {
    throw new Error("AUTH_SECRET is not set. See .env.example.");
  }
}
