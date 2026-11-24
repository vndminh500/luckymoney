import { requireUserId } from "@/server/auth/session";
import { errorResponse, readJson } from "@/server/http";
import { createTransaction, listTransactions } from "@/server/transactions/service";

/**
 * GET /api/transactions?month=YYYY-MM&categoryId&type&page&pageSize
 * -> { items, page, pageSize, total } (plus the resolved month), newest first.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const userId = await requireUserId();
    const query = Object.fromEntries(new URL(request.url).searchParams);
    const { month, items, page, pageSize, total } = await listTransactions(userId, query);
    return Response.json({ month, items, page, pageSize, total });
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/transactions: { type, amount, categoryId, occurredAt, note? } -> 201. */
export async function POST(request: Request): Promise<Response> {
  try {
    const userId = await requireUserId();
    const transaction = await createTransaction(userId, await readJson(request));
    return Response.json(transaction, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
