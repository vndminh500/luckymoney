import { requireUserId } from "@/server/auth/session";
import { restoreCategory } from "@/server/categories/service";
import { errorResponse } from "@/server/http";

/** POST /api/categories/:id/restore -> the category. */
export async function POST(
  _request: Request,
  { params }: RouteContext<"/api/categories/[id]/restore">,
): Promise<Response> {
  try {
    const userId = await requireUserId();
    return Response.json(await restoreCategory(userId, (await params).id));
  } catch (error) {
    return errorResponse(error);
  }
}
