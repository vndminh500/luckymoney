import { requireUserId } from "@/server/auth/session";
import { getAvatar } from "@/server/account/service";
import { NotFoundError } from "@/server/errors";
import { errorResponse } from "@/server/http";

/**
 * GET /api/account/avatar?v=<version> -> the signed-in user's own avatar image.
 * There is no way to ask for someone else's: the user always comes from the session.
 * The version in the URL changes with every upload, so the image can be cached.
 */
export async function GET(): Promise<Response> {
  try {
    const userId = await requireUserId();
    const avatar = await getAvatar(userId);
    if (!avatar) {
      throw new NotFoundError("Chưa có ảnh đại diện.");
    }
    return new Response(Buffer.from(avatar.data), {
      headers: {
        "content-type": avatar.mimeType,
        "cache-control": "private, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
