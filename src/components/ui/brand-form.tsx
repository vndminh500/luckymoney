import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

/**
 * Form controls for the brand-styled app pages (inside `.dash-shell`): same
 * look and motion as the sign-in screens, driven by the --dash-* tokens.
 */

/** Shared look of every control; sizes are separate so no two classes conflict. */
const controlBase =
  "rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] text-[var(--dash-text)] outline-none transition-[border-color,box-shadow] duration-200 ease-lm placeholder:text-[var(--dash-muted)]/70 hover:border-lm-sky/70 focus-visible:border-lm-sky focus-visible:shadow-[0_0_0_4px_color-mix(in_srgb,var(--lm-aqua)_55%,transparent)] aria-invalid:border-red-600 aria-invalid:focus-visible:shadow-[0_0_0_4px_rgb(220_38_38/0.15)]";

export const brandControl = `${controlBase} h-12 w-full px-4 text-base`;

/** Smaller controls for toolbars such as list filters. */
export const brandControlCompact = `${controlBase} h-10 px-3 text-sm`;

/** The large amount field. */
const brandControlLarge = `${controlBase} h-16 w-full px-4 text-[1.75rem] font-bold tracking-[-0.01em] tabular-nums`;

export const brandPrimaryButton =
  "inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-lm-sky px-5 font-bold text-lm-ink shadow-[0_6px_16px_color-mix(in_srgb,var(--lm-sky)_35%,transparent)] transition-[background-color,box-shadow,transform] duration-200 ease-lm hover:bg-[var(--lm-sky-hover)] hover:shadow-[0_10px_24px_color-mix(in_srgb,var(--lm-sky)_45%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lm-deep active:scale-[0.98] disabled:cursor-progress disabled:opacity-80";

export const brandSecondaryButton =
  "inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] px-4 font-medium text-[var(--dash-text)] transition-[border-color,background-color,transform] duration-200 ease-lm hover:border-lm-sky focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lm-deep active:scale-[0.98]";

type MessageProps = { id: string; hint?: string; error?: string };

function describedBy({ id, hint, error }: MessageProps): string | undefined {
  return (
    [hint && !error && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined
  );
}

export function FieldMessages({ id, hint, error }: MessageProps) {
  return (
    <>
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-sm text-[var(--dash-muted)]">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={`${id}-error`}
          className="animate-lm-rise text-sm text-red-700 [animation-duration:240ms] dark:text-red-400"
        >
          {error}
        </p>
      ) : null}
    </>
  );
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  /** "large" for the field that matters most, such as the amount. */
  variant?: "default" | "large";
};

export function BrandField({
  name,
  label,
  error,
  hint,
  id = name,
  variant = "default",
  ...inputProps
}: FieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy({ id, hint, error })}
        className={variant === "large" ? brandControlLarge : brandControl}
        {...inputProps}
      />
      <FieldMessages id={id} hint={hint} error={error} />
    </div>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  name: string;
  label: string;
  error?: string;
  children: ReactNode;
};

export function BrandSelect({
  name,
  label,
  error,
  id = name,
  children,
  ...selectProps
}: SelectProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <select
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy({ id, error })}
        className={brandControl}
        {...selectProps}
      >
        {children}
      </select>
      <FieldMessages id={id} error={error} />
    </div>
  );
}

export function BrandAlert({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="animate-lm-rise rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-900 [animation-duration:280ms] dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-200"
    >
      {children}
    </p>
  );
}

export function Spinner() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 animate-spin" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="3"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
