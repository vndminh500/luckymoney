import { requireUserId } from "@/server/auth/session";
import { updateCategory } from "@/server/categories/service";
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
