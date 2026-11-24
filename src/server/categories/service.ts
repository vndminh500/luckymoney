import { Prisma, type TransactionType } from "@prisma/client";

import { createCategorySchema, updateCategorySchema } from "@/lib/schemas/category";
import { prisma } from "@/server/db";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";

export type SelectableCategory = {
  id: string;
  name: string;
  type: TransactionType;
  icon: string | null;
};

/** A category as returned to clients, with its number of (not deleted) transactions. */
export type CategoryDto = SelectableCategory & { transactionCount: number };

/**
 * Categories hidden by deleteCategory (deletedAt set) never appear anywhere:
 * every query below filters them out.
 */
const visible = (userId: string) => ({ userId, deletedAt: null });

const categorySelect = {
  id: true,
  name: true,
  type: true,
  icon: true,
  _count: { select: { transactions: { where: { deletedAt: null } } } },
} as const;

type CategoryRow = Prisma.CategoryGetPayload<{ select: typeof categorySelect }>;

function toDto({ _count, ...category }: CategoryRow): CategoryDto {
  return { ...category, transactionCount: _count.transactions };
}

const categoryOrder = [{ type: "asc" }, { createdAt: "asc" }, { name: "asc" }] as const;

const duplicateName = () => new ConflictError("Đã có danh mục cùng tên và loại.");

const categoryNotFound = () => new NotFoundError("Không tìm thấy danh mục.");

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** The user's categories that can be picked for a transaction. */
export async function listSelectableCategories(userId: string): Promise<SelectableCategory[]> {
  return prisma.category.findMany({
    where: visible(userId),
    select: { id: true, name: true, type: true, icon: true },
    orderBy: [...categoryOrder],
  });
}

/** GET /api/categories: the user's categories with their transaction counts. */
export async function listCategories(userId: string): Promise<CategoryDto[]> {
  const rows = await prisma.category.findMany({
    where: visible(userId),
    select: categorySelect,
    orderBy: [...categoryOrder],
  });
  return rows.map(toDto);
}

/** Creates a category. (name, type) is unique per user: a duplicate is a 409. */
export async function createCategory(userId: string, input: unknown): Promise<CategoryDto> {
  const parsed = createCategorySchema.safeParse(input);
  if (!parsed.success) {
    throw ValidationError.fromZod(parsed.error);
  }
  try {
    const row = await prisma.category.create({
      data: { ...parsed.data, userId },
      select: categorySelect,
    });
    return toDto(row);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw duplicateName();
    }
    throw error;
  }
}

/** Renames or changes the icon of one of the user's categories. */
export async function updateCategory(
  userId: string,
  id: string,
  input: unknown,
): Promise<CategoryDto> {
  const parsed = updateCategorySchema.safeParse(input);
  if (!parsed.success) {
    throw ValidationError.fromZod(parsed.error);
  }
  await findOwned(userId, id);
  try {
    const row = await prisma.category.update({
      where: { id, ...visible(userId) },
      data: parsed.data,
      select: categorySelect,
    });
    return toDto(row);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw duplicateName();
    }
    throw error;
  }
}

/**
 * DELETE /api/categories/:id. Only a category without transactions can go:
 * otherwise 409, with the number of transactions to move or delete first.
 * Its budgets go with it. Soft-deleted transactions must keep a valid
 * category, so a category they still point to is hidden instead of removed,
 * and renamed so its name can be used again.
 */
export async function deleteCategory(userId: string, id: string): Promise<void> {
  const category = await findOwned(userId, id);
  if (category._count.transactions > 0) {
    throw new ConflictError(
      `Danh mục còn ${category._count.transactions} giao dịch. Hãy chuyển các giao dịch sang danh mục khác hoặc xóa chúng trước.`,
    );
  }
  const deletedTransactions = await prisma.transaction.count({
    where: { userId, categoryId: id, deletedAt: { not: null } },
  });
  if (deletedTransactions === 0) {
    // Budgets cascade with the category.
    await prisma.category.delete({ where: { id, userId } });
    return;
  }
  await prisma.$transaction([
    prisma.budget.deleteMany({ where: { userId, categoryId: id } }),
    prisma.category.update({
      where: { id, userId },
      data: { deletedAt: new Date(), name: `${category.name} (đã xóa ${id})` },
    }),
  ]);
}

/** Another user's, an unknown or a deleted category is "not found", never "forbidden". */
async function findOwned(userId: string, id: string): Promise<CategoryRow> {
  const row = await prisma.category.findFirst({
    where: { id, ...visible(userId) },
    select: categorySelect,
  });
  if (!row) {
    throw categoryNotFound();
  }
  return row;
}
