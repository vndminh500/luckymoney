import { Prisma, type TransactionType } from "@prisma/client";

import {
  createCategorySchema,
  listCategoriesQuerySchema,
  updateCategorySchema,
} from "@/lib/schemas/category";
import { prisma } from "@/server/db";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";

export type SelectableCategory = {
  id: string;
  name: string;
  type: TransactionType;
  icon: string | null;
};

/** A category as returned to clients. */
export type CategoryDto = SelectableCategory & { archived: boolean };

const categorySelect = { id: true, name: true, type: true, icon: true, archivedAt: true } as const;

type CategoryRow = Prisma.CategoryGetPayload<{ select: typeof categorySelect }>;

function toDto({ archivedAt, ...category }: CategoryRow): CategoryDto {
  return { ...category, archived: archivedAt !== null };
}

const categoryOrder = [{ type: "asc" }, { createdAt: "asc" }, { name: "asc" }] as const;

const duplicateName = () =>
  new ConflictError("Đã có danh mục cùng tên và loại (có thể đang được lưu trữ).");

const categoryNotFound = () => new NotFoundError("Không tìm thấy danh mục.");

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** The user's categories that can be picked for a new transaction (not archived). */
export async function listSelectableCategories(userId: string): Promise<SelectableCategory[]> {
  return prisma.category.findMany({
    where: { userId, archivedAt: null },
    select: { id: true, name: true, type: true, icon: true },
    orderBy: [...categoryOrder],
  });
}

/** GET /api/categories: active categories, plus archived ones with includeArchived=true. */
export async function listCategories(userId: string, query: unknown): Promise<CategoryDto[]> {
  const parsed = listCategoriesQuerySchema.safeParse(query);
  if (!parsed.success) {
    throw ValidationError.fromZod(parsed.error);
  }
  const rows = await prisma.category.findMany({
    where: { userId, ...(parsed.data.includeArchived ? {} : { archivedAt: null }) },
    select: categorySelect,
    orderBy: [...categoryOrder],
  });
  return rows.map(toDto);
}

/** Creates a category. (name, type) is unique per user, archived ones included: 409. */
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
      where: { id, userId },
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

/** Archives a category: it disappears from pickers but stays on its transactions. */
export async function archiveCategory(userId: string, id: string): Promise<CategoryDto> {
  return setArchived(userId, id, true);
}

/** Makes an archived category selectable again. */
export async function restoreCategory(userId: string, id: string): Promise<CategoryDto> {
  return setArchived(userId, id, false);
}

/** Idempotent: archiving twice keeps the first archivedAt. */
async function setArchived(userId: string, id: string, archived: boolean): Promise<CategoryDto> {
  const current = await findOwned(userId, id);
  if ((current.archivedAt !== null) === archived) {
    return toDto(current);
  }
  const row = await prisma.category.update({
    where: { id, userId },
    data: { archivedAt: archived ? new Date() : null },
    select: categorySelect,
  });
  return toDto(row);
}

/** Another user's or an unknown category is "not found", never "forbidden". */
async function findOwned(userId: string, id: string): Promise<CategoryRow> {
  const row = await prisma.category.findFirst({ where: { id, userId }, select: categorySelect });
  if (!row) {
    throw categoryNotFound();
  }
  return row;
}
