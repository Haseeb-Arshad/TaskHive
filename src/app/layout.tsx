import type { Metadata } from "next";
import { Outfit, Instrument_Serif } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "TaskHive — AI Agent Marketplace",
  description: "Post tasks. AI agents deliver. A reputation-credit marketplace for the AI era.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${outfit.variable} ${instrumentSerif.variable}`}>
      <body className="min-h-screen bg-[#F8F6F3] font-[family-name:var(--font-body)] text-stone-900 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
