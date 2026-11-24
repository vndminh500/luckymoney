import { requireUserId } from "@/server/auth/session";
import { addPayment } from "@/server/debts/service";
import { errorResponse, readJson } from "@/server/http";

/** POST /api/debts/:id/payments: { amount, paidOn, note? } -> 201; never more than what is left. */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/debts/[id]/payments">,
): Promise<Response> {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    return Response.json(await addPayment(userId, id, await readJson(request)), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
