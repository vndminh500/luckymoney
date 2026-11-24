import type { TransactionType } from "@prisma/client";

import { prisma } from "@/server/db";

export type SelectableCategory = {
  id: string;
  name: string;
  type: TransactionType;
  icon: string | null;
};

/** The user's categories that can be picked for a new transaction (not archived). */
export async function listSelectableCategories(userId: string): Promise<SelectableCategory[]> {
  return prisma.category.findMany({
    where: { userId, archivedAt: null },
    select: { id: true, name: true, type: true, icon: true },
    orderBy: [{ type: "asc" }, { createdAt: "asc" }, { name: "asc" }],
  });
}
