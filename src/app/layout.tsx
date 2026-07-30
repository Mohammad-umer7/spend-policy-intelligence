import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Kufi_Arabic } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const notoKufi = Noto_Kufi_Arabic({ variable: "--font-noto-kufi", subsets: ["arabic"] });

export const metadata: Metadata = {
  title: "Spend Policy Intelligence — AI-assisted. Human-reviewed.",
  description:
    "A policy intelligence layer for spend-management platforms. Every verdict is produced by a deterministic policy engine and reviewed by a human.",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // lang/dir start as English and are updated on the client when the reviewer
    // switches locale, so the server and first client render always match.
    <html
      lang="en"
      dir="ltr"
      className={`${geistSans.variable} ${geistMono.variable} ${notoKufi.variable} h-full`}
    >
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
