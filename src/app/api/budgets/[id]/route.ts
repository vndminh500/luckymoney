import { requireUserId } from "@/server/auth/session";
import { deleteBudget } from "@/server/budgets/service";
import { errorResponse } from "@/server/http";

/** DELETE /api/budgets/:id -> 204, or 404 if it is not the user's. */
export async function DELETE(
  _request: Request,
  { params }: RouteContext<"/api/budgets/[id]">,
): Promise<Response> {
  try {
    const userId = await requireUserId();
    await deleteBudget(userId, (await params).id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
