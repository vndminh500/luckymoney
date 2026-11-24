import { registerUser } from "@/server/auth/users";
import { prisma } from "@/server/db";

/** A registered user and the ids of two of their default categories. */
export type UserFixture = { userId: string; food: string; salary: string };

export async function createUserWithCategories(email: string): Promise<UserFixture> {
  const user = await registerUser({ email, password: "mat-khau-an-toan" });
  const find = async (name: string, type: "EXPENSE" | "INCOME") =>
    (await prisma.category.findFirstOrThrow({ where: { userId: user.id, name, type } })).id;
  return {
    userId: user.id,
    food: await find("Ăn uống", "EXPENSE"),
    salary: await find("Lương", "INCOME"),
  };
}
