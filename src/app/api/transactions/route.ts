import { requireUserId } from "@/server/auth/session";
import { errorResponse, readJson } from "@/server/http";
import { createTransaction } from "@/server/transactions/service";

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
