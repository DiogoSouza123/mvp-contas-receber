import Image from "next/image";

import { ManagerChat } from "@/components/ManagerChat";
import { MetricCard } from "@/components/MetricCard";
import { ReceivablesTable } from "@/components/ReceivablesTable";
import { getDashboardSnapshot, normalizeFilters, type DashboardFilters } from "@/lib/dashboard";
import { formatCurrency, formatPercent } from "@/lib/format";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function statusValueLabel(value: DashboardFilters["status"]) {
  if (value === "open") {
    return "Em aberto";
  }
  if (value === "overdue") {
    return "Vencidos";
  }
  if (value === "paid") {
    return "Pagos";
  }
  return "Todos";
}

export default async function Home({ searchParams }: PageProps) {
  const params = (await searchParams) || {};
  const filters = normalizeFilters(params);

  try {
    const snapshot = await getDashboardSnapshot(filters);
    const taxaSucessoWhatsapp =
      snapshot.kpis.totalEnvios === 0
        ? 0
        : (snapshot.kpis.enviosSucesso / snapshot.kpis.totalEnvios) * 100;

    return (
      <main className="page-shell">
        <section className="hero">
          <div className="hero-brand">
            <div className="logo-placeholder">
              <Image
                src="/logo_nippo_elevadores.png"
                alt="Logo da Nippon"
                width={300}
                height={67}
                priority
              />
            </div>
            <div>
              <p className="hero-kicker">Nippon | Operacoes Financeiras</p>
              <h1 className="hero-title">Painel Gerencial de Inadimplencia e Cobrancas</h1>
              <p className="hero-subtitle">
                Visao consolidada com dados diretos do PostgreSQL e apoio de LLM para analises em
                linguagem natural.
              </p>
            </div>
          </div>

          <form method="get" className="filters">
            <div className="input-group">
              <label htmlFor="startDate">Data inicial</label>
              <input type="date" id="startDate" name="startDate" defaultValue={filters.startDate} />
            </div>
            <div className="input-group">
              <label htmlFor="endDate">Data final</label>
              <input type="date" id="endDate" name="endDate" defaultValue={filters.endDate} />
            </div>
            <div className="input-group">
              <label htmlFor="status">Status</label>
              <select id="status" name="status" defaultValue={filters.status}>
                <option value="all">Todos</option>
                <option value="open">Em aberto</option>
                <option value="overdue">Vencidos</option>
                <option value="paid">Pagos</option>
              </select>
            </div>
            <div className="input-group input-grow">
              <label htmlFor="search">Busca</label>
              <input
                id="search"
                name="search"
                type="text"
                placeholder="Cliente, CPF/CNPJ, documento, nosso numero"
                defaultValue={filters.search}
              />
            </div>
            <button type="submit" className="btn-primary">
              Aplicar filtros
            </button>
          </form>
          <p className="filters-footnote">
            Escopo atual: <strong>tenant {filters.tenantId}</strong> | status:{" "}
            <strong>{statusValueLabel(filters.status)}</strong>
          </p>
        </section>

        <section className="metrics-grid">
          <MetricCard
            label="Valor em aberto"
            value={formatCurrency(snapshot.kpis.valorEmAberto)}
            helper={`${snapshot.kpis.titulosEmAberto} titulo(s) em aberto`}
          />
          <MetricCard
            label="Valor vencido"
            value={formatCurrency(snapshot.kpis.valorVencido)}
            helper={`${snapshot.kpis.titulosVencidos} titulo(s) vencido(s)`}
            danger
          />
          <MetricCard
            label="Taxa de inadimplencia"
            value={formatPercent(snapshot.kpis.taxaInadimplencia)}
            helper="Titulos vencidos / titulos em aberto"
          />
          <MetricCard
            label="Recebido no periodo"
            value={formatCurrency(snapshot.kpis.valorRecebido)}
            helper={`${snapshot.kpis.totalTitulos} titulo(s) analisado(s)`}
          />
          <MetricCard
            label="Envios WhatsApp"
            value={`${snapshot.kpis.totalEnvios}`}
            helper={`${snapshot.kpis.enviosSucesso} com sucesso (${formatPercent(taxaSucessoWhatsapp)})`}
          />
        </section>

        <ReceivablesTable rows={snapshot.rows} />
        <ManagerChat />
      </main>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao carregar dados.";
    return (
      <main className="page-shell">
        <section className="panel">
          <h1 className="panel-title">Falha ao carregar dashboard</h1>
          <p className="panel-subtitle">{message}</p>
          <p className="panel-subtitle">
            Verifique `DATABASE_URL` no container do frontend e se o Postgres esta ativo.
          </p>
        </section>
      </main>
    );
  }
}
