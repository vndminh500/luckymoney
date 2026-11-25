import { beforeEach, describe, expect, it } from "vitest";

import {
  changePassword,
  getAccount,
  getAvatar,
  removeAvatar,
  setAvatar,
  updateProfile,
} from "@/server/account/service";
import { registerUser, verifyCredentials } from "@/server/auth/users";
import { ConflictError, ValidationError } from "@/server/errors";

const PASSWORD = "mat-khau-an-toan";
let aliceId: string;
let bobId: string;

/** Smallest valid WebP header ("RIFF....WEBP") followed by padding. */
function webp(size = 64): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0);
  bytes.set([0x57, 0x45, 0x42, 0x50], 8);
  return bytes;
}

const png = () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

async function fields(promise: Promise<unknown>): Promise<string[]> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ValidationError);
  return (error as ValidationError).details.map((detail) => detail.field);
}

beforeEach(async () => {
  aliceId = (await registerUser({ email: "alice@example.com", password: PASSWORD, name: "Alice" }))
    .id;
  bobId = (await registerUser({ email: "bob@example.com", password: PASSWORD })).id;
});

describe("getAccount", () => {
  it("returns the profile, without secrets", async () => {
    const account = await getAccount(aliceId);
    expect(account).toEqual({
      id: aliceId,
      email: "alice@example.com",
      name: "Alice",
      username: null,
      birthDate: null,
      avatarVersion: null,
      createdAt: expect.any(Date),
    });
    expect(account).not.toHaveProperty("passwordHash");
  });
});

describe("updateProfile", () => {
  const today = new Date("2026-11-24T05:00:00Z");

  it("saves name, username (lowercased) and birth date", async () => {
    await updateProfile(
      aliceId,
      { name: "  Nguyễn Thị Alice ", username: "Alice.Ng", birthDate: "1995-04-30" },
      today,
    );
    await expect(getAccount(aliceId)).resolves.toMatchObject({
      name: "Nguyễn Thị Alice",
      username: "alice.ng",
      birthDate: "1995-04-30",
    });
  });

  it("clears optional fields when left empty", async () => {
    await updateProfile(aliceId, { name: "A", username: "alice", birthDate: "2000-01-01" }, today);
    await updateProfile(aliceId, { name: "", username: "", birthDate: "" }, today);
    await expect(getAccount(aliceId)).resolves.toMatchObject({
      name: null,
      username: null,
      birthDate: null,
    });
  });

  it("returns 409 on the username field when another user has it (any case)", async () => {
    await updateProfile(bobId, { username: "minh" }, today);
    const error = await updateProfile(aliceId, { username: "MINH" }, today).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ConflictError);
  });

  it.each([
    ["username", { username: "ab" }],
    ["username", { username: "có dấu" }],
    ["username", { username: ".alice" }],
    ["username", { username: "a".repeat(31) }],
    ["birthDate", { birthDate: "2026-11-25" }], // in the future
    ["birthDate", { birthDate: "1899-12-31" }],
    ["birthDate", { birthDate: "2001-02-29" }],
    ["name", { name: "a".repeat(101) }],
  ])("rejects an invalid %s", async (field, input) => {
    await expect(fields(updateProfile(aliceId, input, today))).resolves.toEqual([field]);
  });

  it("never changes the email or another user", async () => {
    await updateProfile(aliceId, { name: "X", email: "evil@example.com", id: bobId }, today);
    await expect(getAccount(aliceId)).resolves.toMatchObject({ email: "alice@example.com" });
    await expect(getAccount(bobId)).resolves.toMatchObject({ name: null });
  });
});

describe("changePassword", () => {
  const change = (input: object) => changePassword(aliceId, input);

  it("requires the current password and switches to the new one", async () => {
    await change({
      currentPassword: PASSWORD,
      newPassword: "mat-khau-moi-123",
      confirmPassword: "mat-khau-moi-123",
    });

    await expect(
      verifyCredentials({ email: "alice@example.com", password: "mat-khau-moi-123" }),
    ).resolves.toMatchObject({ id: aliceId });
    await expect(
      verifyCredentials({ email: "alice@example.com", password: PASSWORD }),
    ).resolves.toBeNull();
  });

  it("rejects a wrong current password, a mismatch or a short password", async () => {
    await expect(
      fields(
        change({ currentPassword: "sai", newPassword: "12345678", confirmPassword: "12345678" }),
      ),
    ).resolves.toEqual(["currentPassword"]);
    await expect(
      fields(
        change({ currentPassword: PASSWORD, newPassword: "12345678", confirmPassword: "87654321" }),
      ),
    ).resolves.toEqual(["confirmPassword"]);
    await expect(
      fields(change({ currentPassword: PASSWORD, newPassword: "short", confirmPassword: "short" })),
    ).resolves.toEqual(["newPassword"]);
    // Nothing changed.
    await expect(
      verifyCredentials({ email: "alice@example.com", password: PASSWORD }),
    ).resolves.toMatchObject({ id: aliceId });
  });

  it("refuses to change the password without the current one", async () => {
    for (const currentPassword of [undefined, ""]) {
      await expect(
        fields(
          change({
            currentPassword,
            newPassword: "mat-khau-moi-123",
            confirmPassword: "mat-khau-moi-123",
          }),
        ),
      ).resolves.toEqual(["currentPassword"]);
    }
    await expect(
      verifyCredentials({ email: "alice@example.com", password: PASSWORD }),
    ).resolves.toMatchObject({ id: aliceId });
  });
});

describe("avatar", () => {
  it("stores a WebP, bumps the version, and serves it only to its owner", async () => {
    await setAvatar(aliceId, webp(), "image/webp");

    const account = await getAccount(aliceId);
    expect(account.avatarVersion).toEqual(expect.any(Number));
    await expect(getAvatar(aliceId)).resolves.toMatchObject({ mimeType: "image/webp" });
    await expect(getAvatar(bobId)).resolves.toBeNull();
  });

  it("accepts PNG and JPEG too, checked by content, not by the declared type", async () => {
    await expect(setAvatar(aliceId, png(), "image/png")).resolves.toBeUndefined();
    await expect(fields(setAvatar(aliceId, png(), "image/webp"))).resolves.toEqual(["avatar"]);
    await expect(
      fields(setAvatar(aliceId, new TextEncoder().encode("<svg></svg>"), "image/svg+xml")),
    ).resolves.toEqual(["avatar"]);
  });

  it("rejects images over 200 KB", async () => {
    await expect(fields(setAvatar(aliceId, webp(200 * 1024 + 1), "image/webp"))).resolves.toEqual([
      "avatar",
    ]);
  });

  it("can be removed", async () => {
    await setAvatar(aliceId, webp(), "image/webp");
    await removeAvatar(aliceId);
    await expect(getAvatar(aliceId)).resolves.toBeNull();
    await expect(getAccount(aliceId)).resolves.toMatchObject({ avatarVersion: null });
  });
});
