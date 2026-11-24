import { budgetStatus, percentUsed, type BudgetStatus } from "@/lib/budget";
import { getMonthRange, toMonthKey } from "@/lib/dates";
import {
  budgetFormSchema,
  listBudgetsQuerySchema,
  upsertBudgetSchema,
  type UpsertBudgetInput,
} from "@/lib/schemas/budget";
import { prisma } from "@/server/db";
import { NotFoundError, ValidationError } from "@/server/errors";
import { getUserTimeZone } from "@/server/transactions/service";

/** A stored limit for one expense category in one month. */
export type BudgetDto = { id: string; categoryId: string; month: string; amount: number };

/** A budget with what was spent against it (GET /api/budgets). */
export type BudgetProgress = BudgetDto & {
  name: string;
  icon: string | null;
  spent: number;
  percentUsed: number;
  status: BudgetStatus;
};

const budgetSelect = { id: true, categoryId: true, month: true, amount: true } as const;

/** PUT /api/budgets: sets the limit of (category, month), creating it if needed. */
export async function upsertBudget(userId: string, input: unknown): Promise<BudgetDto> {
  const parsed = upsertBudgetSchema.safeParse(input);
  if (!parsed.success) {
    throw ValidationError.fromZod(parsed.error);
  }
  return saveBudget(userId, parsed.data);
}

/** The budget form: same as upsertBudget, with the limit typed as text ("2tr"). */
export async function upsertBudgetFromForm(userId: string, input: unknown): Promise<BudgetDto> {
  const parsed = budgetFormSchema.safeParse(input);
  if (!parsed.success) {
    throw ValidationError.fromZod(parsed.error);
  }
  return saveBudget(userId, parsed.data);
}

async function saveBudget(userId: string, data: UpsertBudgetInput): Promise<BudgetDto> {
  // Budgets limit spending, so only the user's own active expense categories qualify.
  const category = await prisma.category.findFirst({
    where: { id: data.categoryId, userId, type: "EXPENSE", deletedAt: null },
    select: { id: true },
  });
  if (!category) {
    throw new ValidationError([{ field: "categoryId", message: "Danh mục chi không hợp lệ." }]);
  }
  const { categoryId, month, amount } = data;
  return prisma.budget.upsert({
    where: { userId_categoryId_month: { userId, categoryId, month } },
    create: { userId, categoryId, month, amount },
    update: { amount },
    select: budgetSelect,
  });
}

/**
 * GET /api/budgets: the month's budgets with spending in the user's time zone,
 * soft-deleted transactions excluded. Ordered by category name.
 */
export async function listBudgets(
  userId: string,
  query: unknown,
  now = new Date(),
): Promise<{ month: string; items: BudgetProgress[] }> {
  const parsed = listBudgetsQuerySchema.safeParse(query);
  if (!parsed.success) {
    throw ValidationError.fromZod(parsed.error);
  }
  const timeZone = await getUserTimeZone(userId);
  const month = parsed.data.month ?? toMonthKey(now, timeZone);
  const { start, end } = getMonthRange(month, timeZone);

  const budgets = await prisma.budget.findMany({
    where: { userId, month },
    select: {
      ...budgetSelect,
      category: { select: { name: true, icon: true } },
    },
  });
  const spending = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: {
      userId,
      deletedAt: null,
      type: "EXPENSE",
      occurredAt: { gte: start, lt: end },
      categoryId: { in: budgets.map((budget) => budget.categoryId) },
    },
    _sum: { amount: true },
  });
  const spentBy = new Map(spending.map((group) => [group.categoryId, group._sum.amount ?? 0]));

  const items = budgets
    .map(({ category, ...budget }) => {
      const spent = spentBy.get(budget.categoryId) ?? 0;
      const percent = percentUsed(spent, budget.amount);
      return {
        ...budget,
        name: category.name,
        icon: category.icon,
        spent,
        percentUsed: percent,
        status: budgetStatus(percent),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));
  return { month, items };
}

/** DELETE /api/budgets/:id. Another user's or an unknown budget is a 404. */
export async function deleteBudget(userId: string, id: string): Promise<void> {
  const { count } = await prisma.budget.deleteMany({ where: { id, userId } });
  if (count === 0) {
    throw new NotFoundError("Không tìm thấy ngân sách.");
  }
}
