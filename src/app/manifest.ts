import type { MetadataRoute } from "next";

/** Brand blue: the logo's background, used for the Android status bar and splash screen. */
export const APP_THEME_COLOR = "#30AFFF";

/**
 * Web App Manifest (/manifest.webmanifest): makes the site installable
 * ("Thêm vào màn hình chính") and is what PWABuilder reads to build the APK.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Lucky Money",
    short_name: "Lucky Money",
    description: "Quản lý chi tiêu cá nhân",
    lang: "vi",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F3FAFF",
    theme_color: APP_THEME_COLOR,
    categories: ["finance", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
