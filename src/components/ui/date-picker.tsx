"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

import { brandControl, FieldMessages } from "@/components/ui/brand-form";
import { dayLabel, formatDmy, monthGrid, parseDateInput, weekdayHeaders } from "@/lib/calendar";
import { addDays, type WeekStart } from "@/lib/dates";
import { addMonthsToDateKey } from "@/lib/debt";

type View = "days" | "months" | "years";

type Props = {
  /** Visible label; without it, give `ariaLabel`. */
  label?: string;
  ariaLabel?: string;
  /** Name of the hidden input that carries the day ("YYYY-MM-DD") in the form. */
  name?: string;
  id?: string;
  /** Controlled day ("" for none), with `onChange`. */
  value?: string;
  defaultValue?: string;
  onChange?: (dateKey: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  /** Today in the user's time zone (from the server); the device's day otherwise. */
  today?: string;
  /** "recent" adds "Hôm qua" next to "Hôm nay" (for things that already happened). */
  shortcuts?: "today" | "recent";
  weekStart?: WeekStart;
};

const MONTH_NAMES = Array.from({ length: 12 }, (_, i) => `Tháng ${i + 1}`);

function localToday(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const navButton =
  "grid size-9 place-items-center rounded-xl text-lg text-[var(--dash-muted)] transition-[background-color,color,transform] duration-200 ease-lm hover:bg-[var(--dash-track)] hover:text-[var(--dash-text)] focus-visible:outline-2 focus-visible:outline-lm-deep active:scale-95";

const chip =
  "rounded-full border border-[var(--dash-border)] px-3 py-1 text-sm font-medium transition-[border-color,background-color] duration-200 ease-lm hover:border-lm-sky hover:bg-lm-sky/10 focus-visible:outline-2 focus-visible:outline-lm-deep disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Date field in the app's style: type the day ("24/11/2026", "24112026") or
 * pick it from a calendar. The calendar opens on the chosen day, starts weeks
 * on Monday, jumps by month or year (click the title), and works with the
 * keyboard: arrows move by day/week, PageUp/PageDown by month (with Shift by
 * year), Home/End to the week's ends, Enter picks, Escape closes.
 */
export function DatePicker({
  label,
  ariaLabel,
  name,
  id,
  value,
  defaultValue = "",
  onChange,
  min,
  max,
  required,
  error,
  hint,
  today: todayProp,
  shortcuts = "today",
  weekStart = "MONDAY",
}: Props) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const panelId = `${inputId}-calendar`;
  const controlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue);
  const selected = controlled ? value : internal;
  const [text, setText] = useState(selected ? formatDmy(selected) : "");
  // A new value from outside (e.g. "Chia đều") replaces what is shown.
  const [shownValue, setShownValue] = useState(selected);
  if (selected !== shownValue) {
    setShownValue(selected);
    if (parseDateInput(text) !== selected) setText(selected ? formatDmy(selected) : "");
  }

  const [today] = useState(() => todayProp ?? localToday());
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("days");
  const [month, setMonth] = useState((selected || today).slice(0, 7));
  const [focusedDay, setFocusedDay] = useState(selected || today);
  const [alignRight, setAlignRight] = useState(false);
  const focusDay = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const parsed = parseDateInput(text);
  const typedInvalid = text.trim() !== "" && parsed === null;
  const inRange = (key: string) => (!min || key >= min) && (!max || key <= max);

  const set = (key: string) => {
    if (controlled) onChange?.(key);
    else setInternal(key);
  };
  const choose = (key: string) => {
    set(key);
    setText(key ? formatDmy(key) : "");
    close(true);
  };
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };
  const openCalendar = () => {
    const start =
      parsed && inRange(parsed)
        ? parsed
        : selected || (inRange(today) ? today : max || min || today);
    setMonth(start.slice(0, 7));
    setFocusedDay(start);
    setView("days");
    const left = rootRef.current?.getBoundingClientRect().left ?? 0;
    setAlignRight(left + 320 > window.innerWidth - 8);
    focusDay.current = true;
    setOpen(true);
  };

  // Escape and a click outside close the calendar.
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

  // Keyboard moves (and opening) put focus on the day they land on.
  useLayoutEffect(() => {
    if (!open || view !== "days" || !focusDay.current) return;
    focusDay.current = false;
    gridRef.current?.querySelector<HTMLElement>(`[data-day="${focusedDay}"]`)?.focus();
  }, [open, view, focusedDay, month]);

  const moveFocus = (key: string) => {
    if (!inRange(key)) return;
    focusDay.current = true;
    setFocusedDay(key);
    setMonth(key.slice(0, 7));
  };

  const onGridKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const weekday =
      (new Date(`${focusedDay}T00:00:00Z`).getUTCDay() + (weekStart === "MONDAY" ? 6 : 0)) % 7;
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDays(focusedDay, -1),
      ArrowRight: () => addDays(focusedDay, 1),
      ArrowUp: () => addDays(focusedDay, -7),
      ArrowDown: () => addDays(focusedDay, 7),
      Home: () => addDays(focusedDay, -weekday),
      End: () => addDays(focusedDay, 6 - weekday),
      PageUp: () => addMonthsToDateKey(focusedDay, event.shiftKey ? -12 : -1),
      PageDown: () => addMonthsToDateKey(focusedDay, event.shiftKey ? 12 : 1),
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    moveFocus(move());
  };

  const year = Number(month.slice(0, 4));
  const decadeStart = Math.floor(year / 12) * 12;
  const title =
    view === "days"
      ? `${MONTH_NAMES[Number(month.slice(5)) - 1]}, ${year}`
      : view === "months"
        ? String(year)
        : `${decadeStart} – ${decadeStart + 11}`;
  const step = (direction: -1 | 1) => {
    if (view === "days") setMonth(addMonthsToDateKey(`${month}-01`, direction).slice(0, 7));
    else if (view === "months") setMonth(`${year + direction}${month.slice(4)}`);
    else setMonth(`${year + direction * 12}${month.slice(4)}`);
  };
  const stepLabel = (direction: -1 | 1) =>
    view === "days"
      ? direction < 0
        ? "Tháng trước"
        : "Tháng sau"
      : view === "months"
        ? direction < 0
          ? "Năm trước"
          : "Năm sau"
        : direction < 0
          ? "12 năm trước"
          : "12 năm sau";

  const yesterday = addDays(today, -1);
  const describedBy = [hint && !error && `${inputId}-hint`, error && `${inputId}-error`]
    .filter(Boolean)
    .join(" ");
  // Within the visible month, the focused day (or the 1st) is the one tab stop.
  const tabStop = focusedDay.startsWith(month) ? focusedDay : `${month}-01`;

  return (
    <div ref={rootRef} className={`flex flex-col gap-2 ${open ? "relative z-40" : "relative"}`}>
      {label ? (
        <label htmlFor={inputId} className="font-medium">
          {label}
        </label>
      ) : null}
      <div className="relative">
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="dd/mm/yyyy"
          aria-label={label ? undefined : ariaLabel}
          aria-invalid={error || typedInvalid ? true : undefined}
          aria-describedby={describedBy || undefined}
          required={required}
          value={text}
          onChange={(event) => {
            const next = event.target.value;
            setText(next);
            const key = parseDateInput(next);
            if (key) set(key);
            else if (next.trim() === "") set("");
          }}
          onBlur={() => {
            if (parsed) setText(formatDmy(parsed));
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && event.altKey) {
              event.preventDefault();
              openCalendar();
            }
          }}
          className={`${brandControl} pr-12 tabular-nums`}
        />
        <button
          ref={buttonRef}
          type="button"
          aria-label="Mở lịch"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          onClick={() => (open ? close(false) : openCalendar())}
          className={`absolute top-1/2 right-1.5 grid size-9 -translate-y-1/2 place-items-center rounded-lg transition-[background-color,color] duration-200 ease-lm hover:bg-[var(--dash-track)] focus-visible:outline-2 focus-visible:outline-lm-deep ${
            open ? "bg-lm-sky/15 text-lm-deep dark:text-lm-aqua" : "text-[var(--dash-muted)]"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3.5" y="5" width="17" height="15" rx="3" />
            <path d="M3.5 10h17M8 3v4M16 3v4" />
            <circle cx="12" cy="15" r="1.2" fill="currentColor" stroke="none" />
          </svg>
        </button>
      </div>
      {name ? <input type="hidden" name={name} value={parsed ?? text.trim()} /> : null}
      <FieldMessages
        id={inputId}
        hint={hint}
        error={error ?? (typedInvalid ? "Ngày không hợp lệ, ví dụ: 24/11/2026." : undefined)}
      />

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={label ? `Chọn ${label.toLowerCase()}` : "Chọn ngày"}
          className={`absolute top-full z-40 mt-2 w-[20rem] max-w-[calc(100vw-2rem)] origin-top animate-[lm-dialog-in_200ms_var(--ease-lm)] rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-3 text-[var(--dash-text)] shadow-[0_24px_60px_rgb(6_43_69/0.22)] ${
            alignRight ? "right-0" : "left-0"
          }`}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label={stepLabel(-1)}
              onClick={() => step(-1)}
              className={navButton}
            >
              ‹
            </button>
            <button
              type="button"
              aria-live="polite"
              disabled={view === "years"}
              aria-label={
                view === "days"
                  ? `${title}. Chọn tháng khác`
                  : view === "months"
                    ? `Năm ${title}. Chọn năm khác`
                    : undefined
              }
              onClick={() => setView(view === "days" ? "months" : "years")}
              className="flex items-center gap-1 rounded-xl px-3 py-1.5 font-bold transition-colors duration-200 hover:bg-[var(--dash-track)] focus-visible:outline-2 focus-visible:outline-lm-deep disabled:hover:bg-transparent"
            >
              {title}
              {view !== "years" ? (
                <span aria-hidden="true" className="text-sm text-[var(--dash-muted)]">
                  ▾
                </span>
              ) : null}
            </button>
            <button
              type="button"
              aria-label={stepLabel(1)}
              onClick={() => step(1)}
              className={navButton}
            >
              ›
            </button>
          </div>

          {view === "days" ? (
            <div
              ref={gridRef}
              role="grid"
              aria-label={title}
              onKeyDown={onGridKeyDown}
              key={month}
              className="animate-[lm-fade-in_180ms_ease-out]"
            >
              <div role="row" className="grid grid-cols-7">
                {weekdayHeaders(weekStart).map((day) => (
                  <span
                    key={day.short}
                    role="columnheader"
                    aria-label={day.name}
                    className={`grid h-8 place-items-center text-xs font-bold ${
                      day.short === "CN"
                        ? "text-red-600 dark:text-red-400"
                        : "text-[var(--dash-muted)]"
                    }`}
                  >
                    {day.short}
                  </span>
                ))}
              </div>
              {monthGrid(month, weekStart).map((week) => (
                <div key={week[0]} role="row" className="grid grid-cols-7">
                  {week.map((day) => {
                    const outside = !day.startsWith(month);
                    const isSelected = day === selected;
                    const isToday = day === today;
                    const disabled = !inRange(day);
                    const sunday = new Date(`${day}T00:00:00Z`).getUTCDay() === 0;
                    return (
                      <div key={day} role="gridcell" className="grid place-items-center py-0.5">
                        <button
                          type="button"
                          data-day={day}
                          tabIndex={day === tabStop ? 0 : -1}
                          aria-label={dayLabel(day)}
                          aria-pressed={isSelected}
                          aria-current={isToday ? "date" : undefined}
                          disabled={disabled}
                          onClick={() => choose(day)}
                          onFocus={() => setFocusedDay(day)}
                          className={`relative grid size-10 place-items-center rounded-xl text-[0.95rem] tabular-nums transition-[background-color,color,transform] duration-150 ease-lm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-lm-deep active:scale-90 disabled:cursor-not-allowed disabled:opacity-30 ${
                            isSelected
                              ? "bg-lm-sky font-bold text-lm-ink shadow-[0_6px_14px_color-mix(in_srgb,var(--lm-sky)_40%,transparent)]"
                              : outside
                                ? "text-[var(--dash-muted)]/55 hover:bg-[var(--dash-track)]"
                                : sunday
                                  ? "text-red-600 hover:bg-[var(--dash-track)] dark:text-red-400"
                                  : "hover:bg-[var(--dash-track)]"
                          } ${isToday && !isSelected ? "font-bold ring-2 ring-lm-sky/70 ring-inset" : ""}`}
                        >
                          {Number(day.slice(8))}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : view === "months" ? (
            <div className="grid animate-[lm-fade-in_180ms_ease-out] grid-cols-3 gap-2 py-1">
              {MONTH_NAMES.map((monthName, index) => {
                const key = `${year}-${String(index + 1).padStart(2, "0")}`;
                const current = selected.startsWith(key);
                const outOfRange =
                  (max !== undefined && `${key}-01` > max) ||
                  (min !== undefined && addDays(addMonthsToDateKey(`${key}-01`, 1), -1) < min);
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={outOfRange}
                    aria-pressed={current}
                    onClick={() => {
                      setMonth(key);
                      setView("days");
                    }}
                    className={`h-11 rounded-xl text-sm font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-lm-deep disabled:cursor-not-allowed disabled:opacity-30 ${
                      current ? "bg-lm-sky font-bold text-lm-ink" : "hover:bg-[var(--dash-track)]"
                    }`}
                  >
                    {monthName}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid animate-[lm-fade-in_180ms_ease-out] grid-cols-3 gap-2 py-1">
              {Array.from({ length: 12 }, (_, i) => decadeStart + i).map((y) => {
                const current = selected.startsWith(String(y));
                const outOfRange =
                  (max !== undefined && `${y}-01-01` > max) ||
                  (min !== undefined && `${y}-12-31` < min);
                return (
                  <button
                    key={y}
                    type="button"
                    disabled={outOfRange}
                    aria-pressed={current}
                    onClick={() => {
                      setMonth(`${y}${month.slice(4)}`);
                      setView("months");
                    }}
                    className={`h-11 rounded-xl text-sm font-medium tabular-nums transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-lm-deep disabled:cursor-not-allowed disabled:opacity-30 ${
                      current ? "bg-lm-sky font-bold text-lm-ink" : "hover:bg-[var(--dash-track)]"
                    }`}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-[var(--dash-border)] pt-3">
            <button
              type="button"
              disabled={!inRange(today)}
              onClick={() => choose(today)}
              className={chip}
            >
              Hôm nay
            </button>
            {shortcuts === "recent" ? (
              <button
                type="button"
                disabled={!inRange(yesterday)}
                onClick={() => choose(yesterday)}
                className={chip}
              >
                Hôm qua
              </button>
            ) : null}
            {!required && selected ? (
              <button
                type="button"
                onClick={() => choose("")}
                className={`${chip} ml-auto text-[var(--dash-muted)]`}
              >
                Xóa
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
