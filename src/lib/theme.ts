/** Cookie that mirrors the saved theme so the root layout can apply it before paint. */
export const THEME_COOKIE = "lm-theme";

/** One year: the cookie only remembers a display preference, never anything secret. */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Applies a theme to the page and remembers it in the cookie (browser only). */
export function applyTheme(theme: "system" | "light" | "dark"): void {
  document.documentElement.dataset.theme = theme;
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`;
}
