import { registerUser } from "@/server/auth/users";
import { errorResponse, readJson } from "@/server/http";

/** POST /api/auth/register: { email, password, name? } -> 201 with the user (no hash). */
export async function POST(request: Request): Promise<Response> {
  try {
    const user = await registerUser(await readJson(request));
    return Response.json(user, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
