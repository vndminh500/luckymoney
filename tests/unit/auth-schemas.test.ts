import { describe, expect, it } from "vitest";

import {
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyResetCodeSchema,
} from "@/lib/schemas/auth";

describe("registerSchema", () => {
  it("normalizes email to trimmed lowercase", () => {
    const result = registerSchema.parse({
      email: "  An.Nguyen@Example.COM ",
      password: "12345678",
    });
    expect(result.email).toBe("an.nguyen@example.com");
  });

  it("treats a blank name as missing", () => {
    expect(registerSchema.parse({ email: "a@b.vn", password: "12345678", name: "   " }).name).toBe(
      undefined,
    );
    expect(registerSchema.parse({ email: "a@b.vn", password: "12345678", name: " An " }).name).toBe(
      "An",
    );
  });

  it.each([
    [{ email: "not-an-email", password: "12345678" }, "email"],
    [{ email: "a@b.vn", password: "1234567" }, "password"],
    [{ email: "a@b.vn", password: "x".repeat(129) }, "password"],
    [{ email: "a@b.vn", password: "12345678", name: "x".repeat(101) }, "name"],
    [{ password: "12345678" }, "email"],
  ])("rejects %j on field %s", (input, field) => {
    const result = registerSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toContain(field);
  });

  it("accepts exactly the minimum password length", () => {
    expect(registerSchema.safeParse({ email: "a@b.vn", password: "12345678" }).success).toBe(true);
  });
});

describe("loginSchema", () => {
  it("does not apply the registration length rule (old passwords still work)", () => {
    expect(loginSchema.safeParse({ email: "a@b.vn", password: "short" }).success).toBe(true);
  });

  it("rejects an empty password", () => {
    expect(loginSchema.safeParse({ email: "a@b.vn", password: "" }).success).toBe(false);
  });
});

describe("verifyResetCodeSchema", () => {
  it("accepts a 6-digit code with spaces", () => {
    expect(verifyResetCodeSchema.parse({ email: "An@Example.com ", code: "123 456" })).toEqual({
      email: "an@example.com",
      code: "123456",
    });
  });

  it("rejects codes that are not 6 digits", () => {
    for (const code of ["12345", "1234567", "12a456", ""]) {
      expect(verifyResetCodeSchema.safeParse({ email: "a@b.co", code }).success).toBe(false);
    }
  });
});

describe("resetPasswordSchema", () => {
  it("reports a mismatched confirmation on confirmPassword", () => {
    const result = resetPasswordSchema.safeParse({
      password: "mat-khau-moi-1",
      confirmPassword: "khac-hoan-toan",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      path: ["confirmPassword"],
      message: "Mật khẩu xác nhận không khớp.",
    });
  });

  it("applies the register password length rules", () => {
    expect(
      resetPasswordSchema.safeParse({ password: "ngan", confirmPassword: "ngan" }).success,
    ).toBe(false);
  });
});
