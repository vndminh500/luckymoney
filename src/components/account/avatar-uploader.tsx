"use client";

import { useActionState, useRef, useState } from "react";

import {
  removeAvatarAction,
  uploadAvatarAction,
  type AccountFormState,
} from "@/app/(app)/account/actions";
import { UserAvatar } from "@/components/account/user-avatar";
import { brandSecondaryButton, FieldMessages } from "@/components/ui/brand-form";

const SIZE = 256;

/** Crops the image to a centred square and resizes it to 256x256 in the browser. */
async function toSquareAvatar(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available");
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    SIZE,
    SIZE,
  );
  bitmap.close();
  const encode = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
  // WebP is the smallest; browsers that cannot encode it return PNG, so fall back to JPEG.
  const webp = await encode("image/webp");
  if (webp?.type === "image/webp") return webp;
  const jpeg = await encode("image/jpeg");
  if (!jpeg) throw new Error("Could not encode the image");
  return jpeg;
}

type Props = { name: string | null; email: string; avatarVersion: number | null };

export function AvatarUploader({ name, email, avatarVersion }: Props) {
  const [state, formAction, pending] = useActionState<AccountFormState, FormData>(
    uploadAvatarAction,
    {},
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const error = localError ?? state.fieldErrors?.avatar;

  async function onPick(file: File | undefined) {
    setLocalError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLocalError("Vui lòng chọn một tệp ảnh.");
      return;
    }
    try {
      const avatar = await toSquareAvatar(file);
      const data = new FormData();
      data.set("avatar", avatar, "avatar");
      formAction(data);
    } catch {
      setLocalError("Không đọc được ảnh này. Hãy thử ảnh PNG hoặc JPEG khác.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className={`relative transition-opacity duration-200 ${pending ? "opacity-60" : ""}`}>
        <UserAvatar
          name={name}
          email={email}
          avatarVersion={avatarVersion}
          className="size-24 text-3xl"
        />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <label
            className={`${brandSecondaryButton} cursor-pointer has-focus-visible:outline-2 has-focus-visible:outline-lm-deep`}
          >
            {pending ? "Đang tải lên…" : avatarVersion ? "Đổi ảnh" : "Tải ảnh lên"}
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              aria-label="Chọn ảnh đại diện"
              aria-describedby={error ? "avatar-error" : "avatar-hint"}
              className="sr-only"
              disabled={pending}
              onChange={(event) => onPick(event.target.files?.[0])}
            />
          </label>
          {avatarVersion ? (
            <form action={removeAvatarAction}>
              <button type="submit" className={brandSecondaryButton}>
                Xóa ảnh
              </button>
            </form>
          ) : null}
        </div>
        <FieldMessages
          id="avatar"
          hint="Ảnh được cắt vuông và thu nhỏ còn 256×256 trước khi tải lên."
          error={error}
        />
      </div>
    </div>
  );
}
