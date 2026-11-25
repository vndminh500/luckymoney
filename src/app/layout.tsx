import type { Metadata, Viewport } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";

import { APP_THEME_COLOR } from "@/app/manifest";
import { ServiceWorker } from "@/components/service-worker";
import { THEME_COOKIE } from "@/lib/theme";

// Roboto ships a Vietnamese subset, so diacritics render in the same font.
const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: { default: "Lucky Money", template: "%s · Lucky Money" },
  description: "Quản lý chi tiêu cá nhân",
  applicationName: "Lucky Money",
  appleWebApp: { capable: true, title: "Lucky Money", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = { themeColor: APP_THEME_COLOR };

/**
 * Applies the saved theme (Cài đặt > Giao diện) before the first paint, from a
 * cookie the settings page writes. Reading it here in the browser keeps the
 * root layout static; without the cookie the theme follows the system.
 */
const themeScript = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark|system)/);if(m)document.documentElement.dataset.theme=m[1];}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The script may change data-theme before React hydrates.
    <html
      lang="vi"
      data-theme="system"
      className={`${roboto.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
