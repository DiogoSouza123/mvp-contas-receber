"use client";

import { Alert, Card, Col, Row, Statistic } from "antd";
import { Column, Line, Pie } from "@ant-design/charts";

import type { EfetividadeSnapshot } from "@/lib/efetividade";
import { formatCurrency, formatPercent } from "@/lib/format";

type Props = {
  snapshot: EfetividadeSnapshot;
};

// Ocultado a pedido do usuario (2026-06-21). Reativar trocando para true.
const SHOW_HEURISTICA_ALERT = false;

export function EfetividadeCharts({ snapshot }: Props) {
  const { kpis, funil, tendencia } = snapshot;

  const funilData = [
    { etapa: "Enviados", total: funil.totalEnviados },
    { etapa: "Entregues", total: funil.totalEntregues },
    { etapa: "Pagos", total: funil.totalPagos }
  ];

  const distribuicaoData = [
    { tipo: "Em cobrança", valor: kpis.totalEmCobranca },
    { tipo: "Baixado (pago)", valor: kpis.totalBaixados }
  ];

  const tendenciaData = tendencia.flatMap((ponto) => [
    { dia: ponto.dia, tipo: "Entradas em cobrança", total: ponto.entradas },
    { dia: ponto.dia, tipo: "Baixas (pago)", total: ponto.baixas }
  ]);

  return (
    <>
      {SHOW_HEURISTICA_ALERT ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Baixa por ausência é uma heurística"
          description="Sem confirmação real de pagamento por um ERP, os números de 'pago' aqui são inferidos pela reconciliação automática (título sai da janela de cobrança). Títulos vencidos há mais de 365 dias sem pagar podem aparecer incorretamente como pagos."
        />
      ) : null}

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={4}>
          <Card>
            <Statistic title="Entraram em cobrança" value={kpis.totalEntradas} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <Card>
            <Statistic
              title="Taxa de conversão em pagamento"
              value={formatPercent(kpis.taxaConversao)}
              valueStyle={{ color: "#3f8600" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <Card>
            <Statistic title="Valor recuperado" value={formatCurrency(kpis.valorRecuperado)} valueStyle={{ color: "#3f8600" }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <Card>
            <Statistic title="Valor ainda em cobrança ativa" value={formatCurrency(kpis.valorEmCobranca)} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <Card>
            <Statistic title="Tempo médio até a baixa" value={kpis.diasMedioBaixa.toFixed(1)} suffix="dias" />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="Funil de cobrança (no período)">
            <Column data={funilData} xField="etapa" yField="total" height={260} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Situação dos títulos rastreados">
            <Pie data={distribuicaoData} angleField="valor" colorField="tipo" height={260} />
          </Card>
        </Col>
      </Row>

      <Card title="Tendência diária: entradas em cobrança x baixas" style={{ marginTop: 16 }}>
        <Line data={tendenciaData} xField="dia" yField="total" seriesField="tipo" height={300} />
      </Card>
    </>
  );
}
