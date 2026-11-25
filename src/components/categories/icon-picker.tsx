"use client";

import { useEffect, useId, useRef, useState } from "react";

import { findIconLabel, searchIcons } from "@/lib/category-icons";

type Props = {
  /** Name of the hidden input that carries the chosen icon in the form. */
  name: string;
  defaultValue?: string | null;
  label?: string;
};

/**
 * Icon field: a square button that drops down everyday activities, grouped,
 * with a search box. The chosen emoji travels in a hidden input.
 */
export function IconPicker({ name, defaultValue = null, label = "Biểu tượng" }: Props) {
  const [value, setValue] = useState<string | null>(defaultValue || null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const panelId = useId();
  const labelId = useId();

  const chosenLabel = findIconLabel(value);
  const groups = searchIcons(query);

  const close = (refocus: boolean) => {
    setOpen(false);
    setQuery("");
    if (refocus) buttonRef.current?.focus();
  };

  const choose = (emoji: string | null) => {
    setValue(emoji);
    close(true);
  };

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close(true);
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative flex flex-col gap-2">
      <span id={labelId} className="font-medium">
        {label}
      </span>
      <input type="hidden" name={name} value={value ?? ""} />
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${label}: ${value ? (chosenLabel ?? value) : "chưa chọn"}`}
        onClick={() => (open ? close(false) : setOpen(true))}
        className="flex h-12 items-center gap-3 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] px-3 text-left transition-[border-color,box-shadow] duration-200 ease-lm hover:border-lm-sky/70 focus-visible:border-lm-sky focus-visible:shadow-[0_0_0_4px_color-mix(in_srgb,var(--lm-aqua)_55%,transparent)] focus-visible:outline-none aria-expanded:border-lm-sky"
      >
        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--dash-track)] text-lg"
        >
          {value ?? "＋"}
        </span>
        <span className="min-w-0 flex-1 truncate text-[var(--dash-muted)]">
          {value ? (chosenLabel ?? "Biểu tượng riêng") : "Chọn biểu tượng"}
        </span>
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className={`size-4 shrink-0 text-[var(--dash-muted)] transition-transform duration-200 ease-lm ${open ? "rotate-180" : ""}`}
        >
          <path
            d="m5 7.5 5 5 5-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <div
        id={panelId}
        role="dialog"
        aria-labelledby={labelId}
        inert={!open}
        className={`absolute top-full right-0 left-0 z-40 mt-2 flex sm:right-auto sm:w-[22rem] origin-top-left flex-col rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)] shadow-[0_20px_50px_rgb(6_43_69/0.22)] transition-[opacity,transform,visibility] duration-200 ease-lm ${
          open ? "visible scale-100 opacity-100" : "invisible scale-95 opacity-0"
        }`}
      >
        <div className="border-b border-[var(--dash-border)] p-3">
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Tìm hoạt động"
            className="h-10 w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 text-[var(--dash-text)] outline-none placeholder:text-[var(--dash-muted)]/80 focus-visible:border-lm-sky"
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {value ? (
            <button
              type="button"
              onClick={() => choose(null)}
              className="mb-1 w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--dash-muted)] transition-colors hover:bg-[var(--dash-track)] hover:text-[var(--dash-text)] focus-visible:bg-[var(--dash-track)] focus-visible:outline-none"
            >
              Không dùng biểu tượng
            </button>
          ) : null}
          {groups.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-[var(--dash-muted)]">
              Không có hoạt động nào khớp “{query}”.
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.label} role="group" aria-label={group.label} className="mb-2">
                <p className="px-2 pt-1 pb-1.5 text-sm font-medium text-[var(--dash-muted)]">
                  {group.label}
                </p>
                <div className="grid grid-cols-2 gap-1">
                  {group.icons.map((icon) => (
                    <button
                      key={icon.emoji}
                      type="button"
                      aria-pressed={value === icon.emoji}
                      onClick={() => choose(icon.emoji)}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors duration-150 hover:bg-[var(--dash-track)] focus-visible:bg-[var(--dash-track)] focus-visible:outline-2 focus-visible:outline-lm-deep aria-pressed:bg-lm-sky/15 aria-pressed:font-medium"
                    >
                      <span aria-hidden="true" className="text-xl leading-none">
                        {icon.emoji}
                      </span>
                      <span className="truncate">{icon.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
