import { requireUserId } from "@/server/auth/session";
import { createDebt, listDebts, todayForUser } from "@/server/debts/service";
import { errorResponse, readJson } from "@/server/http";

/** GET /api/debts -> { debts, totals }, statuses as of today in the user's time zone. */
export async function GET(): Promise<Response> {
  try {
    const userId = await requireUserId();
    return Response.json(await listDebts(userId, await todayForUser(userId)));
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/debts: { direction, counterparty, principal, startDate, note?, installments } -> 201 { id }. */
export async function POST(request: Request): Promise<Response> {
  try {
    const userId = await requireUserId();
    return Response.json(await createDebt(userId, await readJson(request)), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
