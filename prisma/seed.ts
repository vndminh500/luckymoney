import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { DEMO_EMAIL, resetDemoAccount } from "../src/server/demo/demo-account.ts";

/** `npx prisma db seed`: (re)creates the public demo account with sample data. */
async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg(connectionString) });
  try {
    await resetDemoAccount(prisma);
    console.log(`Seed: demo account ${DEMO_EMAIL} is ready.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
