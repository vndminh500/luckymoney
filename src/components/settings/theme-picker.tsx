"use client";

import { useState, useTransition } from "react";

import { saveThemeAction } from "@/app/(app)/settings/actions";
import type { Theme } from "@/lib/schemas/settings";
import { applyTheme } from "@/lib/theme";

const OPTIONS: { value: Theme; label: string; description: string }[] = [
  { value: "SYSTEM", label: "Theo hệ thống", description: "Tự đổi theo cài đặt của thiết bị." },
  { value: "LIGHT", label: "Sáng", description: "Nền sáng, dễ đọc ban ngày." },
  { value: "DARK", label: "Tối", description: "Nền tối, dịu mắt buổi tối." },
];

/** A small picture of the app in each theme, so the choice is visible before picking. */
function Preview({ theme }: { theme: Theme }) {
  const half = (dark: boolean) => (
    <div
      className={`flex h-full flex-1 flex-col gap-1.5 p-2 ${dark ? "bg-[#061b2b]" : "bg-[#f4fbff]"}`}
    >
      <span className={`h-2 w-2/3 rounded-full ${dark ? "bg-[#e8f8ff]/70" : "bg-[#062b45]/70"}`} />
      <span className={`h-5 rounded-md ${dark ? "bg-[#0b2639]" : "bg-white"}`} />
      <span className="h-2 w-1/2 rounded-full bg-lm-sky" />
    </div>
  );
  return (
    <div
      aria-hidden="true"
      className="flex h-20 overflow-hidden rounded-lg border border-[var(--dash-border)]"
    >
      {theme === "SYSTEM" ? (
        <>
          {half(false)}
          {half(true)}
        </>
      ) : (
        half(theme === "DARK")
      )}
    </div>
  );
}

/** Picking a theme applies it at once and saves it; no submit button needed. */
export function ThemePicker({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);
  const [saved, setSaved] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  function choose(next: Theme) {
    setTheme(next);
    applyTheme(next.toLowerCase() as "system" | "light" | "dark");
    startTransition(async () => {
      const result = await saveThemeAction(next);
      if (result.savedAt) setSaved(result.savedAt);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="Giao diện" className="grid gap-3 sm:grid-cols-3">
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer flex-col gap-3 rounded-2xl border border-[var(--dash-border)] p-3 transition-[border-color,box-shadow] duration-200 ease-lm hover:border-lm-sky/70 has-checked:border-lm-sky has-checked:shadow-[0_0_0_3px_rgb(48_175_255/0.25)] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-lm-deep"
          >
            <input
              type="radio"
              name="theme"
              value={option.value}
              checked={theme === option.value}
              onChange={() => choose(option.value)}
              className="sr-only"
            />
            <Preview theme={option.value} />
            <span>
              <span className="block font-medium">{option.label}</span>
              <span className="block text-sm text-[var(--dash-muted)]">{option.description}</span>
            </span>
          </label>
        ))}
      </div>
      <p role="status" className="min-h-6 text-sm text-[var(--dash-muted)]">
        {pending ? "Đang lưu…" : saved ? "Đã lưu giao diện." : ""}
      </p>
    </div>
  );
}
