import { requireUserId } from "@/server/auth/session";
import { listBudgets, upsertBudget } from "@/server/budgets/service";
import { errorResponse, readJson } from "@/server/http";

/** GET /api/budgets?month=YYYY-MM -> budgets with spent, percentUsed and status. */
export async function GET(request: Request): Promise<Response> {
  try {
    const userId = await requireUserId();
    const query = Object.fromEntries(new URL(request.url).searchParams);
    return Response.json((await listBudgets(userId, query)).items);
  } catch (error) {
    return errorResponse(error);
  }
}

/** PUT /api/budgets: { categoryId, month, amount } -> the budget (created or updated). */
export async function PUT(request: Request): Promise<Response> {
  try {
    const userId = await requireUserId();
    return Response.json(await upsertBudget(userId, await readJson(request)));
  } catch (error) {
    return errorResponse(error);
  }
}
