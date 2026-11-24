"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { logoutAction } from "@/app/(auth)/actions";
import { UserAvatar } from "@/components/account/user-avatar";

type Props = {
  name: string | null;
  email: string;
  username: string | null;
  avatarVersion: number | null;
};

const itemClass =
  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left font-medium transition-colors duration-150 hover:bg-[var(--dash-track)] focus-visible:bg-[var(--dash-track)] focus-visible:outline-none";

const icon = {
  viewBox: "0 0 24 24",
  className: "size-5 shrink-0 text-[var(--dash-muted)]",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/**
 * Square avatar in the top bar. Hovering opens the menu (it closes shortly
 * after the pointer leaves); a click pins it open, and Escape, a click
 * outside or choosing an item closes it. Keyboard users open it with the button.
 */
export function UserMenu({ name, email, username, avatarVersion }: Props) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuId = useId();

  const close = () => {
    setOpen(false);
    setPinned(false);
  };

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        buttonRef.current?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  useEffect(() => cancelClose, []);

  return (
    <div
      ref={rootRef}
      className="relative"
      onPointerEnter={(event) => {
        if (event.pointerType !== "mouse") return;
        cancelClose();
        setOpen(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== "mouse" || pinned) return;
        closeTimer.current = setTimeout(() => setOpen(false), 180);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label="Tài khoản của bạn"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => {
          if (open && pinned) {
            close();
          } else {
            setOpen(true);
            setPinned(true);
          }
        }}
        className="block rounded-xl ring-offset-2 ring-offset-[var(--dash-surface)] transition-[box-shadow,transform] duration-200 ease-lm hover:ring-2 hover:ring-lm-sky focus-visible:ring-2 focus-visible:ring-lm-deep focus-visible:outline-none active:scale-95 aria-expanded:ring-2 aria-expanded:ring-lm-sky"
      >
        <UserAvatar name={name} email={email} avatarVersion={avatarVersion} />
      </button>

      <div
        id={menuId}
        inert={!open}
        className={`absolute right-0 z-50 mt-2 w-64 origin-top-right rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-2 shadow-[0_20px_50px_rgb(6_43_69/0.18)] transition-[opacity,transform,visibility] duration-200 ease-lm ${
          open ? "visible scale-100 opacity-100" : "invisible scale-95 opacity-0"
        }`}
      >
        <div className="flex items-center gap-3 border-b border-[var(--dash-border)] px-3 pt-2 pb-3">
          <UserAvatar name={name} email={email} avatarVersion={avatarVersion} />
          <div className="min-w-0">
            <p className="truncate font-bold">{name ?? email}</p>
            <p className="truncate text-sm text-[var(--dash-muted)]">
              {username ? `@${username}` : email}
            </p>
          </div>
        </div>
        <nav aria-label="Tài khoản" className="flex flex-col gap-0.5 pt-2">
          <Link href="/account" onClick={close} className={itemClass}>
            <svg {...icon}>
              <circle cx="12" cy="8" r="3.5" />
              <path d="M5 20a7 7 0 0 1 14 0" />
            </svg>
            Tài khoản
          </Link>
          <Link href="/settings" onClick={close} className={itemClass}>
            <svg {...icon}>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
            </svg>
            Cài đặt
          </Link>
          <form action={logoutAction} className="mt-1 border-t border-[var(--dash-border)] pt-1">
            <button type="submit" className={`${itemClass} text-red-700 dark:text-red-400`}>
              <svg {...icon} className="size-5 shrink-0">
                <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" />
              </svg>
              Đăng xuất
            </button>
          </form>
        </nav>
      </div>
    </div>
  );
}
