import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as cron } from "@/app/api/cron/debt-reminders/route";
import { registerUser } from "@/server/auth/users";
import { prisma } from "@/server/db";
import { sendDebtReminders } from "@/server/debts/reminders";
import { addPayment, createDebt } from "@/server/debts/service";
import type { Email } from "@/server/email/mailer";

let aliceId: string;
let sent: Email[];
const send = async (email: Email) => {
  sent.push(email);
};

/** 08:00 on 2026-11-24 in Vietnam. */
const NOW = new Date("2026-11-24T01:00:00Z");

function debt(counterparty: string, installments: { dueDate: string; amount: number }[]) {
  return {
    direction: "I_OWE",
    counterparty,
    principal: installments.reduce((sum, item) => sum + item.amount, 0),
    startDate: "2026-09-01",
    installments,
  };
}

beforeEach(async () => {
  sent = [];
  aliceId = (await registerUser({ email: "alice@example.com", password: "mat-khau-an-toan" })).id;
});

describe("sendDebtReminders", () => {
  it("sends one email per user with the overdue and the soon-due installments", async () => {
    await createDebt(aliceId, debt("Anh Hùng", [{ dueDate: "2026-11-20", amount: 1_000_000 }]));
    await createDebt(aliceId, {
      ...debt("Lan", [{ dueDate: "2026-11-27", amount: 500_000 }]),
      direction: "THEY_OWE",
    });
    // Too far away, and not yet due: no reminder.
    await createDebt(aliceId, debt("Minh", [{ dueDate: "2026-12-10", amount: 200_000 }]));

    const result = await sendDebtReminders(NOW, send);

    expect(result).toEqual({ emails: 1, installments: 2 });
    expect(sent).toHaveLength(1);
    const [email] = sent;
    expect(email.to).toBe("alice@example.com");
    expect(email.subject).toBe("Sổ nợ: 1 kỳ quá hạn, 1 kỳ sắp đến hạn");
    expect(email.text).toContain("Anh Hùng");
    expect(email.text).toContain("1.000.000");
    expect(email.text).toContain("quá hạn 4 ngày");
    expect(email.text).toContain("Lan");
    expect(email.text).toContain("còn 3 ngày");
    expect(email.text).not.toContain("Minh");
    expect(email.html).toContain("Anh Hùng");
  });

  it("reminds each installment once per kind", async () => {
    await createDebt(aliceId, debt("Anh Hùng", [{ dueDate: "2026-11-25", amount: 1_000_000 }]));

    await sendDebtReminders(NOW, send);
    await sendDebtReminders(NOW, send);
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toBe("Sổ nợ: 1 kỳ sắp đến hạn");

    // Two days later it is overdue: one more reminder, then nothing.
    const later = new Date("2026-11-26T01:00:00Z");
    await sendDebtReminders(later, send);
    await sendDebtReminders(later, send);
    expect(sent).toHaveLength(2);
    expect(sent[1].subject).toBe("Sổ nợ: 1 kỳ quá hạn");
  });

  it("is due today in the user's time zone, not in UTC", async () => {
    await prisma.user.update({ where: { id: aliceId }, data: { timeZone: "Asia/Ho_Chi_Minh" } });
    await createDebt(aliceId, debt("Anh Hùng", [{ dueDate: "2026-11-24", amount: 1_000 }]));
    // 23:30 UTC on the 23rd is already the 24th in Vietnam: due today, not overdue.
    await sendDebtReminders(new Date("2026-11-23T23:30:00Z"), send);
    expect(sent[0].text).toContain("đến hạn hôm nay");
  });

  it("skips paid installments and users who turned the email off", async () => {
    const { id } = await createDebt(
      aliceId,
      debt("Anh Hùng", [
        { dueDate: "2026-11-10", amount: 1_000_000 },
        { dueDate: "2026-11-25", amount: 1_000_000 },
      ]),
    );
    await addPayment(aliceId, id, { amount: 1_000_000, paidOn: "2026-11-09" });
    await sendDebtReminders(NOW, send);
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toBe("Sổ nợ: 1 kỳ sắp đến hạn");

    const bobId = (await registerUser({ email: "bob@example.com", password: "mat-khau-an-toan" }))
      .id;
    await prisma.user.update({ where: { id: bobId }, data: { notifyDebtEmail: false } });
    await createDebt(bobId, debt("Chú Tư", [{ dueDate: "2026-11-01", amount: 1_000 }]));
    await sendDebtReminders(NOW, send);
    expect(sent.map((email) => email.to)).not.toContain("bob@example.com");
  });

  it("does not mark installments when sending fails, so the next run retries", async () => {
    await createDebt(aliceId, debt("Anh Hùng", [{ dueDate: "2026-11-20", amount: 1_000 }]));
    const failing = async () => {
      throw new Error("SMTP down");
    };
    await expect(sendDebtReminders(NOW, failing)).resolves.toEqual({
      emails: 0,
      installments: 0,
    });
    await sendDebtReminders(NOW, send);
    expect(sent).toHaveLength(1);
  });
});

describe("GET /api/cron/debt-reminders", () => {
  const call = (authorization?: string) =>
    cron(
      new Request("http://localhost/api/cron/debt-reminders", {
        headers: authorization ? { authorization } : {},
      }),
    );

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("refuses every call while CRON_SECRET is not set", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call("Bearer ")).status).toBe(401);
  });

  it("refuses a wrong secret and runs with the right one", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret-value");
    vi.stubEnv("SMTP_URL", "");
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    await createDebt(aliceId, debt("Anh Hùng", [{ dueDate: "2026-01-01", amount: 1_000 }]));

    expect((await call("Bearer wrong-value")).status).toBe(401);
    expect((await call()).status).toBe(401);

    const response = await call("Bearer s3cret-value");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ emails: 1, installments: 1 });
  });
});
