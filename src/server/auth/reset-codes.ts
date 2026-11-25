import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/**
 * Pure helpers for password-reset codes and tickets. No database access, so the
 * e2e suite can import them to plant a known code.
 */

const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

/** A 6-digit code, zero-padded ("004213"). */
export function generateResetCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** Hash bound to the reset row, so the same code hashes differently per request. */
export function hashResetCode(resetId: string, code: string): string {
  return sha256(`${resetId}:${code}`);
}

/** Random one-time ticket handed to the browser after a correct code. */
export function generateResetTicket(): string {
  return randomBytes(32).toString("base64url");
}

export function hashResetTicket(ticket: string): string {
  return sha256(ticket);
}

/** Constant-time comparison of two hex hashes. */
export function codesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}
