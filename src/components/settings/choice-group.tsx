import type { ReactNode } from "react";

export type Choice = { value: string; label: string; example?: ReactNode };

type Props = {
  name: string;
  legend: string;
  choices: Choice[];
  defaultValue: string;
  error?: string;
  hint?: string;
};

/** A row of selectable cards backed by radio inputs (keyboard: arrow keys). */
export function ChoiceGroup({ name, legend, choices, defaultValue, error, hint }: Props) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-medium">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]">
        {choices.map((choice) => (
          <label
            key={choice.value}
            className="flex cursor-pointer flex-col gap-0.5 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] px-4 py-3 transition-[border-color,box-shadow,background-color] duration-200 ease-lm hover:border-lm-sky/70 has-checked:border-lm-sky has-checked:bg-lm-sky/10 has-checked:shadow-[0_0_0_3px_rgb(48_175_255/0.25)] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-lm-deep"
          >
            <input
              type="radio"
              name={name}
              value={choice.value}
              defaultChecked={choice.value === defaultValue}
              className="sr-only"
            />
            <span className="font-medium">{choice.label}</span>
            {choice.example ? (
              <span className="text-sm text-[var(--dash-muted)] tabular-nums">
                {choice.example}
              </span>
            ) : null}
          </label>
        ))}
      </div>
      {hint && !error ? <p className="text-sm text-[var(--dash-muted)]">{hint}</p> : null}
      {error ? <p className="text-sm text-red-700 dark:text-red-400">{error}</p> : null}
    </fieldset>
  );
}

export function SettingsCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="animate-lm-rise rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-5 sm:p-6">
      <h2 className="mb-5 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}
