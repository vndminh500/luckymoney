import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/server/auth/password";

describe("password hashing", () => {
  it("never stores the plain password and verifies the right one", async () => {
    const hash = await hashPassword("mật khẩu đúng");
    expect(hash).not.toContain("mật khẩu đúng");
    expect(hash).toMatch(/^scrypt\$32768\$8\$1\$[\w-]+\$[\w-]+$/);
    expect(await verifyPassword("mật khẩu đúng", hash)).toBe(true);
    expect(await verifyPassword("mật khẩu sai", hash)).toBe(false);
  });

  it("uses a random salt, so equal passwords get different hashes", async () => {
    const [first, second] = await Promise.all([hashPassword("same"), hashPassword("same")]);
    expect(first).not.toBe(second);
  });

  it("treats NFC and NFD forms of Vietnamese text as the same password", async () => {
    const composed = "mật khẩu".normalize("NFC");
    const decomposed = composed.normalize("NFD");
    expect(composed).not.toBe(decomposed);
    expect(await verifyPassword(decomposed, await hashPassword(composed))).toBe(true);
  });

  it.each([
    "",
    "plain-text",
    "bcrypt$1$2$3$a$b",
    "scrypt$x$8$1$c2FsdA$aGFzaA",
    "scrypt$32768$8$1$c2FsdA$c2hvcnQ",
  ])("returns false instead of throwing for malformed hash %j", async (stored) => {
    expect(await verifyPassword("anything", stored)).toBe(false);
  });
});
