import { describe, expect, it } from "vitest";

// Sample test proving the Vitest setup runs. Real unit tests start in T4
// (src/lib/money.ts, src/lib/dates.ts).
describe("vitest setup", () => {
  it("runs TypeScript tests", () => {
    const sum = (a: number, b: number): number => a + b;
    expect(sum(2, 3)).toBe(5);
  });
});
