import { requireUserId } from "@/server/auth/session";
import { errorResponse } from "@/server/http";
import { deleteEntry } from "@/server/savings/service";

/** DELETE /api/savings/:id/entries/:entryId -> 204 (undo), 409 if the balance would go below zero. */
export async function DELETE(
  _request: Request,
  { params }: RouteContext<"/api/savings/[id]/entries/[entryId]">,
): Promise<Response> {
  try {
    const userId = await requireUserId();
    const { id, entryId } = await params;
    await deleteEntry(userId, id, entryId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
