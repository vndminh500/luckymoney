import { describe, expect, it } from "vitest";

import { POST as registerRoute } from "@/app/api/auth/register/route";
import { registerUser, verifyCredentials } from "@/server/auth/users";
import { DEFAULT_CATEGORIES } from "@/server/categories/defaults";
import { prisma } from "@/server/db";
import { ConflictError, ValidationError } from "@/server/errors";

const validInput = { email: "an@example.com", password: "mat-khau-an-toan", name: "An" };

function postJson(body: unknown): Request {
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("registerUser", () => {
  it("creates the user with a hashed password and returns no hash", async () => {
    const user = await registerUser(validInput);

    expect(user).toEqual({
      id: expect.any(String),
      email: "an@example.com",
      name: "An",
      createdAt: expect.any(Date),
    });
    expect(user).not.toHaveProperty("passwordHash");

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.passwordHash).toMatch(/^scrypt\$/);
    expect(stored.passwordHash).not.toContain(validInput.password);
  });

  it("creates the default categories for the new user only", async () => {
    const other = await registerUser({ ...validInput, email: "binh@example.com" });
    const user = await registerUser(validInput);

    const categories = await prisma.category.findMany({
      where: { userId: user.id },
      select: { name: true, type: true },
    });
    expect(categories).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(categories).toEqual(
      expect.arrayContaining([
        { name: "Ăn uống", type: "EXPENSE" },
        { name: "Khác", type: "EXPENSE" },
        { name: "Lương", type: "INCOME" },
        { name: "Khác", type: "INCOME" },
      ]),
    );
    expect(await prisma.category.count({ where: { userId: other.id } })).toBe(
      DEFAULT_CATEGORIES.length,
    );
  });

  it("rejects a duplicate email regardless of case, without partial data", async () => {
    await registerUser(validInput);

    await expect(registerUser({ ...validInput, email: " AN@Example.com " })).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.category.count()).toBe(DEFAULT_CATEGORIES.length);
  });

  it("validates input and reports the failing fields", async () => {
    const error = await registerUser({ email: "bad", password: "short" }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).details.map((detail) => detail.field).sort()).toEqual([
      "email",
      "password",
    ]);
    expect(await prisma.user.count()).toBe(0);
  });
});

describe("verifyCredentials", () => {
  it("returns the user for the right email and password", async () => {
    const user = await registerUser(validInput);

    await expect(
      verifyCredentials({ email: "AN@example.com", password: validInput.password }),
    ).resolves.toEqual({ id: user.id, email: "an@example.com", name: "An" });
  });

  it.each([
    ["wrong password", { email: "an@example.com", password: "wrong-password" }],
    ["unknown email", { email: "nobody@example.com", password: "mat-khau-an-toan" }],
    ["malformed input", { email: "an@example.com" }],
    ["non-object input", "an@example.com"],
  ])("returns null for %s", async (_case, input) => {
    await registerUser(validInput);
    await expect(verifyCredentials(input)).resolves.toBeNull();
  });
});

describe("POST /api/auth/register", () => {
  it("returns 201 with the public user", async () => {
    const response = await registerRoute(postJson(validInput));

    expect(response.status).toBe(201);
    const body: Record<string, unknown> = await response.json();
    expect(body).toMatchObject({ email: "an@example.com", name: "An" });
    expect(body).not.toHaveProperty("passwordHash");
  });

  it("returns 400 VALIDATION_ERROR with field details", async () => {
    const response = await registerRoute(postJson({ email: "bad", password: "short" }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("VALIDATION_ERROR");
    expect(body.details).toEqual(
      expect.arrayContaining([
        { field: "email", message: expect.any(String) },
        { field: "password", message: expect.any(String) },
      ]),
    );
  });

  it("returns 400 for a malformed JSON body", async () => {
    const response = await registerRoute(postJson("{not json"));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("VALIDATION_ERROR");
  });

  it("returns 409 CONFLICT for an existing email", async () => {
    await registerUser(validInput);
    const response = await registerRoute(postJson(validInput));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "CONFLICT", message: expect.any(String) });
  });
});
