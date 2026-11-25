import { describe, expect, it } from "vitest";

import { changePassword } from "@/server/account/service";
import { registerUser, verifyCredentials } from "@/server/auth/users";
import { prisma } from "@/server/db";
import { listDebts } from "@/server/debts/service";
import {
  buildDemoData,
  DEMO_EMAIL,
  DEMO_PASSWORD,
  resetDemoAccount,
} from "@/server/demo/demo-account";
import { ValidationError } from "@/server/errors";
import { listJars } from "@/server/savings/service";
import { listTransactions } from "@/server/transactions/service";

// 10:30 on 2026-11-25 in Vietnam.
const NOW = new Date("2026-11-25T03:30:00Z");
const TODAY = "2026-11-25";

describe("buildDemoData", () => {
  const data = buildDemoData(TODAY);

  it("is the same for the same day", () => {
    expect(buildDemoData(TODAY)).toEqual(data);
  });

  it("covers six months up to today with whole, positive VND amounts", () => {
    const days = data.transactions.map((item) => item.dateKey).sort();
    expect(days[0]).toBe("2026-06-01");
    expect(days.at(-1)).toBe(TODAY);
    for (const item of data.transactions) {
      expect(Number.isInteger(item.amount) && item.amount > 0).toBe(true);
    }
    const months = new Set(days.map((day) => day.slice(0, 7)));
    expect(months.size).toBe(6);
    // Income and spending in every month, so every dashboard month has both.
    for (const month of months) {
      const inMonth = data.transactions.filter((item) => item.dateKey.startsWith(month));
      expect(inMonth.some((item) => item.type === "INCOME")).toBe(true);
      expect(inMonth.some((item) => item.type === "EXPENSE")).toBe(true);
    }
  });

  it("never withdraws more than a jar holds", () => {
    for (const jar of data.jars) {
      let balance = 0;
      for (const entry of [...jar.entries].sort((a, b) =>
        a.occurredOn.localeCompare(b.occurredOn),
      )) {
        balance += entry.kind === "DEPOSIT" ? entry.amount : -entry.amount;
        expect(balance).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("resetDemoAccount", () => {
  it("creates a demo account that signs in and has data on every page", async () => {
    await resetDemoAccount(prisma, NOW);

    const user = await verifyCredentials({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
    expect(user).toMatchObject({ email: DEMO_EMAIL });
    const userId = user!.id;

    const thisMonth = await listTransactions(userId, { month: "2026-11" });
    expect(thisMonth.total).toBeGreaterThan(20);
    // Nothing later than "now" today.
    expect(await prisma.transaction.count({ where: { userId, occurredAt: { gt: NOW } } })).toBe(0);

    expect(await prisma.budget.count({ where: { userId, month: "2026-11" } })).toBe(4);

    const { debts, totals } = await listDebts(userId, TODAY);
    expect(debts).toHaveLength(3);
    expect(totals.overdueCount).toBe(1);
    expect(debts.filter((debt) => debt.status.settled)).toHaveLength(1);

    const { jars, total } = await listJars(userId);
    expect(jars.map((jar) => jar.name).sort()).toEqual(["Du lịch Đà Lạt", "Quỹ khẩn cấp"]);
    expect(total).toBe(6 * 2_000_000 + 2_000_000);
  });

  it("replaces the demo data on every run and leaves other users alone", async () => {
    const other = await registerUser({ email: "an@example.com", password: "mat-khau-an-toan" });
    await resetDemoAccount(prisma, NOW);
    const first = await prisma.user.findUniqueOrThrow({ where: { email: DEMO_EMAIL } });
    const count = await prisma.transaction.count({ where: { userId: first.id } });

    await resetDemoAccount(prisma, NOW);

    const second = await prisma.user.findUniqueOrThrow({ where: { email: DEMO_EMAIL } });
    expect(second.id).not.toBe(first.id);
    expect(await prisma.transaction.count({ where: { userId: second.id } })).toBe(count);
    expect(await prisma.transaction.count()).toBe(count);
    expect(await prisma.user.count()).toBe(2);
    await expect(prisma.user.findUnique({ where: { id: other.id } })).resolves.not.toBeNull();
  });

  it("does not let a visitor change the shared demo password", async () => {
    await resetDemoAccount(prisma, NOW);
    const { id } = await prisma.user.findUniqueOrThrow({ where: { email: DEMO_EMAIL } });

    await expect(
      changePassword(id, {
        currentPassword: DEMO_PASSWORD,
        newPassword: "chiem-tai-khoan",
        confirmPassword: "chiem-tai-khoan",
      }),
    ).rejects.toThrow(ValidationError);
    await expect(
      verifyCredentials({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
    ).resolves.not.toBeNull();
  });
});
