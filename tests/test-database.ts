import { execFileSync } from "node:child_process";

/**
 * Returns a test database URL from `envName`, refusing anything whose database
 * name does not end in `suffix`. Test setup truncates tables, so pointing it at
 * a real database by mistake must fail loudly.
 */
export function requireTestDatabaseUrl(envName: string, suffix: string): string {
  const url = process.env[envName];
  if (!url) {
    throw new Error(`${envName} is not set. See .env.example.`);
  }
  const databaseName = new URL(url).pathname.slice(1);
  if (!databaseName.endsWith(suffix)) {
    throw new Error(
      `${envName} must point to a database ending in "${suffix}", got "${databaseName}".`,
    );
  }
  return url;
}

/** Creates the database if needed and applies all migrations. */
export function migrateDatabase(url: string): void {
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
}
