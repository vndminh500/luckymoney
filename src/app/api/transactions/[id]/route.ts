import { requireUserId } from "@/server/auth/session";
import { errorResponse, readJson } from "@/server/http";
import {
  deleteTransaction,
  getTransaction,
  updateTransaction,
} from "@/server/transactions/service";

type Context = RouteContext<"/api/transactions/[id]">;

/** GET /api/transactions/:id -> the transaction, or 404 if it is not the user's. */
export async function GET(_request: Request, { params }: Context): Promise<Response> {
  try {
    const userId = await requireUserId();
    return Response.json(await getTransaction(userId, (await params).id));
  } catch (error) {
    return errorResponse(error);
  }
}

/** PATCH /api/transactions/:id: any of { type, amount, categoryId, occurredAt, note }. */
export async function PATCH(request: Request, { params }: Context): Promise<Response> {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    return Response.json(await updateTransaction(userId, id, await readJson(request)));
  } catch (error) {
    return errorResponse(error);
  }
}

/** DELETE /api/transactions/:id: soft delete -> 204. */
export async function DELETE(_request: Request, { params }: Context): Promise<Response> {
  try {
    const userId = await requireUserId();
    await deleteTransaction(userId, (await params).id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
