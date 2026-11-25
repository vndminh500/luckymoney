import type { Email, SendEmail } from "@/server/email/mailer";

/** Runs a task after the response is sent, e.g. Next.js' `after`. */
export type Schedule = (task: () => Promise<void>) => void;

/**
 * Wraps `send` so the caller does not wait for SMTP: the email goes out in a
 * scheduled task and a failure is only logged. Used where the answer must not
 * depend on the email (a hanging or slow SMTP server, or timing that would
 * reveal whether an account exists).
 */
export function sendInBackground(send: SendEmail, schedule: Schedule): SendEmail {
  return async (email: Email) => {
    schedule(async () => {
      try {
        await send(email);
      } catch (error) {
        console.error(`[email] could not send "${email.subject}"`, error);
      }
    });
  };
}
