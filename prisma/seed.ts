import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// Empty seed for now. Demo data is added in later tasks (T13, T17).
async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg(connectionString) });
  try {
    await prisma.$connect();
    console.log("Seed: nothing to seed yet.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
