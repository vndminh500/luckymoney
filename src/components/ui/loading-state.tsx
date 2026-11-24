/**
 * Placeholder while a page streams in: the rough shape of a page (title,
 * a row of tiles, a panel) so the layout does not jump, announced to screen
 * readers as "Đang tải…". The shimmer stops for people who prefer less motion.
 */
export function LoadingState() {
  const block = "rounded-2xl bg-[var(--dash-track)] motion-safe:animate-pulse";
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-6">
      <span className="sr-only">Đang tải…</span>
      <div aria-hidden="true" className="flex flex-col gap-2">
        <div className={`${block} h-8 w-40 rounded-xl`} />
        <div className={`${block} h-5 w-full max-w-72 rounded-lg`} />
      </div>
      <div aria-hidden="true" className="grid gap-3 sm:grid-cols-3">
        <div className={`${block} h-24`} />
        <div className={`${block} h-24`} />
        <div className={`${block} h-24`} />
      </div>
      <div aria-hidden="true" className={`${block} h-64`} />
    </div>
  );
}
