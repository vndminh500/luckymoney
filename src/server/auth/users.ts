import { Prisma } from "@prisma/client";

import { loginSchema, registerSchema } from "@/lib/schemas/auth";
import { burnPasswordCheck, hashPassword, verifyPassword } from "@/server/auth/password";
import { createDefaultCategories } from "@/server/categories/defaults";
import { prisma } from "@/server/db";
import { ConflictError, ValidationError } from "@/server/errors";
import { enforceRateLimit, RATE_LIMITS } from "@/server/rate-limit";

/** User fields that are safe to return to clients (never the password hash). */
export type PublicUser = { id: string; email: string; name: string | null; createdAt: Date };

const publicUserSelect = { id: true, email: true, name: true, createdAt: true } as const;

/** Creates a user with a hashed password and the default categories, atomically. */
export async function registerUser(input: unknown): Promise<PublicUser> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    throw ValidationError.fromZod(parsed.error);
  }
  const { email, password, name } = parsed.data;
  const passwordHash = await hashPassword(password);

  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, name, passwordHash },
        select: publicUserSelect,
      });
      await createDefaultCategories(tx, user.id);
      return user;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError("Email này đã được đăng ký.");
    }
    throw error;
  }
}

export type AuthenticatedUser = { id: string; email: string; name: string | null };

/** Checks email + password. Returns null for any failure, without saying which part was wrong. */
export async function verifyCredentials(input: unknown): Promise<AuthenticatedUser | null> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return null;
  }
  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, passwordHash: true },
  });
  if (!user) {
    // Unknown email: same cost and answer as a wrong password.
    await burnPasswordCheck(password);
    return null;
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    return null;
  }
  return { id: user.id, email: user.email, name: user.name };
}

/**
 * Sign-in entry point: counts the attempt against the per-IP and per-email
 * limits (throws RateLimitedError past them), then checks the credentials.
 */
export async function authenticate(
  input: unknown,
  ip: string,
  now: Date = new Date(),
): Promise<AuthenticatedUser | null> {
  await enforceRateLimit(RATE_LIMITS.loginPerIp, ip, now);
  const parsed = loginSchema.safeParse(input);
  if (parsed.success) {
    await enforceRateLimit(RATE_LIMITS.loginPerEmail, parsed.data.email, now);
  }
  return verifyCredentials(input);
}
