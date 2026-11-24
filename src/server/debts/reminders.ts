import { addDays, formatDateKey, toDateKey, type DateFormat } from "@/lib/dates";
import { scheduleStatus } from "@/lib/debt";
import { formatMoney, type AmountFormat } from "@/lib/money";
import { prisma } from "@/server/db";
import type { SendEmail } from "@/server/email/mailer";

/** An installment is "soon due" from this many days before its due date. */
export const REMIND_DAYS_BEFORE = 3;

type Kind = "upcoming" | "overdue";

type Reminder = {
  installmentId: string;
  kind: Kind;
  counterparty: string;
  direction: "I_OWE" | "THEY_OWE";
  dueDate: string;
  left: number;
  days: number;
};

type UserReminders = {
  email: string;
  amountFormat: AmountFormat;
  dateFormat: DateFormat;
  items: Reminder[];
};

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/**
 * Daily job: one email per user (who left the email on) listing the
 * installments that became overdue and those due within 3 days. Each
 * installment is reminded once per kind; installments are only marked once
 * the email went out, so a failed send is retried on the next run.
 */
export async function sendDebtReminders(
  now: Date,
  send: SendEmail,
): Promise<{ emails: number; installments: number }> {
  // Calendar days differ by at most a day between time zones; filter exactly below.
  const horizon = addDays(toDateKey(now, "UTC"), REMIND_DAYS_BEFORE + 1);
  const debts = await prisma.debt.findMany({
    where: {
      user: { notifyDebtEmail: true },
      installments: {
        some: {
          dueDate: { lte: horizon },
          OR: [{ upcomingRemindedAt: null }, { overdueRemindedAt: null }],
        },
      },
    },
    include: {
      user: {
        select: { id: true, email: true, timeZone: true, amountFormat: true, dateFormat: true },
      },
      installments: true,
      payments: { select: { amount: true } },
    },
  });

  const byUser = new Map<string, UserReminders>();
  for (const debt of debts) {
    const today = toDateKey(now, debt.user.timeZone);
    const status = scheduleStatus(
      debt.installments,
      debt.payments.map((payment) => payment.amount),
      today,
    );
    for (const item of status.installments) {
      const stored = debt.installments.find((installment) => installment.id === item.id);
      if (!stored || item.state === "paid") continue;
      const days = daysBetween(today, item.dueDate);
      let kind: Kind | null = null;
      if (item.state === "overdue" && !stored.overdueRemindedAt) kind = "overdue";
      else if (item.state !== "overdue" && days <= REMIND_DAYS_BEFORE && !stored.upcomingRemindedAt)
        kind = "upcoming";
      if (!kind) continue;

      const entry = byUser.get(debt.user.id) ?? {
        email: debt.user.email,
        amountFormat: debt.user.amountFormat,
        dateFormat: debt.user.dateFormat,
        items: [],
      };
      entry.items.push({
        installmentId: item.id,
        kind,
        counterparty: debt.counterparty,
        direction: debt.direction,
        dueDate: item.dueDate,
        left: item.amount - item.paid,
        days,
      });
      byUser.set(debt.user.id, entry);
    }
  }

  let emails = 0;
  let installments = 0;
  for (const reminders of byUser.values()) {
    try {
      await send({ to: reminders.email, ...composeEmail(reminders) });
    } catch (error) {
      console.error(`[debt-reminders] could not email ${reminders.email}`, error);
      continue;
    }
    emails++;
    for (const kind of ["upcoming", "overdue"] as const) {
      const ids = reminders.items.filter((i) => i.kind === kind).map((i) => i.installmentId);
      if (ids.length === 0) continue;
      await prisma.debtInstallment.updateMany({
        where: { id: { in: ids } },
        data: kind === "overdue" ? { overdueRemindedAt: now } : { upcomingRemindedAt: now },
      });
      installments += ids.length;
    }
  }
  return { emails, installments };
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

function line(item: Reminder, money: (n: number) => string, date: (d: string) => string): string {
  const who =
    item.direction === "I_OWE" ? `Trả ${item.counterparty}` : `Thu từ ${item.counterparty}`;
  const when =
    item.kind === "overdue"
      ? `quá hạn ${-item.days} ngày`
      : item.days === 0
        ? "đến hạn hôm nay"
        : `còn ${item.days} ngày`;
  return `${who}: ${money(item.left)}, hạn ${date(item.dueDate)} (${when})`;
}

function composeEmail(reminders: UserReminders): { subject: string; text: string; html: string } {
  const money = (amount: number) => formatMoney(amount, reminders.amountFormat);
  const date = (key: string) => formatDateKey(key, reminders.dateFormat);
  const overdue = reminders.items.filter((i) => i.kind === "overdue");
  const upcoming = reminders.items.filter((i) => i.kind === "upcoming");
  const parts = [
    overdue.length ? `${overdue.length} kỳ quá hạn` : null,
    upcoming.length ? `${upcoming.length} kỳ sắp đến hạn` : null,
  ].filter(Boolean);
  const subject = `Sổ nợ: ${parts.join(", ")}`;

  const sections: { title: string; items: Reminder[] }[] = [
    { title: "Quá hạn", items: overdue },
    { title: `Sắp đến hạn (trong ${REMIND_DAYS_BEFORE} ngày)`, items: upcoming },
  ].filter((section) => section.items.length > 0);
  const link = `${(process.env.APP_URL || process.env.AUTH_URL || "http://localhost:3000").replace(/\/$/, "")}/debts`;

  const text = [
    "Lucky Money nhắc bạn các kỳ trả nợ:",
    ...sections.flatMap((section) => [
      "",
      `${section.title}:`,
      ...section.items.map((item) => `- ${line(item, money, date)}`),
    ]),
    "",
    `Xem sổ nợ: ${link}`,
    "Tắt email này trong Cài đặt > Thông báo.",
  ].join("\n");

  const html = `<div style="font-family:Roboto,Arial,sans-serif;font-size:16px;color:#062b45">
<p>Lucky Money nhắc bạn các kỳ trả nợ:</p>
${sections
  .map(
    (section) => `<h3 style="margin:16px 0 4px">${escapeHtml(section.title)}</h3>
<ul>${section.items.map((item) => `<li>${escapeHtml(line(item, money, date))}</li>`).join("")}</ul>`,
  )
  .join("\n")}
<p><a href="${escapeHtml(link)}" style="color:#0b6fb3">Xem sổ nợ</a></p>
<p style="color:#3d6680;font-size:14px">Tắt email này trong Cài đặt &gt; Thông báo.</p>
</div>`;

  return { subject, text, html };
}
