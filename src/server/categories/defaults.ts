import type { Prisma, TransactionType } from "@prisma/client";

type DefaultCategory = { name: string; type: TransactionType; icon: string };

/** Categories every new user starts with (docs/api.md). */
export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  { name: "Ăn uống", type: "EXPENSE", icon: "🍜" },
  { name: "Đi lại", type: "EXPENSE", icon: "🛵" },
  { name: "Nhà ở", type: "EXPENSE", icon: "🏠" },
  { name: "Giải trí", type: "EXPENSE", icon: "🎮" },
  { name: "Mua sắm", type: "EXPENSE", icon: "🛍️" },
  { name: "Sức khỏe", type: "EXPENSE", icon: "💊" },
  { name: "Học tập", type: "EXPENSE", icon: "📚" },
  { name: "Khác", type: "EXPENSE", icon: "📦" },
  { name: "Lương", type: "INCOME", icon: "💼" },
  { name: "Thưởng", type: "INCOME", icon: "🎁" },
  { name: "Khác", type: "INCOME", icon: "💰" },
];

export async function createDefaultCategories(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  await tx.category.createMany({
    data: DEFAULT_CATEGORIES.map((category) => ({ ...category, userId })),
    skipDuplicates: true,
  });
}
