import type { Metadata } from "next";
import { Manrope, Rajdhani } from "next/font/google";

import "./globals.css";

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-body"
});

const titleFont = Rajdhani({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-title"
});

export const metadata: Metadata = {
  title: "Nippon | Painel de Cobrança",
  description: "Dashboard gerencial de inadimplência e cobranças."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${bodyFont.variable} ${titleFont.variable}`}>{children}</body>
    </html>
  );
}
