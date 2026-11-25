import { registerUser } from "@/server/auth/users";
import { errorResponse, readJson } from "@/server/http";
import { clientIp, enforceRateLimit, RATE_LIMITS } from "@/server/rate-limit";

/** POST /api/auth/register: { email, password, name? } -> 201 with the user (no hash); 429 past the per-IP limit. */
export async function POST(request: Request): Promise<Response> {
  try {
    await enforceRateLimit(RATE_LIMITS.registerPerIp, clientIp(request.headers));
    const user = await registerUser(await readJson(request));
    return Response.json(user, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
