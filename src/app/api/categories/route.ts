import { requireUserId } from "@/server/auth/session";
import { createCategory, listCategories } from "@/server/categories/service";
import { errorResponse, readJson } from "@/server/http";

/** GET /api/categories?includeArchived=false -> the user's categories. */
export async function GET(request: Request): Promise<Response> {
  try {
    const userId = await requireUserId();
    const query = Object.fromEntries(new URL(request.url).searchParams);
    return Response.json(await listCategories(userId, query));
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/categories: { name, type, icon? } -> 201, or 409 for a duplicate (name, type). */
export async function POST(request: Request): Promise<Response> {
  try {
    const userId = await requireUserId();
    const category = await createCategory(userId, await readJson(request));
    return Response.json(category, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
