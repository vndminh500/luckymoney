import { describe, expect, it } from "vitest";

import { safeRedirectPath } from "@/lib/safe-redirect";

describe("safeRedirectPath", () => {
  it.each([
    ["/", "/"],
    ["/transactions", "/transactions"],
    ["/transactions?month=2026-11&page=2", "/transactions?month=2026-11&page=2"],
    ["/a/../budgets", "/budgets"],
  ])("keeps same-origin path %j", (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });

  it.each([
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "javascript:alert(1)",
    "evil.com",
    "",
    undefined,
    null,
    42,
  ])("falls back for unsafe value %j", (input) => {
    expect(safeRedirectPath(input)).toBe("/");
    expect(safeRedirectPath(input, "/home")).toBe("/home");
  });
});
