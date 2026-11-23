import type { z } from "zod";

/** Error codes and HTTP statuses from docs/api.md. */
export type ErrorCode =
  "VALIDATION_ERROR" | "UNAUTHENTICATED" | "NOT_FOUND" | "CONFLICT" | "RATE_LIMITED" | "INTERNAL";

export type FieldError = { field: string; message: string };

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(readonly details: FieldError[]) {
    super("VALIDATION_ERROR", 400, "Dữ liệu không hợp lệ.");
  }

  static fromZod(error: z.ZodError): ValidationError {
    return new ValidationError(
      error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })),
    );
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = "Bạn cần đăng nhập.") {
    super("UNAUTHENTICATED", 401, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Không tìm thấy.") {
    super("NOT_FOUND", 404, message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super("CONFLICT", 409, message);
  }
}
