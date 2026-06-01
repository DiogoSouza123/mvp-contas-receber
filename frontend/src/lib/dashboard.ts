import { queryRows } from "@/lib/db";

export type DashboardStatus = "all" | "open" | "overdue" | "paid";

export type DashboardFilters = {
  tenantId: number;
  startDate: string;
  endDate: string;
  status: DashboardStatus;
  search: string;
};

type KpiRow = {
  total_titulos: string | number;
  titulos_em_aberto: string | number;
  titulos_vencidos: string | number;
  valor_em_aberto: string | number;
  valor_vencido: string | number;
  valor_recebido: string | number;
};

type WhatsappRow = {
  total_envios: string | number;
  envios_sucesso: string | number;
};

type ReceivableDbRow = {
  conta_id: string | number;
  documento: string;
  situacao: string;
  total: string | number;
  data_vencimento: string;
  data_pagamento: string | null;
  cliente_nome: string;
  cliente_fantasia: string;
  cpf_cnpj: string;
  boleto_id: string | number | null;
  nosso_numero: string | null;
  linha_digitavel: string | null;
  tentativas_cobranca: string | number;
  ultimo_envio: string | null;
  envio_sucesso: boolean;
};

export type ReceivableRow = {
  contaId: number;
  documento: string;
  situacao: string;
  total: number;
  dataVencimento: string;
  dataPagamento: string | null;
  clienteNome: string;
  clienteFantasia: string;
  cpfCnpj: string;
  boletoId: number | null;
  nossoNumero: string | null;
  linhaDigitavel: string | null;
  tentativasCobranca: number;
  ultimoEnvio: string | null;
  envioSucesso: boolean;
  diasAtraso: number;
};

export type DashboardKpis = {
  totalTitulos: number;
  titulosEmAberto: number;
  titulosVencidos: number;
  valorEmAberto: number;
  valorVencido: number;
  valorRecebido: number;
  taxaInadimplencia: number;
  totalEnvios: number;
  enviosSucesso: number;
};

export type DashboardSnapshot = {
  kpis: DashboardKpis;
  rows: ReceivableRow[];
};

function toNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }
  return Number(value);
}

function calculateDaysLate(dueDate: string, status: string) {
  if (status === "Pago") {
    return 0;
  }
  const now = new Date();
  const due = new Date(dueDate);
  const diff = now.getTime() - due.getTime();
  if (diff <= 0) {
    return 0;
  }
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function currentDateInSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo"
  }).format(new Date());
}

function startOfMonth(dateIso: string) {
  return `${dateIso.slice(0, 8)}01`;
}

export function getDefaultFilters(): DashboardFilters {
  const today = currentDateInSaoPaulo();
  const tenant = Number(process.env.APP_TENANT_ID || 1);

  return {
    tenantId: Number.isFinite(tenant) ? tenant : 1,
    startDate: startOfMonth(today),
    endDate: today,
    status: "all",
    search: ""
  };
}

function pickString(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] || "";
  }
  return value || "";
}

export function normalizeFilters(
  searchParams: Record<string, string | string[] | undefined>
): DashboardFilters {
  const defaults = getDefaultFilters();
  const maybeStatus = pickString(searchParams.status).toLowerCase() as DashboardStatus;
  const status: DashboardStatus = ["all", "open", "overdue", "paid"].includes(maybeStatus)
    ? maybeStatus
    : defaults.status;

  return {
    tenantId: defaults.tenantId,
    startDate: pickString(searchParams.startDate) || defaults.startDate,
    endDate: pickString(searchParams.endDate) || defaults.endDate,
    status,
    search: pickString(searchParams.search).trim()
  };
}

function buildWhereClause(filters: DashboardFilters) {
  const params: unknown[] = [filters.tenantId, filters.startDate, filters.endDate];
  const conditions = [
    "cr.tenant_id = $1",
    "cr.data_vencimento BETWEEN $2::date AND $3::date"
  ];
  let index = params.length + 1;

  if (filters.status === "open") {
    conditions.push("cr.situacao <> 'Pago'");
  } else if (filters.status === "overdue") {
    conditions.push("cr.situacao <> 'Pago'");
    conditions.push("cr.data_vencimento < CURRENT_DATE");
  } else if (filters.status === "paid") {
    conditions.push("cr.situacao = 'Pago'");
  }

  if (filters.search) {
    conditions.push(
      `(c.nome ILIKE $${index} OR c.cpf_cnpj ILIKE $${index} OR cr.documento ILIKE $${index} OR COALESCE(b.nosso_numero, '') ILIKE $${index})`
    );
    params.push(`%${filters.search}%`);
  }

  return { whereSql: conditions.join(" AND "), params };
}

export async function getDashboardSnapshot(filters: DashboardFilters): Promise<DashboardSnapshot> {
  const { whereSql, params } = buildWhereClause(filters);

  const kpiRows = await queryRows<KpiRow>(
    `
      SELECT
        COUNT(*)::int AS total_titulos,
        COUNT(*) FILTER (WHERE cr.situacao <> 'Pago')::int AS titulos_em_aberto,
        COUNT(*) FILTER (WHERE cr.situacao <> 'Pago' AND cr.data_vencimento < CURRENT_DATE)::int AS titulos_vencidos,
        COALESCE(SUM(cr.total) FILTER (WHERE cr.situacao <> 'Pago'), 0)::numeric AS valor_em_aberto,
        COALESCE(SUM(cr.total) FILTER (WHERE cr.situacao <> 'Pago' AND cr.data_vencimento < CURRENT_DATE), 0)::numeric AS valor_vencido,
        COALESCE(SUM(cr.valor_pago), 0)::numeric AS valor_recebido
      FROM contas_receber cr
      INNER JOIN clientes c ON c.id = cr.cliente_id
      LEFT JOIN boletos b ON b.conta_receber_id = cr.id
      WHERE ${whereSql}
    `,
    params
  );

  const whatsappRows = await queryRows<WhatsappRow>(
    `
      SELECT
        COUNT(*)::int AS total_envios,
        COUNT(*) FILTER (WHERE cw.status = TRUE)::int AS envios_sucesso
      FROM cobrancas_whatsapp cw
      WHERE cw.tenant_id = $1
        AND cw.created_at::date BETWEEN $2::date AND $3::date
    `,
    [filters.tenantId, filters.startDate, filters.endDate]
  );

  const receivableRows = await queryRows<ReceivableDbRow>(
    `
      SELECT
        cr.id AS conta_id,
        cr.documento,
        cr.situacao,
        cr.total::numeric AS total,
        cr.data_vencimento::text AS data_vencimento,
        cr.data_pagamento::text AS data_pagamento,
        c.nome AS cliente_nome,
        c.nome_fantasia AS cliente_fantasia,
        c.cpf_cnpj,
        b.id AS boleto_id,
        b.nosso_numero,
        b.linha_digitavel,
        COALESCE(w.tentativas, 0)::int AS tentativas_cobranca,
        w.ultimo_envio::text AS ultimo_envio,
        COALESCE(w.teve_sucesso, false) AS envio_sucesso
      FROM contas_receber cr
      INNER JOIN clientes c ON c.id = cr.cliente_id
      LEFT JOIN boletos b ON b.conta_receber_id = cr.id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) AS tentativas,
          MAX(cw.created_at) AS ultimo_envio,
          BOOL_OR(cw.status) AS teve_sucesso
        FROM cobrancas_whatsapp cw
        WHERE cw.boleto_id = b.id
      ) w ON TRUE
      WHERE ${whereSql}
      ORDER BY cr.data_vencimento ASC, cr.id ASC
      LIMIT 150
    `,
    params
  );

  const kpi = kpiRows[0];
  const whatsapp = whatsappRows[0];
  const titulosEmAberto = toNumber(kpi?.titulos_em_aberto);
  const titulosVencidos = toNumber(kpi?.titulos_vencidos);

  return {
    kpis: {
      totalTitulos: toNumber(kpi?.total_titulos),
      titulosEmAberto,
      titulosVencidos,
      valorEmAberto: toNumber(kpi?.valor_em_aberto),
      valorVencido: toNumber(kpi?.valor_vencido),
      valorRecebido: toNumber(kpi?.valor_recebido),
      taxaInadimplencia:
        titulosEmAberto === 0 ? 0 : (titulosVencidos / Math.max(titulosEmAberto, 1)) * 100,
      totalEnvios: toNumber(whatsapp?.total_envios),
      enviosSucesso: toNumber(whatsapp?.envios_sucesso)
    },
    rows: receivableRows.map((row) => ({
      contaId: toNumber(row.conta_id),
      documento: row.documento,
      situacao: row.situacao,
      total: toNumber(row.total),
      dataVencimento: row.data_vencimento,
      dataPagamento: row.data_pagamento,
      clienteNome: row.cliente_nome,
      clienteFantasia: row.cliente_fantasia,
      cpfCnpj: row.cpf_cnpj,
      boletoId: row.boleto_id === null ? null : toNumber(row.boleto_id),
      nossoNumero: row.nosso_numero,
      linhaDigitavel: row.linha_digitavel,
      tentativasCobranca: toNumber(row.tentativas_cobranca),
      ultimoEnvio: row.ultimo_envio,
      envioSucesso: row.envio_sucesso,
      diasAtraso: calculateDaysLate(row.data_vencimento, row.situacao)
    }))
  };
}
