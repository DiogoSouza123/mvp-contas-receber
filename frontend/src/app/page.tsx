import { Card, Col, Row, Statistic } from "antd";

import { DashboardFiltersBar } from "@/components/DashboardFiltersBar";
import { ManagerChat } from "@/components/ManagerChat";
import { ReceivablesTable } from "@/components/ReceivablesTable";
import { getDashboardSnapshot, normalizeFilters } from "@/lib/dashboard";
import { formatCurrency, formatPercent } from "@/lib/format";
import { queryRows } from "@/lib/db";

const DEFAULT_CHAT_HISTORY_LIMIT = 10;

async function getChatHistoryLimit() {
  const rows = await queryRows<{ valor: string }>(
    "SELECT valor FROM parametros_mvp WHERE chave = 'chat_manager_history_limit'"
  );
  const valor = Number(rows[0]?.valor);
  return Number.isFinite(valor) && valor > 0 ? valor : DEFAULT_CHAT_HISTORY_LIMIT;
}

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: PageProps) {
  const params = (await searchParams) || {};
  const filters = normalizeFilters(params);

  try {
    const [snapshot, chatHistoryLimit] = await Promise.all([
      getDashboardSnapshot(filters),
      getChatHistoryLimit()
    ]);
    const taxaSucessoWhatsapp =
      snapshot.kpis.totalEnvios === 0
        ? 0
        : (snapshot.kpis.enviosSucesso / snapshot.kpis.totalEnvios) * 100;

    return (
      <>
        <Card>
          <p className="page-kicker">Nippon | Operações Financeiras</p>
          <h1 className="page-title">Painel Gerencial de Inadimplência e Cobranças</h1>
          <p className="page-subtitle">
            Visão consolidada com dados diretos do PostgreSQL e apoio de LLM para análises em linguagem
            natural.
          </p>
          <DashboardFiltersBar filters={filters} />
        </Card>

        <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
          <Col xs={24} sm={12} lg={8} xl={4}>
            <Card>
              <Statistic
                title="Valor em aberto"
                value={formatCurrency(snapshot.kpis.valorEmAberto)}
                valueStyle={{ fontSize: 22 }}
              />
              <p className="cell-helper">{snapshot.kpis.titulosEmAberto} título(s) em aberto</p>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8} xl={5}>
            <Card>
              <Statistic
                title="Valor vencido"
                value={formatCurrency(snapshot.kpis.valorVencido)}
                valueStyle={{ fontSize: 22, color: "#cf1322" }}
              />
              <p className="cell-helper">{snapshot.kpis.titulosVencidos} título(s) vencido(s)</p>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8} xl={5}>
            <Card>
              <Statistic
                title="Taxa de inadimplência"
                value={formatPercent(snapshot.kpis.taxaInadimplencia)}
                valueStyle={{ fontSize: 22 }}
              />
              <p className="cell-helper">Títulos vencidos / títulos em aberto</p>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8} xl={5}>
            <Card>
              <Statistic
                title="Recebido no período"
                value={formatCurrency(snapshot.kpis.valorRecebido)}
                valueStyle={{ fontSize: 22, color: "#3f8600" }}
              />
              <p className="cell-helper">{snapshot.kpis.totalTitulos} título(s) analisado(s)</p>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8} xl={5}>
            <Card>
              <Statistic title="Envios WhatsApp" value={snapshot.kpis.totalEnvios} valueStyle={{ fontSize: 22 }} />
              <p className="cell-helper">
                {snapshot.kpis.enviosSucesso} com sucesso ({formatPercent(taxaSucessoWhatsapp)})
              </p>
            </Card>
          </Col>
        </Row>

        <ReceivablesTable rows={snapshot.rows} />
        <ManagerChat historyLimit={chatHistoryLimit} />
      </>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao carregar dados.";
    return (
      <Card>
        <h1 className="page-title">Falha ao carregar dashboard</h1>
        <p className="page-subtitle">{message}</p>
        <p className="page-subtitle">Verifique `DATABASE_URL` no container do frontend e se o Postgres está ativo.</p>
      </Card>
    );
  }
}
