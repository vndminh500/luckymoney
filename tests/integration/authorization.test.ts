/**
 * T11: user A can never read, change or delete user B's data, through any API
 * endpoint or server action. The session is the only thing mocked: every
 * handler and action runs for real against the test database.
 */
import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ userId: null as string | null }));

vi.mock("@/server/auth/session", async () => {
  const { UnauthenticatedError } = await import("@/server/errors");
  return {
    requireUserId: async () => {
      if (!session.userId) {
        throw new UnauthenticatedError();
      }
      return session.userId;
    },
  };
});

import * as budgetRoute from "@/app/api/budgets/[id]/route";
import * as budgetsRoute from "@/app/api/budgets/route";
import * as accountActions from "@/app/(app)/account/actions";
import * as budgetActions from "@/app/(app)/budgets/actions";
import * as accountAvatarRoute from "@/app/api/account/avatar/route";
import * as categoryActions from "@/app/(app)/categories/actions";
import * as settingsActions from "@/app/(app)/settings/actions";
import * as transactionActions from "@/app/(app)/transactions/actions";
import * as categoryRoute from "@/app/api/categories/[id]/route";
import * as categoriesRoute from "@/app/api/categories/route";
import * as statsByCategoryRoute from "@/app/api/stats/by-category/route";
import * as statsDailyRoute from "@/app/api/stats/daily/route";
import * as statsPeriodRoute from "@/app/api/stats/period/route";
import * as statsSummaryRoute from "@/app/api/stats/summary/route";
import * as transactionRoute from "@/app/api/transactions/[id]/route";
import * as transactionsRoute from "@/app/api/transactions/route";
import { prisma } from "@/server/db";

import { createUserWithCategories, type UserFixture } from "./fixtures";

let alice: UserFixture;
let bob: UserFixture;
/** Bob's transaction: the target of every attack below. */
let bobTx: string;
/** Bob's budget for the same month. */
let bobBudget: string;

const signInAs = (user: UserFixture | null) => {
  session.userId = user?.userId ?? null;
};

function request(method: string, path: string, body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const context = (id: string) => ({ params: Promise.resolve({ id }) });

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }
  return data;
}

/** Bob's rows exactly as they are in the database, to prove nothing changed. */
async function bobSnapshot() {
  const [transactions, categories, budgets, avatar] = await Promise.all([
    prisma.transaction.findMany({ where: { userId: bob.userId }, orderBy: { id: "asc" } }),
    prisma.category.findMany({ where: { userId: bob.userId }, orderBy: { id: "asc" } }),
    prisma.budget.findMany({ where: { userId: bob.userId }, orderBy: { id: "asc" } }),
    prisma.userAvatar.findUnique({ where: { userId: bob.userId } }),
  ]);
  return { transactions, categories, budgets, avatar };
}

/** Next.js' notFound() throws an error whose digest marks a 404. */
async function expectNotFound(promise: Promise<unknown>): Promise<void> {
  const error = await promise.catch((e: unknown) => e);
  expect((error as { digest?: string }).digest).toMatch(/404/);
}

beforeEach(async () => {
  alice = await createUserWithCategories("alice@example.com");
  bob = await createUserWithCategories("bob@example.com");
  bobTx = (
    await prisma.transaction.create({
      data: {
        userId: bob.userId,
        type: "EXPENSE",
        amount: 99_000,
        categoryId: bob.food,
        occurredAt: new Date("2026-11-05T05:00:00Z"),
        note: "Của Bob",
      },
    })
  ).id;
  await prisma.userAvatar.create({
    data: {
      userId: bob.userId,
      // A WebP header followed by "BOBAVATAR", so a leak is easy to spot.
      data: new Uint8Array([
        0x52,
        0x49,
        0x46,
        0x46,
        0,
        0,
        0,
        0,
        0x57,
        0x45,
        0x42,
        0x50,
        ...new TextEncoder().encode("BOBAVATAR"),
      ]),
      mimeType: "image/webp",
    },
  });
  bobBudget = (
    await prisma.budget.create({
      data: { userId: bob.userId, categoryId: bob.food, month: "2026-11", amount: 123_456 },
    })
  ).id;
  signInAs(alice);
});

/**
 * Every API endpoint (except Auth.js and registration) and an attack on Bob's
 * data through it. Each must answer like the resource does not exist for Alice.
 */
const endpoints: {
  route: string;
  method: string;
  attack: () => Promise<Response>;
  expectStatus: number;
}[] = [
  {
    route: "transactions/[id]",
    method: "GET",
    attack: () =>
      transactionRoute.GET(request("GET", `/api/transactions/${bobTx}`), context(bobTx)),
    expectStatus: 404,
  },
  {
    route: "transactions/[id]",
    method: "PATCH",
    attack: () =>
      transactionRoute.PATCH(
        request("PATCH", `/api/transactions/${bobTx}`, { amount: 1 }),
        context(bobTx),
      ),
    expectStatus: 404,
  },
  {
    route: "transactions/[id]",
    method: "DELETE",
    attack: () =>
      transactionRoute.DELETE(request("DELETE", `/api/transactions/${bobTx}`), context(bobTx)),
    expectStatus: 404,
  },
  {
    route: "transactions",
    method: "POST",
    // A transaction in Bob's category, claiming to be Bob.
    attack: () =>
      transactionsRoute.POST(
        request("POST", "/api/transactions", {
          type: "EXPENSE",
          amount: 1,
          categoryId: bob.food,
          occurredAt: "2026-11-06T00:00:00Z",
          userId: bob.userId,
        }),
      ),
    expectStatus: 400,
  },
  {
    route: "transactions",
    method: "GET",
    // Filtering by Bob's category must not reveal Bob's transactions.
    attack: () =>
      transactionsRoute.GET(
        request("GET", `/api/transactions?month=2026-11&categoryId=${bob.food}`),
      ),
    expectStatus: 200,
  },
  {
    route: "categories",
    method: "GET",
    attack: () => categoriesRoute.GET(),
    expectStatus: 200,
  },
  {
    route: "categories",
    method: "POST",
    attack: () =>
      categoriesRoute.POST(
        request("POST", "/api/categories", { name: "Ăn uống", type: "INCOME", userId: bob.userId }),
      ),
    expectStatus: 201,
  },
  {
    route: "categories/[id]",
    method: "PATCH",
    attack: () =>
      categoryRoute.PATCH(
        request("PATCH", `/api/categories/${bob.food}`, { name: "Hacked" }),
        context(bob.food),
      ),
    expectStatus: 404,
  },
  {
    route: "categories/[id]",
    method: "DELETE",
    // Bob's empty "Lương" category: deletable by Bob, a 404 for Alice.
    attack: () =>
      categoryRoute.DELETE(request("DELETE", `/api/categories/${bob.salary}`), context(bob.salary)),
    expectStatus: 404,
  },
  // Statistics for the month of Bob's 99,000 must not include it.
  {
    route: "stats/summary",
    method: "GET",
    attack: () => statsSummaryRoute.GET(request("GET", "/api/stats/summary?month=2026-11")),
    expectStatus: 200,
  },
  {
    route: "stats/by-category",
    method: "GET",
    attack: () => statsByCategoryRoute.GET(request("GET", "/api/stats/by-category?month=2026-11")),
    expectStatus: 200,
  },
  {
    route: "stats/daily",
    method: "GET",
    attack: () => statsDailyRoute.GET(request("GET", "/api/stats/daily?month=2026-11")),
    expectStatus: 200,
  },
  {
    route: "stats/period",
    method: "GET",
    // The year of Bob's 99,000 (the widest period) must not include it.
    attack: () =>
      statsPeriodRoute.GET(request("GET", "/api/stats/period?period=year&date=2026-11-05")),
    expectStatus: 200,
  },
  {
    route: "budgets",
    method: "GET",
    attack: () => budgetsRoute.GET(request("GET", "/api/budgets?month=2026-11")),
    expectStatus: 200,
  },
  {
    route: "budgets",
    method: "PUT",
    // A budget on Bob's category, claiming to be Bob.
    attack: () =>
      budgetsRoute.PUT(
        request("PUT", "/api/budgets", {
          categoryId: bob.food,
          month: "2026-11",
          amount: 1,
          userId: bob.userId,
        }),
      ),
    expectStatus: 400,
  },
  {
    route: "budgets/[id]",
    method: "DELETE",
    attack: () =>
      budgetRoute.DELETE(request("DELETE", `/api/budgets/${bobBudget}`), context(bobBudget)),
    expectStatus: 404,
  },
  {
    route: "account/avatar",
    method: "GET",
    // Only the session user's own avatar exists at this URL; Alice has none.
    attack: () => accountAvatarRoute.GET(),
    expectStatus: 404,
  },
];

describe("API endpoints", () => {
  it.each(endpoints)(
    "$method /api/$route does not let Alice touch Bob's data",
    async ({ attack, expectStatus }) => {
      const before = await bobSnapshot();

      const response = await attack();

      expect(response.status).toBe(expectStatus);
      const body = response.status === 204 ? "" : await response.text();
      // Nothing of Bob's leaks into the response...
      for (const secret of [
        bobTx,
        bobBudget,
        bob.userId,
        bob.food,
        bob.salary,
        "Của Bob",
        "99000",
        "123456",
        "BOBAVATAR",
      ]) {
        expect(body).not.toContain(secret);
      }
      // ...and nothing of Bob's changed.
      expect(await bobSnapshot()).toEqual(before);
    },
  );

  it.each(endpoints)("$method /api/$route requires a session (401)", async ({ attack }) => {
    signInAs(null);
    const before = await bobSnapshot();

    const response = await attack();

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: "UNAUTHENTICATED" });
    expect(await bobSnapshot()).toEqual(before);
  });

  it("covers every API route file (except Auth.js and registration)", () => {
    const apiDir = join(process.cwd(), "src", "app", "api");
    const found = new Set<string>();
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(path);
        } else if (entry.name === "route.ts") {
          found.add(relative(apiDir, dir).split(sep).join("/"));
        }
      }
    };
    walk(apiDir);
    const routes = [...found].filter((route) => !route.startsWith("auth/") && route !== "auth");

    // A new endpoint must get an authorization case above before this passes.
    expect(routes.sort()).toEqual([...new Set(endpoints.map((e) => e.route))].sort());
  });
});

describe("server actions", () => {
  const txForm = (categoryId: string) =>
    form({ type: "EXPENSE", amount: "1k", categoryId, date: "2026-11-06", note: "" });

  it("createTransactionAction rejects Bob's category", async () => {
    const before = await bobSnapshot();
    const state = await transactionActions.createTransactionAction({}, txForm(bob.food));

    expect(state.fieldErrors).toHaveProperty("categoryId");
    expect(await prisma.transaction.count({ where: { userId: alice.userId } })).toBe(0);
    expect(await bobSnapshot()).toEqual(before);
  });

  it("updateTransactionAction and deleteTransactionAction are a 404 on Bob's transaction", async () => {
    const before = await bobSnapshot();

    await expectNotFound(transactionActions.updateTransactionAction(bobTx, {}, txForm(alice.food)));
    await expectNotFound(transactionActions.deleteTransactionAction(bobTx, form({})));

    expect(await bobSnapshot()).toEqual(before);
  });

  it("budget actions reject Bob's category and are a 404 on Bob's budget", async () => {
    const before = await bobSnapshot();

    const state = await budgetActions.saveBudgetAction(
      {},
      form({ categoryId: bob.food, month: "2026-11", amount: "1k" }),
    );
    expect(state.fieldErrors).toHaveProperty("categoryId");
    await expectNotFound(budgetActions.deleteBudgetAction(bobBudget));

    expect(await prisma.budget.count({ where: { userId: alice.userId } })).toBe(0);
    expect(await bobSnapshot()).toEqual(before);
  });

  it("category actions are a 404 on Bob's categories", async () => {
    const before = await bobSnapshot();

    await expectNotFound(
      categoryActions.renameCategoryAction(bob.food, {}, form({ name: "Hacked", icon: "" })),
    );
    await expectNotFound(categoryActions.deleteCategoryAction(bob.salary));

    expect(await bobSnapshot()).toEqual(before);
  });

  it("every action requires a session", async () => {
    signInAs(null);
    const before = await bobSnapshot();
    const attempts = [
      transactionActions.createTransactionAction({}, txForm(bob.food)),
      transactionActions.updateTransactionAction(bobTx, {}, txForm(bob.food)),
      transactionActions.deleteTransactionAction(bobTx, form({})),
      categoryActions.createCategoryAction({}, form({ name: "X", type: "EXPENSE", icon: "" })),
      categoryActions.renameCategoryAction(bob.food, {}, form({ name: "X", icon: "" })),
      categoryActions.deleteCategoryAction(bob.salary),
      budgetActions.saveBudgetAction(
        {},
        form({ categoryId: bob.food, month: "2026-11", amount: "1k" }),
      ),
      budgetActions.deleteBudgetAction(bobBudget),
      accountActions.updateProfileAction({}, form({ name: "X", username: "", birthDate: "" })),
      accountActions.changePasswordAction(
        {},
        form({ newPassword: "12345678", confirmPassword: "12345678" }),
      ),
      accountActions.uploadAvatarAction({}, form({})),
      accountActions.removeAvatarAction(),
      settingsActions.saveDisplayAction(
        {},
        form({ amountFormat: "DONG", dateFormat: "ISO", weekStart: "SUNDAY", timeZone: "UTC" }),
      ),
      settingsActions.saveThemeAction("DARK"),
      settingsActions.saveNotificationsAction({}, form({})),
    ];

    for (const attempt of attempts) {
      await expect(attempt).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    }
    expect(await bobSnapshot()).toEqual(before);
  });
});
