import { requireUserId } from "@/server/auth/session";
import { deleteDebt, getDebt, todayForUser, updateDebt } from "@/server/debts/service";
import { errorResponse, readJson } from "@/server/http";

type Context = RouteContext<"/api/debts/[id]">;

/** GET /api/debts/:id -> the debt with its schedule status and payments. */
export async function GET(_request: Request, { params }: Context): Promise<Response> {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    return Response.json(await getDebt(userId, id, await todayForUser(userId)));
  } catch (error) {
    return errorResponse(error);
  }
}

/** PUT /api/debts/:id: same body as POST; replaces the details and the schedule. */
export async function PUT(request: Request, { params }: Context): Promise<Response> {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    await updateDebt(userId, id, await readJson(request));
    return Response.json(await getDebt(userId, id, await todayForUser(userId)));
  } catch (error) {
    return errorResponse(error);
  }
}

/** DELETE /api/debts/:id -> 204, with its schedule and payments. */
export async function DELETE(_request: Request, { params }: Context): Promise<Response> {
  try {
    const userId = await requireUserId();
    await deleteDebt(userId, (await params).id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
