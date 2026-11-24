import { requireUserId } from "@/server/auth/session";
import { errorResponse } from "@/server/http";
import { getStatsByCategory } from "@/server/stats/service";

/** GET /api/stats/by-category?month=YYYY-MM&type=EXPENSE -> [{ categoryId, name, icon, total, percent }]. */
export async function GET(request: Request): Promise<Response> {
  try {
    const userId = await requireUserId();
    const query = Object.fromEntries(new URL(request.url).searchParams);
    return Response.json((await getStatsByCategory(userId, query)).items);
  } catch (error) {
    return errorResponse(error);
  }
}
