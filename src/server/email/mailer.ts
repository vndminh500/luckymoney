import { createTransport, type Transporter } from "nodemailer";

export type Email = { to: string; subject: string; text: string; html: string };

export type SendEmail = (email: Email) => Promise<void>;

let transport: Transporter | null = null;

/**
 * Sends through SMTP_URL (e.g. "smtps://user:app-password@smtp.gmail.com:465").
 * Without SMTP_URL, outside production, the email is logged instead so the
 * reminders can be tried locally; in production a missing SMTP_URL is an error.
 */
export const sendEmail: SendEmail = async (email) => {
  const url = process.env.SMTP_URL;
  if (!url) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SMTP_URL is not set: cannot send email.");
    }
    console.info(`[email] to ${email.to}: ${email.subject}\n${email.text}`);
    return;
  }
  transport ??= createTransport(url);
  await transport.sendMail({
    from: process.env.EMAIL_FROM || "Lucky Money <no-reply@luckymoney.local>",
    ...email,
  });
};
