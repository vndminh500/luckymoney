import { requireUserId } from "@/server/auth/session";
import { archiveCategory } from "@/server/categories/service";
import { errorResponse } from "@/server/http";

/** POST /api/categories/:id/archive -> the category. */
export async function POST(
  _request: Request,
  { params }: RouteContext<"/api/categories/[id]/archive">,
): Promise<Response> {
  try {
    const userId = await requireUserId();
    return Response.json(await archiveCategory(userId, (await params).id));
  } catch (error) {
    return errorResponse(error);
  }
}
