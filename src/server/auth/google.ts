import { Prisma } from "@prisma/client";
import { z } from "zod";

import { createDefaultCategories } from "@/server/categories/defaults";
import { prisma } from "@/server/db";

const GOOGLE = "google";

/** The Google profile fields we rely on. Only verified emails are accepted. */
const googleProfileSchema = z.object({
  sub: z.string().min(1),
  email: z.string().trim().toLowerCase().pipe(z.email()),
  email_verified: z.literal(true),
  name: z.string().trim().max(100).nullish(),
});

export type GoogleSignInResult =
  { ok: true; userId: string } | { ok: false; reason: "EMAIL_NOT_VERIFIED" | "ACCOUNT_NOT_LINKED" };

/**
 * Finds or creates the user for a Google sign-in:
 * 1. Google account already linked -> that user (even if the Google email changed).
 * 2. Email belongs to a user without a password -> link Google to that user.
 * 3. Email belongs to a password account -> refuse. v1 does not verify emails on
 *    sign-up, so that account may have been created by someone else ("pre-account
 *    takeover"); linking would hand them the Google user's data.
 * 4. New email -> create the user, its default categories and the link.
 */
export async function resolveGoogleUser(profile: unknown): Promise<GoogleSignInResult> {
  const parsed = googleProfileSchema.safeParse(profile);
  if (!parsed.success) {
    return { ok: false, reason: "EMAIL_NOT_VERIFIED" };
  }
  try {
    return await linkOrCreate(parsed.data);
  } catch (error) {
    // Two simultaneous first sign-ins: the other request created the link first.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return linkOrCreate(parsed.data);
    }
    throw error;
  }
}

async function linkOrCreate({
  sub,
  email,
  name,
}: z.infer<typeof googleProfileSchema>): Promise<GoogleSignInResult> {
  const linkedUserId = await findUserIdByAccount(GOOGLE, sub);
  if (linkedUserId) {
    return { ok: true, userId: linkedUserId };
  }

  const account = { type: "oidc", provider: GOOGLE, providerAccountId: sub };
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  if (existing) {
    if (existing.passwordHash) {
      return { ok: false, reason: "ACCOUNT_NOT_LINKED" };
    }
    await prisma.account.create({ data: { ...account, userId: existing.id } });
    return { ok: true, userId: existing.id };
  }

  const userId = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, name: name || null, passwordHash: null, accounts: { create: account } },
      select: { id: true },
    });
    await createDefaultCategories(tx, user.id);
    return user.id;
  });
  return { ok: true, userId };
}

export async function findUserIdByAccount(
  provider: string,
  providerAccountId: string,
): Promise<string | null> {
  const account = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId } },
    select: { userId: true },
  });
  return account?.userId ?? null;
}
