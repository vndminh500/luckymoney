import { requireUserId } from "@/server/auth/session";
import { errorResponse, readJson } from "@/server/http";
import { createJar, listJars } from "@/server/savings/service";

/** GET /api/savings -> { jars, total }. */
export async function GET(): Promise<Response> {
  try {
    const userId = await requireUserId();
    return Response.json(await listJars(userId));
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/savings: { name, icon? } -> 201, or 409 for a duplicate name. */
export async function POST(request: Request): Promise<Response> {
  try {
    const userId = await requireUserId();
    return Response.json(await createJar(userId, await readJson(request)), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
