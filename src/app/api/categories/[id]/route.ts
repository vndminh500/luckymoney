import { requireUserId } from "@/server/auth/session";
import { deleteCategory, updateCategory } from "@/server/categories/service";
import { errorResponse, readJson } from "@/server/http";

/** PATCH /api/categories/:id: { name?, icon? } (at least one). */
export async function PATCH(
  request: Request,
  { params }: RouteContext<"/api/categories/[id]">,
): Promise<Response> {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    return Response.json(await updateCategory(userId, id, await readJson(request)));
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * DELETE /api/categories/:id -> 204. 409 while the category still has
 * transactions (the message says how many); 404 if it is not the user's.
 */
export async function DELETE(
  _request: Request,
  { params }: RouteContext<"/api/categories/[id]">,
): Promise<Response> {
  try {
    const userId = await requireUserId();
    await deleteCategory(userId, (await params).id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
