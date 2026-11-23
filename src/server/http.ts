import { AppError, ValidationError } from "@/server/errors";

/** Maps any thrown error to the JSON error format in docs/api.md. Unknown errors become 500. */
export function errorResponse(error: unknown): Response {
  if (error instanceof ValidationError) {
    return Response.json({ error: error.code, details: error.details }, { status: error.status });
  }
  if (error instanceof AppError) {
    return Response.json({ error: error.code, message: error.message }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: "INTERNAL", message: "Đã có lỗi xảy ra." }, { status: 500 });
}

/** Reads a JSON body; a malformed body is a validation error, not a 500. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ValidationError([{ field: "body", message: "Body phải là JSON hợp lệ." }]);
  }
}
