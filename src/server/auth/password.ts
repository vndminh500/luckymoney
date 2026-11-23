import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Password hashing with Node's built-in scrypt (memory-hard KDF, no native addon).
 * Stored format: "scrypt$N$r$p$<salt base64url>$<hash base64url>", so the cost
 * parameters can be raised later without breaking existing hashes.
 */

const PARAMS = { N: 2 ** 15, r: 8, p: 1 };
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
// scrypt needs 128 * N * r bytes (32 MiB here); Node's default cap is 32 MiB.
const MAX_MEMORY = 64 * 1024 * 1024;

function deriveKey(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFC"), salt, KEY_LENGTH, options, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await deriveKey(password, salt, { ...PARAMS, maxmem: MAX_MEMORY });
  const { N, r, p } = PARAMS;
  return ["scrypt", N, r, p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

/** Constant-time comparison. Returns false (never throws) for malformed stored hashes. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, n, r, p, saltText, keyText] = stored.split("$");
  if (algorithm !== "scrypt" || !saltText || !keyText) {
    return false;
  }
  const options = { N: Number(n), r: Number(r), p: Number(p), maxmem: MAX_MEMORY };
  if (![options.N, options.r, options.p].every(Number.isSafeInteger)) {
    return false;
  }
  const expected = Buffer.from(keyText, "base64url");
  if (expected.length !== KEY_LENGTH) {
    return false;
  }
  try {
    const actual = await deriveKey(password, Buffer.from(saltText, "base64url"), options);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/**
 * Runs a verification against a throwaway hash so that "unknown email" takes as
 * long as "wrong password", which avoids revealing registered emails by timing.
 */
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  await verifyPassword(password, await dummyHash);
}
