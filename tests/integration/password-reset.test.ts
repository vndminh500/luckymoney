import { describe, expect, it, vi } from "vitest";

import {
  isResetTicketValid,
  requestPasswordReset,
  resetPassword,
  verifyResetCode,
} from "@/server/auth/password-reset";
import { registerUser, verifyCredentials } from "@/server/auth/users";
import { prisma } from "@/server/db";
import type { Email, SendEmail } from "@/server/email/mailer";
import { ValidationError } from "@/server/errors";

const NOW = new Date("2026-11-25T03:00:00Z");
const OLD_PASSWORD = "mat-khau-cu-123";
const NEW_PASSWORD = "mat-khau-moi-456";

const later = (ms: number): Date => new Date(NOW.getTime() + ms);

function mailbox(): { send: SendEmail & ReturnType<typeof vi.fn>; lastCode: () => string } {
  const send = vi.fn<SendEmail>(async () => undefined);
  const lastCode = (): string => {
    const email = send.mock.calls.at(-1)?.[0] as Email | undefined;
    const match = email?.text.match(/\b(\d{6})\b/);
    if (!match) throw new Error("no code was sent");
    return match[1];
  };
  return { send, lastCode };
}

async function createUser(email = "an@example.com"): Promise<void> {
  await registerUser({ email, password: OLD_PASSWORD });
}

/** Requests a code for `email` and returns the ticket from entering it. */
async function ticketFor(email = "an@example.com", now = NOW): Promise<string> {
  const { send, lastCode } = mailbox();
  await requestPasswordReset({ email }, now, send);
  const ticket = await verifyResetCode({ email, code: lastCode() }, now);
  if (!ticket) throw new Error("expected a ticket");
  return ticket;
}

/** A 6-digit code that is not `code`. */
const wrongCode = (code: string): string => (code === "000000" ? "111111" : "000000");

describe("requestPasswordReset", () => {
  it("sends a code to an account with a password and stores only its hash", async () => {
    await createUser();
    const { send, lastCode } = mailbox();

    await requestPasswordReset({ email: "An@Example.com" }, NOW, send);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({
      to: "an@example.com",
      subject: "Mã đặt lại mật khẩu Lucky Money",
    });
    const rows = await prisma.passwordReset.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].codeHash).not.toContain(lastCode());
  });

  it("stays silent for unknown emails and Google-only accounts", async () => {
    await prisma.user.create({ data: { email: "google@example.com" } });
    const { send } = mailbox();

    await requestPasswordReset({ email: "nobody@example.com" }, NOW, send);
    await requestPasswordReset({ email: "google@example.com" }, NOW, send);

    expect(send).not.toHaveBeenCalled();
    expect(await prisma.passwordReset.count()).toBe(0);
  });

  it("rejects a malformed email", async () => {
    await expect(requestPasswordReset({ email: "khong-phai-email" }, NOW, vi.fn())).rejects.toThrow(
      ValidationError,
    );
  });

  it("does not resend within 60 seconds, and a new code replaces the old one", async () => {
    await createUser();
    const { send, lastCode } = mailbox();

    await requestPasswordReset({ email: "an@example.com" }, NOW, send);
    const first = lastCode();
    await requestPasswordReset({ email: "an@example.com" }, later(30_000), send);
    expect(send).toHaveBeenCalledTimes(1);

    await requestPasswordReset({ email: "an@example.com" }, later(61_000), send);
    expect(send).toHaveBeenCalledTimes(2);
    const second = lastCode();
    if (first !== second) {
      expect(await verifyResetCode({ email: "an@example.com", code: first }, later(62_000))).toBe(
        null,
      );
    }
    expect(await verifyResetCode({ email: "an@example.com", code: second }, later(62_000))).toEqual(
      expect.any(String),
    );
  });

  it("sends at most 5 codes per account in 24 hours", async () => {
    await createUser();
    const { send } = mailbox();

    for (let i = 0; i < 6; i++) {
      await requestPasswordReset({ email: "an@example.com" }, later(i * 61_000), send);
    }
    expect(send).toHaveBeenCalledTimes(5);

    await requestPasswordReset({ email: "an@example.com" }, later(24 * 60 * 60_000 + 1), send);
    expect(send).toHaveBeenCalledTimes(6);
  });

  it("allows at most 25 wrong guesses per account in 24 hours", async () => {
    await createUser();
    let wrongGuesses = 0;
    for (let i = 0; i < 8; i++) {
      const { send, lastCode } = mailbox();
      const at = later(i * 61_000);
      await requestPasswordReset({ email: "an@example.com" }, at, send);
      if (send.mock.calls.length === 0) continue;
      for (let j = 0; j < 5; j++) {
        await verifyResetCode({ email: "an@example.com", code: wrongCode(lastCode()) }, at);
        wrongGuesses++;
      }
    }
    expect(wrongGuesses).toBe(25);
  });

  it("swallows send failures so the answer stays the same", async () => {
    await createUser();
    const send = vi.fn<SendEmail>(async () => {
      throw new Error("SMTP down");
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(requestPasswordReset({ email: "an@example.com" }, NOW, send)).resolves.toBe(
      undefined,
    );
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});

describe("verifyResetCode", () => {
  it("accepts the right code once", async () => {
    await createUser();
    const { send, lastCode } = mailbox();
    await requestPasswordReset({ email: "an@example.com" }, NOW, send);
    const code = lastCode();

    expect(await verifyResetCode({ email: "an@example.com", code }, NOW)).toEqual(
      expect.any(String),
    );
    expect(await verifyResetCode({ email: "an@example.com", code }, NOW)).toBe(null);
  });

  it("rejects a code after 10 minutes", async () => {
    await createUser();
    const { send, lastCode } = mailbox();
    await requestPasswordReset({ email: "an@example.com" }, NOW, send);

    expect(
      await verifyResetCode({ email: "an@example.com", code: lastCode() }, later(10 * 60_000 + 1)),
    ).toBe(null);
  });

  it("locks the code after 5 wrong attempts", async () => {
    await createUser();
    const { send, lastCode } = mailbox();
    await requestPasswordReset({ email: "an@example.com" }, NOW, send);
    const code = lastCode();

    for (let i = 0; i < 5; i++) {
      expect(await verifyResetCode({ email: "an@example.com", code: wrongCode(code) }, NOW)).toBe(
        null,
      );
    }
    expect(await verifyResetCode({ email: "an@example.com", code }, NOW)).toBe(null);
  });

  it("does not accept user A's code for user B", async () => {
    await createUser("an@example.com");
    await createUser("binh@example.com");
    const a = mailbox();
    const b = mailbox();
    await requestPasswordReset({ email: "an@example.com" }, NOW, a.send);
    await requestPasswordReset({ email: "binh@example.com" }, NOW, b.send);

    if (a.lastCode() !== b.lastCode()) {
      expect(await verifyResetCode({ email: "binh@example.com", code: a.lastCode() }, NOW)).toBe(
        null,
      );
    }
    expect(await verifyResetCode({ email: "binh@example.com", code: b.lastCode() }, NOW)).toEqual(
      expect.any(String),
    );
  });

  it("returns null for an unknown email", async () => {
    expect(await verifyResetCode({ email: "nobody@example.com", code: "123456" }, NOW)).toBe(null);
  });

  it("rejects a malformed code", async () => {
    await expect(verifyResetCode({ email: "an@example.com", code: "12" }, NOW)).rejects.toThrow(
      ValidationError,
    );
  });
});

describe("resetPassword", () => {
  it("changes the password with a valid ticket and clears the reset", async () => {
    await createUser();
    const ticket = await ticketFor();

    expect(
      await resetPassword(ticket, { password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD }, NOW),
    ).toBe(true);

    expect(await verifyCredentials({ email: "an@example.com", password: NEW_PASSWORD })).not.toBe(
      null,
    );
    expect(await verifyCredentials({ email: "an@example.com", password: OLD_PASSWORD })).toBe(null);
    expect(await prisma.passwordReset.count()).toBe(0);
  });

  it("rejects a ticket that was already used", async () => {
    await createUser();
    const ticket = await ticketFor();
    const input = { password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD };
    await resetPassword(ticket, input, NOW);

    expect(await resetPassword(ticket, { ...input }, NOW)).toBe(false);
  });

  it("rejects a ticket after 15 minutes and keeps the old password", async () => {
    await createUser();
    const ticket = await ticketFor();

    expect(
      await resetPassword(
        ticket,
        { password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD },
        later(15 * 60_000 + 1),
      ),
    ).toBe(false);
    expect(await verifyCredentials({ email: "an@example.com", password: OLD_PASSWORD })).not.toBe(
      null,
    );
  });

  it("validates the new password before looking at the ticket", async () => {
    const error = await resetPassword(
      "khong-ton-tai",
      { password: NEW_PASSWORD, confirmPassword: "khac-hoan-toan" },
      NOW,
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).details[0].field).toBe("confirmPassword");
  });
});

describe("isResetTicketValid", () => {
  it("is true for a fresh ticket and false for an unknown or expired one", async () => {
    await createUser();
    const ticket = await ticketFor();

    expect(await isResetTicketValid(ticket, NOW)).toBe(true);
    expect(await isResetTicketValid(ticket, later(15 * 60_000 + 1))).toBe(false);
    expect(await isResetTicketValid("khong-ton-tai", NOW)).toBe(false);
  });
});
