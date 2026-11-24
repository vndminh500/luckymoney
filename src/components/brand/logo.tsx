/**
 * Lucky Money mark: a sky-blue coin with a four-leaf clover pressed into it,
 * "lucky" and "money" in one shape. Colors are the brand palette.
 */
export function LogoMark({ className = "size-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true" focusable="false">
      <circle cx="20" cy="20" r="20" fill="#30AFFF" />
      <circle cx="20" cy="20" r="16" fill="none" stroke="#92EEFF" strokeWidth="1.5" />
      <path
        d="M20 24.5c.6 3 2 5.2 4.2 6.8"
        fill="none"
        stroke="#C4F7CA"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="20" cy="14.6" r="4.6" fill="#D8FFC5" />
      <circle cx="25.4" cy="20" r="4.6" fill="#C4F7CA" />
      <circle cx="20" cy="25.4" r="4.6" fill="#D8FFC5" />
      <circle cx="14.6" cy="20" r="4.6" fill="#C4F7CA" />
      <circle cx="20" cy="20" r="2" fill="#30AFFF" />
    </svg>
  );
}

/** Mark plus the "Lucky Money" wordmark. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark />
      <span className="text-xl font-bold tracking-[-0.01em] whitespace-nowrap">Lucky Money</span>
    </span>
  );
}
