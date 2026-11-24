import { requireUserId } from "@/server/auth/session";
import { deletePayment } from "@/server/debts/service";
import { errorResponse } from "@/server/http";

/** DELETE /api/debts/:id/payments/:paymentId -> 204 (undo a payment). */
export async function DELETE(
  _request: Request,
  { params }: RouteContext<"/api/debts/[id]/payments/[paymentId]">,
): Promise<Response> {
  try {
    const userId = await requireUserId();
    const { id, paymentId } = await params;
    await deletePayment(userId, id, paymentId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
