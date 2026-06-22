import { queryRows } from "@/lib/db";

export type EfetividadeFilters = {
  startDate: string;
  endDate: string;
};

type KpiDbRow = {
  total_entradas: string | number;
  total_baixados: string | number;
  total_em_cobranca: string | number;
  valor_recuperado: string | number;
  valor_em_cobranca: string | number;
  dias_medio_baixa: string | number | null;
};

type FunilDbRow = {
  total_enviados: string | number;
  total_entregues: string | number;
  total_pagos: string | number;
};

type TendenciaDbRow = {
  dia: string;
  entradas: string | number;
  baixas: string | number;
};

export type EfetividadeKpis = {
  totalEntradas: number;
  totalBaixados: number;
  totalEmCobranca: number;
  taxaConversao: number;
  valorRecuperado: number;
  valorEmCobranca: number;
  diasMedioBaixa: number;
};

export type FunilEnvio = {
  totalEnviados: number;
  totalEntregues: number;
  totalPagos: number;
};

export type TendenciaPonto = {
  dia: string;
  entradas: number;
  baixas: number;
};

export type EfetividadeSnapshot = {
  kpis: EfetividadeKpis;
  funil: FunilEnvio;
  tendencia: TendenciaPonto[];
};

function toNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }
  return Number(value);
}

function pickString(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] || "";
  }
  return value || "";
}

function currentDateInSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo"
  }).format(new Date());
}

function startOfMonth(dateIso: string) {
  return `${dateIso.slice(0, 8)}01`;
}

export function normalizeEfetividadeFilters(
  searchParams: Record<string, string | string[] | undefined>
): EfetividadeFilters {
  const today = currentDateInSaoPaulo();

  return {
    startDate: pickString(searchParams.startDate) || startOfMonth(today),
    endDate: pickString(searchParams.endDate) || today
  };
}

export async function getEfetividadeSnapshot(filters: EfetividadeFilters): Promise<EfetividadeSnapshot> {
  const params = [filters.startDate, filters.endDate];

  const kpiRows = await queryRows<KpiDbRow>(
    `
      SELECT
        COUNT(*)::int AS total_entradas,
        COUNT(*) FILTER (WHERE ca.status = 'baixado_por_ausencia')::int AS total_baixados,
        COUNT(*) FILTER (WHERE ca.status = 'em_cobranca')::int AS total_em_cobranca,
        COALESCE(SUM(cr.total) FILTER (WHERE ca.status = 'baixado_por_ausencia'), 0)::numeric AS valor_recuperado,
        COALESCE(SUM(cr.total) FILTER (WHERE ca.status = 'em_cobranca'), 0)::numeric AS valor_em_cobranca,
        AVG(cr.data_pagamento - (ca.primeira_cobranca_em AT TIME ZONE 'America/Sao_Paulo')::date) FILTER (WHERE ca.status = 'baixado_por_ausencia') AS dias_medio_baixa
      FROM cobranca_acompanhamento ca
      INNER JOIN contas_receber cr ON cr.id = ca.conta_receber_id
      WHERE (ca.primeira_cobranca_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN $1::date AND $2::date
    `,
    params
  );

  const funilRows = await queryRows<FunilDbRow>(
    `
      SELECT
        COUNT(*)::int AS total_enviados,
        COUNT(*) FILTER (WHERE cw.status = TRUE)::int AS total_entregues,
        COUNT(*) FILTER (WHERE cw.status = TRUE AND cr.situacao = 'Pago')::int AS total_pagos
      FROM cobrancas_whatsapp cw
      LEFT JOIN boletos b ON b.id = cw.boleto_id
      LEFT JOIN contas_receber cr ON cr.id = b.conta_receber_id
      WHERE (cw.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN $1::date AND $2::date
    `,
    params
  );

  const tendenciaRows = await queryRows<TendenciaDbRow>(
    `
      WITH entradas AS (
        SELECT (primeira_cobranca_em AT TIME ZONE 'America/Sao_Paulo')::date AS dia, COUNT(*)::int AS total
        FROM cobranca_acompanhamento
        WHERE (primeira_cobranca_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN $1::date AND $2::date
        GROUP BY 1
      ),
      baixas AS (
        SELECT cr.data_pagamento AS dia, COUNT(*)::int AS total
        FROM cobranca_acompanhamento ca
        INNER JOIN contas_receber cr ON cr.id = ca.conta_receber_id
        WHERE ca.status = 'baixado_por_ausencia'
          AND cr.data_pagamento BETWEEN $1::date AND $2::date
        GROUP BY 1
      )
      SELECT
        COALESCE(e.dia, b.dia)::text AS dia,
        COALESCE(e.total, 0) AS entradas,
        COALESCE(b.total, 0) AS baixas
      FROM entradas e
      FULL OUTER JOIN baixas b ON b.dia = e.dia
      ORDER BY 1
    `,
    params
  );

  const kpi = kpiRows[0];
  const totalEntradas = toNumber(kpi?.total_entradas);
  const totalBaixados = toNumber(kpi?.total_baixados);
  const funil = funilRows[0];

  return {
    kpis: {
      totalEntradas,
      totalBaixados,
      totalEmCobranca: toNumber(kpi?.total_em_cobranca),
      taxaConversao: totalEntradas === 0 ? 0 : (totalBaixados / totalEntradas) * 100,
      valorRecuperado: toNumber(kpi?.valor_recuperado),
      valorEmCobranca: toNumber(kpi?.valor_em_cobranca),
      diasMedioBaixa: toNumber(kpi?.dias_medio_baixa)
    },
    funil: {
      totalEnviados: toNumber(funil?.total_enviados),
      totalEntregues: toNumber(funil?.total_entregues),
      totalPagos: toNumber(funil?.total_pagos)
    },
    tendencia: tendenciaRows.map((row) => ({
      dia: row.dia,
      entradas: toNumber(row.entradas),
      baixas: toNumber(row.baixas)
    }))
  };
}
