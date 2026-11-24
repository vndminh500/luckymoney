import { Prisma } from "@prisma/client";

import { toDateKey } from "@/lib/dates";
import { changePasswordSchema, profileSchema } from "@/lib/schemas/account";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { prisma } from "@/server/db";
import { ConflictError, ValidationError } from "@/server/errors";

/** The signed-in user's own profile, as shown on the account pages (no secrets). */
export type Account = {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  birthDate: string | null;
  hasPassword: boolean;
  googleLinked: boolean;
  /** Changes whenever the avatar changes (cache-busting); null without an avatar. */
  avatarVersion: number | null;
  createdAt: Date;
};

export async function getAccount(userId: string): Promise<Account> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      username: true,
      birthDate: true,
      passwordHash: true,
      createdAt: true,
      avatar: { select: { updatedAt: true } },
      accounts: { where: { provider: "google" }, select: { id: true } },
    },
  });
  const { passwordHash, avatar, accounts, ...profile } = user;
  return {
    ...profile,
    hasPassword: passwordHash !== null,
    googleLinked: accounts.length > 0,
    avatarVersion: avatar ? avatar.updatedAt.getTime() : null,
  };
}

/** Saves the profile form. A username taken by someone else is a 409 on that field. */
export async function updateProfile(
  userId: string,
  input: unknown,
  now = new Date(),
): Promise<void> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    throw ValidationError.fromZod(parsed.error);
  }
  const { name, username, birthDate } = parsed.data;
  if (birthDate) {
    const { timeZone } = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { timeZone: true },
    });
    if (birthDate > toDateKey(now, timeZone)) {
      throw new ValidationError([
        { field: "birthDate", message: "Ngày sinh không thể ở tương lai." },
      ]);
    }
  }
  try {
    await prisma.user.update({ where: { id: userId }, data: { name, username, birthDate } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError("Tên đăng nhập này đã có người dùng.");
    }
    throw error;
  }
}

/**
 * Changes the password. An account that has one must confirm it first; a
 * Google-only account can create one. Existing sessions (JWT) stay valid
 * until they expire, see docs/progress.md.
 */
export async function changePassword(userId: string, input: unknown): Promise<void> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    throw ValidationError.fromZod(parsed.error);
  }
  const { currentPassword, newPassword } = parsed.data;
  const { passwordHash } = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (passwordHash && !(await verifyPassword(currentPassword ?? "", passwordHash))) {
    throw new ValidationError([
      { field: "currentPassword", message: "Mật khẩu hiện tại không đúng." },
    ]);
  }
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword) },
  });
}

export const AVATAR_MAX_BYTES = 200 * 1024;

/** Recognises an image by its first bytes; the declared type must match. */
const SIGNATURES: Record<string, (bytes: Uint8Array) => boolean> = {
  "image/png": (b) => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v),
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/webp": (b) =>
    [0x52, 0x49, 0x46, 0x46].every((v, i) => b[i] === v) &&
    [0x57, 0x45, 0x42, 0x50].every((v, i) => b[i + 8] === v),
};

const avatarError = (message: string) => new ValidationError([{ field: "avatar", message }]);

/** Stores the avatar (already cropped to a square and resized in the browser). */
export async function setAvatar(userId: string, data: Uint8Array, mimeType: string): Promise<void> {
  const matches = SIGNATURES[mimeType];
  if (!matches || !matches(data)) {
    throw avatarError("Ảnh đại diện phải là PNG, JPEG hoặc WebP.");
  }
  if (data.byteLength > AVATAR_MAX_BYTES) {
    throw avatarError("Ảnh đại diện tối đa 200 KB.");
  }
  const bytes = new Uint8Array(data);
  await prisma.userAvatar.upsert({
    where: { userId },
    create: { userId, data: bytes, mimeType },
    update: { data: bytes, mimeType },
  });
}

export async function removeAvatar(userId: string): Promise<void> {
  await prisma.userAvatar.deleteMany({ where: { userId } });
}

/** The user's own avatar, or null. */
export async function getAvatar(
  userId: string,
): Promise<{ data: Uint8Array; mimeType: string; updatedAt: Date } | null> {
  return prisma.userAvatar.findUnique({
    where: { userId },
    select: { data: true, mimeType: true, updatedAt: true },
  });
}
