import type { z } from "zod";

import {
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyResetCodeSchema,
} from "@/lib/schemas/auth";
import { hashPassword } from "@/server/auth/password";
import {
  codesMatch,
  generateResetCode,
  generateResetTicket,
  hashResetCode,
  hashResetTicket,
} from "@/server/auth/reset-codes";
import { prisma } from "@/server/db";
import type { SendEmail } from "@/server/email/mailer";
import { ValidationError } from "@/server/errors";

export const RESET_CODE_TTL_MS = 10 * 60_000;
export const RESET_TICKET_TTL_MS = 15 * 60_000;
export const RESET_MAX_ATTEMPTS = 5;
export const RESET_RESEND_COOLDOWN_MS = 60_000;
/**
 * Codes per account per day. Requesting a new code starts a fresh count of 5
 * guesses, so without this cap someone who knows an email could keep guessing.
 * 5 codes x 5 guesses = at most 25 guesses a day against 1,000,000 codes.
 */
export const RESET_MAX_CODES_PER_DAY = 5;
const DAY_MS = 24 * 60 * 60_000;

function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw ValidationError.fromZod(parsed.error);
  }
  return parsed.data;
}

function resetEmail(code: string): { subject: string; text: string; html: string } {
  return {
    subject: "Mã đặt lại mật khẩu Lucky Money",
    text: [
      `Mã đặt lại mật khẩu của bạn là: ${code}`,
      "Mã hết hạn sau 10 phút.",
      "Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.",
    ].join("\n\n"),
    html: [
      "<p>Mã đặt lại mật khẩu của bạn là:</p>",
      `<p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p>`,
      "<p>Mã hết hạn sau 10 phút.</p>",
      "<p>Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.</p>",
    ].join(""),
  };
}

/**
 * Emails a 6-digit code to an account that has a password. Unknown emails,
 * Google-only accounts, requests within the resend cooldown and accounts over
 * the daily cap return silently,
 * so the caller always shows the same answer and cannot learn who is registered.
 * A failed send is logged, not thrown, for the same reason.
 */
export async function requestPasswordReset(
  input: unknown,
  now: Date,
  send: SendEmail,
): Promise<void> {
  const { email } = parse(forgotPasswordSchema, input);
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true },
  });
  if (!user?.passwordHash) {
    return;
  }
  const dayAgo = new Date(now.getTime() - DAY_MS);
  const recent = await prisma.passwordReset.findMany({
    where: { userId: user.id, createdAt: { gt: dayAgo } },
    select: { createdAt: true },
  });
  const cooldownStart = now.getTime() - RESET_RESEND_COOLDOWN_MS;
  if (
    recent.length >= RESET_MAX_CODES_PER_DAY ||
    recent.some((row) => row.createdAt.getTime() > cooldownStart)
  ) {
    return;
  }

  const code = generateResetCode();
  await prisma.$transaction(async (tx) => {
    // Rows from the last day stay, expired, so the daily cap can count them.
    await tx.passwordReset.deleteMany({ where: { userId: user.id, createdAt: { lte: dayAgo } } });
    // A new code replaces any earlier code or ticket.
    await tx.passwordReset.updateMany({
      where: { userId: user.id },
      data: { expiresAt: now, ticketExpiresAt: now },
    });
    const row = await tx.passwordReset.create({
      data: {
        userId: user.id,
        codeHash: "",
        expiresAt: new Date(now.getTime() + RESET_CODE_TTL_MS),
        createdAt: now,
      },
      select: { id: true },
    });
    await tx.passwordReset.update({
      where: { id: row.id },
      data: { codeHash: hashResetCode(row.id, code) },
    });
  });

  try {
    await send({ to: user.email, ...resetEmail(code) });
  } catch (error) {
    console.error("[password-reset] could not send the code email", error);
  }
}

/**
 * Checks a code. Returns a one-time ticket for the reset page, or null when the
 * code is wrong, expired, already used or locked after too many attempts.
 */
export async function verifyResetCode(input: unknown, now: Date): Promise<string | null> {
  const { email, code } = parse(verifyResetCodeSchema, input);
  const row = await prisma.passwordReset.findFirst({
    where: { user: { email }, ticketHash: null, expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
    select: { id: true, codeHash: true },
  });
  if (!row) {
    return null;
  }
  // Count the attempt first, atomically, so parallel guesses cannot exceed the limit.
  const counted = await prisma.passwordReset.updateMany({
    where: { id: row.id, ticketHash: null, attempts: { lt: RESET_MAX_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });
  if (counted.count === 0 || !codesMatch(row.codeHash, hashResetCode(row.id, code))) {
    return null;
  }

  const ticket = generateResetTicket();
  const issued = await prisma.passwordReset.updateMany({
    where: { id: row.id, ticketHash: null },
    data: {
      ticketHash: hashResetTicket(ticket),
      ticketExpiresAt: new Date(now.getTime() + RESET_TICKET_TTL_MS),
    },
  });
  return issued.count === 1 ? ticket : null;
}

async function findTicket(
  ticket: string,
  now: Date,
): Promise<{ id: string; userId: string } | null> {
  return prisma.passwordReset.findFirst({
    where: { ticketHash: hashResetTicket(ticket), ticketExpiresAt: { gt: now } },
    select: { id: true, userId: true },
  });
}

export async function isResetTicketValid(ticket: string, now: Date): Promise<boolean> {
  return (await findTicket(ticket, now)) !== null;
}

/**
 * Sets a new password with a ticket from verifyResetCode. The password is
 * validated first (ValidationError); then false means the ticket is unknown,
 * used or expired. On success every reset row of the user is removed.
 */
export async function resetPassword(ticket: string, input: unknown, now: Date): Promise<boolean> {
  const { password } = parse(resetPasswordSchema, input);
  const found = await findTicket(ticket, now);
  if (!found) {
    return false;
  }
  const passwordHash = await hashPassword(password);
  return prisma.$transaction(async (tx) => {
    // Deleting the row consumes the ticket; a parallel use finds nothing to delete.
    const consumed = await tx.passwordReset.deleteMany({ where: { id: found.id } });
    if (consumed.count === 0) {
      return false;
    }
    await tx.user.update({ where: { id: found.userId }, data: { passwordHash } });
    await tx.passwordReset.deleteMany({ where: { userId: found.userId } });
    return true;
  });
}
