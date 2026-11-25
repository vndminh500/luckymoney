import { describe, expect, it } from "vitest";

import {
  codesMatch,
  generateResetCode,
  generateResetTicket,
  hashResetCode,
  hashResetTicket,
} from "@/server/auth/reset-codes";

describe("reset codes", () => {
  it("generates 6-digit codes", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateResetCode()).toMatch(/^\d{6}$/);
    }
  });

  it("binds the code hash to the reset id", () => {
    expect(hashResetCode("r1", "123456")).not.toBe(hashResetCode("r2", "123456"));
    expect(codesMatch(hashResetCode("r1", "123456"), hashResetCode("r1", "123456"))).toBe(true);
    expect(codesMatch(hashResetCode("r1", "123456"), hashResetCode("r1", "654321"))).toBe(false);
  });

  it("generates distinct tickets and never stores them raw", () => {
    const ticket = generateResetTicket();
    expect(ticket).not.toBe(generateResetTicket());
    expect(hashResetTicket(ticket)).not.toContain(ticket);
  });
});
