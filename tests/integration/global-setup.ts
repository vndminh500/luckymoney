import { migrateDatabase, requireTestDatabaseUrl } from "../test-database";

/** Runs once before the integration suite: bring the test database up to date. */
export default function setup(): void {
  migrateDatabase(requireTestDatabaseUrl("TEST_DATABASE_URL", "_test"));
}
