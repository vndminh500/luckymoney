import { timingSafeEqual } from "node:crypto";

import { sendDebtReminders } from "@/server/debts/reminders";
import { sendEmail } from "@/server/email/mailer";
import { errorResponse } from "@/server/http";
import { deleteExpiredRateLimits } from "@/server/rate-limit";
import { UnauthenticatedError } from "@/server/errors";

/** Constant-time check of "Authorization: Bearer <CRON_SECRET>"; no secret configured = refused. */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * GET /api/cron/debt-reminders: the daily debt reminder emails, plus removing
 * expired rate-limit counters. Called by
 * Vercel Cron (vercel.json), which sends the CRON_SECRET as a bearer token.
 * Not a user endpoint: a signed-in session does not grant access.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    if (!authorized(request)) {
      throw new UnauthenticatedError("Thiếu hoặc sai CRON_SECRET.");
    }
    const now = new Date();
    const reminders = await sendDebtReminders(now, sendEmail);
    // Daily housekeeping rides on the one cron job the Hobby plan allows.
    const rateLimitsDeleted = await deleteExpiredRateLimits(now);
    return Response.json({ ...reminders, rateLimitsDeleted });
  } catch (error) {
    return errorResponse(error);
  }
}
