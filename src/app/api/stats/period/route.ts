import { requireUserId } from "@/server/auth/session";
import { errorResponse } from "@/server/http";
import { getPeriodStats } from "@/server/stats/service";

/**
 * GET /api/stats/period?period=week|month|year&date=YYYY-MM-DD
 * -> { period, start, previous, next, totals, buckets: [{ key, income, expense }] }.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const userId = await requireUserId();
    const query = Object.fromEntries(new URL(request.url).searchParams);
    return Response.json(await getPeriodStats(userId, query));
  } catch (error) {
    return errorResponse(error);
  }
}
