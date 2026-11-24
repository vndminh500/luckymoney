import { requireUserId } from "@/server/auth/session";
import { errorResponse } from "@/server/http";
import { getDailyStats } from "@/server/stats/service";

/** GET /api/stats/daily?month=YYYY-MM -> [{ date: "YYYY-MM-DD", income, expense }], every day. */
export async function GET(request: Request): Promise<Response> {
  try {
    const userId = await requireUserId();
    const query = Object.fromEntries(new URL(request.url).searchParams);
    return Response.json((await getDailyStats(userId, query)).days);
  } catch (error) {
    return errorResponse(error);
  }
}
