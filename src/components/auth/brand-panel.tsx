import { Logo } from "@/components/brand/logo";
import { formatVnd } from "@/lib/money";

/** What a few days in the app look like: real categories, real VND amounts. */
const SAMPLE_ENTRIES = [
  { icon: "🍜", title: "Phở bò", category: "Ăn uống", amount: -45_000 },
  { icon: "💼", title: "Lương tháng 11", category: "Lương", amount: 15_000_000 },
  { icon: "☕", title: "Cà phê sữa đá", category: "Ăn uống", amount: -29_000 },
];

/** Left half of the auth screens on large displays: the brand and what the app does. */
export function BrandPanel() {
  return (
    <aside className="brand-panel relative hidden overflow-hidden bg-[var(--panel-bg)] text-[var(--panel-text)] lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
      {/* Slowly drifting fields of the palette; motion stops with reduced motion. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-[20%] -left-[15%] size-[70%] animate-lm-drift rounded-full bg-[var(--panel-blob-1)] blur-3xl" />
        <div className="absolute top-[35%] -right-[20%] size-[65%] animate-lm-drift-slow rounded-full bg-[var(--panel-blob-2)] blur-3xl" />
        <div className="absolute -bottom-[25%] left-[10%] size-[60%] animate-lm-drift rounded-full bg-[var(--panel-blob-3)] blur-3xl" />
      </div>

      <Logo className="relative" />

      <div className="relative max-w-md">
        <p className="text-[2.5rem] leading-[1.15] font-bold tracking-[-0.02em]">
          Mỗi đồng tiền đều có chỗ của nó.
        </p>
        <p className="mt-4 max-w-[38ch] text-lg text-[var(--panel-text)]/80">
          Ghi một khoản chi trong vài giây. Cuối tháng biết ngay tiền đã đi đâu.
        </p>

        <ul aria-label="Ví dụ giao dịch" className="mt-10 flex flex-col gap-3">
          {SAMPLE_ENTRIES.map((entry, index) => (
            <li
              key={entry.title}
              className="flex animate-lm-rise items-center gap-3 rounded-2xl bg-[var(--panel-card)] px-4 py-3 shadow-[0_8px_24px_rgb(6_43_69/0.08)] backdrop-blur-sm"
              style={{ animationDelay: `${250 + index * 140}ms`, marginLeft: `${index * 1.25}rem` }}
            >
              <span
                aria-hidden="true"
                className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--panel-chip)] text-xl"
              >
                {entry.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{entry.title}</span>
                <span className="block text-sm text-[var(--panel-text)]/70">{entry.category}</span>
              </span>
              <span className="font-bold tabular-nums">
                {entry.amount < 0 ? "−" : "+"}
                {formatVnd(Math.abs(entry.amount))}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-sm text-[var(--panel-text)]/70">
        Dữ liệu của bạn chỉ mình bạn xem được.
      </p>
    </aside>
  );
}
