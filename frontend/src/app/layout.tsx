import type { Metadata } from "next";
import { Manrope, Rajdhani } from "next/font/google";
import { ConfigProvider } from "antd";
import ptBR from "antd/locale/pt_BR";
import { AntdRegistry } from "@ant-design/nextjs-registry";

import "./globals.css";
import { AppShell } from "@/components/AppShell";

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
      <body className={`${bodyFont.variable} ${titleFont.variable}`}>
        <AntdRegistry>
          <ConfigProvider
            locale={ptBR}
            theme={{
              token: {
                colorPrimary: "#e60012",
                colorLink: "#e60012",
                borderRadius: 8,
                fontFamily: "var(--font-body), sans-serif"
              }
            }}
          >
            <AppShell>{children}</AppShell>
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
