import { timingSafeEqual } from "node:crypto";

import { sendDebtReminders } from "@/server/debts/reminders";
import { sendEmail } from "@/server/email/mailer";
import { errorResponse } from "@/server/http";
import { prisma } from "@/server/db";
import { resetDemoAccount } from "@/server/demo/demo-account";
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
 * expired rate-limit counters and (DEMO_ACCOUNT_RESET=true) resetting the demo account. Called by
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
    // The public demo account goes back to clean sample data every day (opt-in).
    const demoReset = process.env.DEMO_ACCOUNT_RESET === "true";
    if (demoReset) await resetDemoAccount(prisma, now);
    return Response.json({ ...reminders, rateLimitsDeleted, demoReset });
  } catch (error) {
    return errorResponse(error);
  }
}
