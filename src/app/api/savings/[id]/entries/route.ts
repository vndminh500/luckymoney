import { requireUserId } from "@/server/auth/session";
import { errorResponse, readJson } from "@/server/http";
import { addEntry } from "@/server/savings/service";

/** POST /api/savings/:id/entries: { kind, amount, occurredOn, note? } -> 201. */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/savings/[id]/entries">,
): Promise<Response> {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    return Response.json(await addEntry(userId, id, await readJson(request)), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
