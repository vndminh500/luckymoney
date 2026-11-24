import { requireUserId } from "@/server/auth/session";
import { errorResponse } from "@/server/http";
import { getSummary } from "@/server/stats/service";

/** GET /api/stats/summary?month=YYYY-MM -> { income, expense, balance }. */
export async function GET(request: Request): Promise<Response> {
  try {
    const userId = await requireUserId();
    const query = Object.fromEntries(new URL(request.url).searchParams);
    const { income, expense, balance } = await getSummary(userId, query);
    return Response.json({ income, expense, balance });
  } catch (error) {
    return errorResponse(error);
  }
}
