"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Layout, Menu } from "antd";

const navItems = [
  { key: "/", label: <Link href="/">Dashboard</Link> },
  { key: "/clientes", label: <Link href="/clientes">Clientes</Link> },
  { key: "/cobrancas", label: <Link href="/cobrancas">Cobranças</Link> },
  { key: "/relatorios", label: <Link href="/relatorios">Relatórios</Link> },
  { key: "/configuracoes", label: <Link href="/configuracoes">Configurações</Link> }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Layout.Header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 24,
          paddingInline: 24,
          background: "#e6f4ff"
        }}
      >
        <Image
          src="/logo_nippo_elevadores.png"
          alt="Logo da Nippon"
          width={140}
          height={31}
          priority
          style={{ height: "auto" }}
        />
        <Menu
          theme="light"
          mode="horizontal"
          selectedKeys={[pathname]}
          items={navItems}
          style={{ flex: 1, minWidth: 0, background: "transparent" }}
        />
      </Layout.Header>
      <Layout.Content style={{ padding: 24 }}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>{children}</div>
      </Layout.Content>
    </Layout>
  );
}
