import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Inter ships a Vietnamese subset, so diacritics render in the same font.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
});

export const metadata: Metadata = {
  title: { default: "Spendly", template: "%s · Spendly" },
  description: "Quản lý chi tiêu cá nhân",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
