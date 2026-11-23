/**
 * Returns `value` only if it is a same-origin path (e.g. "/transactions?page=2"),
 * otherwise `fallback`. Prevents open redirects through `?callbackUrl=`.
 */
export function safeRedirectPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || !value.startsWith("/")) {
    return fallback;
  }
  // "//evil.com" and "/\evil.com" are protocol-relative URLs to another host.
  if (value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  try {
    const base = "http://localhost";
    const url = new URL(value, base);
    return url.origin === base ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}
