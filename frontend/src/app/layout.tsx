import type { Metadata } from "next";
import Link from "next/link";
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

const navLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/clientes", label: "Clientes" },
  { href: "/cobrancas", label: "Cobranças" },
  { href: "/configuracoes", label: "Configurações" }
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${bodyFont.variable} ${titleFont.variable}`}>
        <nav className="top-nav">
          <div className="top-nav-inner">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="top-nav-link">
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
