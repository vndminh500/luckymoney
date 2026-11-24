import { requireUserId } from "@/server/auth/session";
import { errorResponse, readJson } from "@/server/http";
import { deleteJar, getJar, updateJar } from "@/server/savings/service";

type Context = RouteContext<"/api/savings/[id]">;

/** GET /api/savings/:id -> the jar with its balance and history. */
export async function GET(_request: Request, { params }: Context): Promise<Response> {
  try {
    const userId = await requireUserId();
    return Response.json(await getJar(userId, (await params).id));
  } catch (error) {
    return errorResponse(error);
  }
}

/** PATCH /api/savings/:id: { name?, icon? } (at least one). */
export async function PATCH(request: Request, { params }: Context): Promise<Response> {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    await updateJar(userId, id, await readJson(request));
    return Response.json(await getJar(userId, id));
  } catch (error) {
    return errorResponse(error);
  }
}

/** DELETE /api/savings/:id -> 204, with its history. */
export async function DELETE(_request: Request, { params }: Context): Promise<Response> {
  try {
    const userId = await requireUserId();
    await deleteJar(userId, (await params).id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
