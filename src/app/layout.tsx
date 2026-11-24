import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";

// Roboto ships a Vietnamese subset, so diacritics render in the same font.
const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: { default: "Lucky Money", template: "%s · Lucky Money" },
  description: "Quản lý chi tiêu cá nhân",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${roboto.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
