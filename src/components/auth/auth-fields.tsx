"use client";

import { useState, type InputHTMLAttributes, type ReactNode } from "react";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  name: string;
  label: string;
  error?: string;
  hint?: string;
};

const inputClass =
  "h-12 w-full rounded-xl border border-[var(--auth-border)] bg-[var(--auth-surface)] px-4 text-base text-[var(--auth-text)] outline-none transition-[border-color,box-shadow] duration-200 ease-lm placeholder:text-[var(--auth-muted)]/70 hover:border-lm-sky/70 focus-visible:border-lm-sky focus-visible:shadow-[0_0_0_4px_color-mix(in_srgb,var(--lm-aqua)_55%,transparent)] aria-invalid:border-red-600 aria-invalid:focus-visible:shadow-[0_0_0_4px_rgb(220_38_38/0.15)]";

function describedBy(id: string, hint?: string, error?: string): string | undefined {
  return (
    [hint && !error && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined
  );
}

function FieldMessages({ id, hint, error }: { id: string; hint?: string; error?: string }) {
  return (
    <>
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-sm text-[var(--auth-muted)]">
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

/** Labelled input for the auth screens, with an accessible hint and error. */
export function AuthField({ name, label, error, hint, id = name, ...inputProps }: FieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={inputClass}
        {...inputProps}
      />
      <FieldMessages id={id} hint={hint} error={error} />
    </div>
  );
}

/** Password input with a show/hide toggle, so people can check what they typed. */
export function PasswordField({ name, label, error, hint, id = name, ...inputProps }: FieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          className={`${inputClass} pr-14`}
          {...inputProps}
        />
        <button
          type="button"
          aria-controls={id}
          aria-pressed={visible}
          aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          onClick={() => setVisible((value) => !value)}
          className="absolute inset-y-1.5 right-1.5 grid w-10 place-items-center rounded-lg text-[var(--auth-muted)] transition-colors duration-200 hover:bg-[var(--auth-tab-track)] hover:text-[var(--auth-text)] focus-visible:outline-2 focus-visible:outline-lm-deep"
        >
          <EyeIcon crossed={visible} />
        </button>
      </div>
      <FieldMessages id={id} hint={hint} error={error} />
    </div>
  );
}

function EyeIcon({ crossed }: { crossed: boolean }) {
  return (
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
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
      <path
        d="M4 20 20 4"
        className="origin-center transition-[stroke-dashoffset] duration-300 ease-lm"
        strokeDasharray="23"
        strokeDashoffset={crossed ? 0 : 23}
      />
    </svg>
  );
}

export function AuthAlert({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="animate-lm-rise rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-900 [animation-duration:280ms] dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-200"
    >
      {children}
    </p>
  );
}

export function AuthSubmit({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="relative mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-lm-sky font-bold text-lm-ink shadow-[0_6px_16px_color-mix(in_srgb,var(--lm-sky)_35%,transparent)] transition-[background-color,box-shadow,transform] duration-200 ease-lm hover:bg-[var(--lm-sky-hover)] hover:shadow-[0_10px_24px_color-mix(in_srgb,var(--lm-sky)_45%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lm-deep active:scale-[0.98] disabled:cursor-progress disabled:opacity-80"
    >
      {pending ? (
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
      ) : null}
      {children}
    </button>
  );
}
