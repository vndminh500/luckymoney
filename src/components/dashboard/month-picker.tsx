"use client";

import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

import { addMonths } from "@/lib/dates";

type View = "months" | "years";

type Props = {
  /** The month shown on the page, "YYYY-MM". */
  month: string;
  /** The current month in the user's time zone, "YYYY-MM". */
  thisMonth: string;
  /** Page the months link to, with `?month=YYYY-MM` appended. */
  basePath?: string;
};

const SHORT_MONTHS = Array.from({ length: 12 }, (_, i) => `Th ${i + 1}`);

const arrowButton =
  "grid size-10 place-items-center rounded-full border border-[var(--dash-border)] bg-[var(--dash-surface)] text-lg transition-[border-color,transform] duration-200 ease-lm hover:border-lm-sky active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lm-deep";
const navButton =
  "grid size-9 place-items-center rounded-xl text-lg text-[var(--dash-muted)] transition-[background-color,color,transform] duration-200 ease-lm hover:bg-[var(--dash-track)] hover:text-[var(--dash-text)] focus-visible:outline-2 focus-visible:outline-lm-deep active:scale-95";
const cell =
  "grid h-11 place-items-center rounded-xl text-sm font-medium tabular-nums transition-[background-color,color,transform] duration-150 ease-lm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-lm-deep active:scale-95";
const chip =
  "rounded-full border border-[var(--dash-border)] px-3 py-1 text-sm font-medium transition-[border-color,background-color] duration-200 ease-lm hover:border-lm-sky hover:bg-lm-sky/10 focus-visible:outline-2 focus-visible:outline-lm-deep";

export function monthLabel(month: string): string {
  const [year, value] = month.split("-");
  return `Tháng ${Number(value)}/${year}`;
}

const monthKey = (year: number, index: number): string =>
  `${year}-${String(index + 1).padStart(2, "0")}`;

/**
 * Month switcher for monthly pages: ‹ › step one month, and the label opens a
 * panel to jump straight to any month (12 per year, years in blocks of 12).
 * Keyboard: arrows move between months (↑↓ by quarter), PageUp/PageDown by
 * year, Enter opens the month, Escape closes.
 */
export function MonthPicker({ month, thisMonth, basePath = "/" }: Props) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("months");
  const [year, setYear] = useState(Number(month.slice(0, 4)));
  const [focused, setFocused] = useState(month);
  const focusMonth = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const href = (key: string) => `${basePath}?month=${key}`;
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };
  const openPanel = () => {
    setYear(Number(month.slice(0, 4)));
    setFocused(month);
    setView("months");
    focusMonth.current = true;
    setOpen(true);
  };

  // The page moved to another month (a link was followed): close the panel.
  const [shownMonth, setShownMonth] = useState(month);
  if (shownMonth !== month) {
    setShownMonth(month);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close(true);
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false);
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  // Opening and keyboard moves put focus on the month they land on.
  useLayoutEffect(() => {
    if (!open || view !== "months" || !focusMonth.current) return;
    focusMonth.current = false;
    gridRef.current?.querySelector<HTMLElement>(`[data-month="${focused}"]`)?.focus();
  }, [open, view, focused, year]);

  const onGridKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -3,
      ArrowDown: 3,
      PageUp: -12,
      PageDown: 12,
    };
    const step = steps[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const next = addMonths(focused, step);
    focusMonth.current = true;
    setFocused(next);
    setYear(Number(next.slice(0, 4)));
  };

  const blockStart = Math.floor(year / 12) * 12;
  const step = (direction: -1 | 1) =>
    setYear((value) => value + direction * (view === "months" ? 1 : 12));
  const tabStop = focused.startsWith(String(year)) ? focused : `${year}-01`;

  return (
    <div
      ref={rootRef}
      className={`flex flex-wrap items-center gap-2 ${open ? "relative z-40" : "relative"}`}
    >
      <Link href={href(addMonths(month, -1))} aria-label="Tháng trước" className={arrowButton}>
        ‹
      </Link>
      <h2 className="min-w-40 text-center">
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          aria-label={`${monthLabel(month)}. Chọn tháng khác`}
          onClick={() => (open ? close(false) : openPanel())}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-lg font-medium transition-colors duration-200 hover:bg-[var(--dash-track)] focus-visible:outline-2 focus-visible:outline-lm-deep ${
            open ? "bg-[var(--dash-track)]" : ""
          }`}
        >
          {monthLabel(month)}
          <span
            aria-hidden="true"
            className={`text-sm text-[var(--dash-muted)] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          >
            ▾
          </span>
        </button>
      </h2>
      <Link href={href(addMonths(month, 1))} aria-label="Tháng sau" className={arrowButton}>
        ›
      </Link>
      {month !== thisMonth ? (
        <Link href={href(thisMonth)} className={`${chip} ml-1 whitespace-nowrap`}>
          Tháng này
        </Link>
      ) : null}

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Chọn tháng"
          className="absolute top-full left-0 z-40 mt-2 w-[18rem] max-w-[calc(100vw-2rem)] origin-top animate-[lm-dialog-in_200ms_var(--ease-lm)] rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-3 text-[var(--dash-text)] shadow-[0_24px_60px_rgb(6_43_69/0.22)]"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label={view === "months" ? "Năm trước" : "12 năm trước"}
              onClick={() => step(-1)}
              className={navButton}
            >
              ‹
            </button>
            <button
              type="button"
              aria-live="polite"
              disabled={view === "years"}
              aria-label={view === "months" ? `Năm ${year}. Chọn năm khác` : undefined}
              onClick={() => setView("years")}
              className="flex items-center gap-1 rounded-xl px-3 py-1.5 font-bold tabular-nums transition-colors duration-200 hover:bg-[var(--dash-track)] focus-visible:outline-2 focus-visible:outline-lm-deep disabled:hover:bg-transparent"
            >
              {view === "months" ? year : `${blockStart} – ${blockStart + 11}`}
              {view === "months" ? (
                <span aria-hidden="true" className="text-sm text-[var(--dash-muted)]">
                  ▾
                </span>
              ) : null}
            </button>
            <button
              type="button"
              aria-label={view === "months" ? "Năm sau" : "12 năm sau"}
              onClick={() => step(1)}
              className={navButton}
            >
              ›
            </button>
          </div>

          {view === "months" ? (
            <div
              ref={gridRef}
              key={year}
              onKeyDown={onGridKeyDown}
              className="grid animate-[lm-fade-in_180ms_ease-out] grid-cols-3 gap-2 py-1"
            >
              {SHORT_MONTHS.map((name, index) => {
                const key = monthKey(year, index);
                const selected = key === month;
                const current = key === thisMonth;
                return (
                  <Link
                    key={key}
                    href={href(key)}
                    data-month={key}
                    tabIndex={key === tabStop ? 0 : -1}
                    aria-label={monthLabel(key)}
                    aria-current={selected ? "page" : undefined}
                    onFocus={() => setFocused(key)}
                    onClick={() => setOpen(false)}
                    className={`${cell} ${
                      selected
                        ? "bg-lm-sky font-bold text-lm-ink shadow-[0_6px_14px_color-mix(in_srgb,var(--lm-sky)_40%,transparent)]"
                        : key > thisMonth
                          ? "text-[var(--dash-muted)] hover:bg-[var(--dash-track)]"
                          : "hover:bg-[var(--dash-track)]"
                    } ${current && !selected ? "font-bold ring-2 ring-lm-sky/70 ring-inset" : ""}`}
                  >
                    {name}
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="grid animate-[lm-fade-in_180ms_ease-out] grid-cols-3 gap-2 py-1">
              {Array.from({ length: 12 }, (_, i) => blockStart + i).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={value === Number(month.slice(0, 4))}
                  onClick={() => {
                    setYear(value);
                    setFocused(`${value}${month.slice(4)}`);
                    focusMonth.current = true;
                    setView("months");
                  }}
                  className={`${cell} ${
                    value === Number(month.slice(0, 4))
                      ? "bg-lm-sky font-bold text-lm-ink"
                      : "hover:bg-[var(--dash-track)]"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          )}

          <div className="mt-2 flex items-center gap-2 border-t border-[var(--dash-border)] pt-3">
            <Link href={href(thisMonth)} onClick={() => setOpen(false)} className={chip}>
              Tháng này
            </Link>
            <span className="ml-auto text-xs text-[var(--dash-muted)]">
              {view === "months" ? "Bấm năm để nhảy xa hơn" : "Chọn năm"}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
