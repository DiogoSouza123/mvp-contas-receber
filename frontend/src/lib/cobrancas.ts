import { queryRows } from "@/lib/db";

export type CobrancaFilters = {
  tenantId: number;
  status: "all" | "sucesso" | "falha";
  startDate: string;
  endDate: string;
};

type CobrancaDbRow = {
  id: string | number;
  cliente_nome: string;
  telefone: string;
  status: boolean;
  category: string;
  channel: string;
  created_at: string;
};

export type CobrancaRow = {
  id: number;
  clienteNome: string;
  telefone: string;
  status: boolean;
  category: string;
  channel: string;
  createdAt: string;
};

type AtendimentoDbRow = {
  id: string | number;
  telefone: string;
  role: string;
  message: string;
  intent: string | null;
  channel: string;
  created_at: string;
};

export type AtendimentoRow = {
  id: number;
  telefone: string;
  role: string;
  message: string;
  intent: string | null;
  channel: string;
  createdAt: string;
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

export function normalizeCobrancaFilters(
  searchParams: Record<string, string | string[] | undefined>
): CobrancaFilters {
  const tenant = Number(process.env.APP_TENANT_ID || 1);
  const today = currentDateInSaoPaulo();
  const maybeStatus = pickString(searchParams.status).toLowerCase();
  const status: CobrancaFilters["status"] = ["all", "sucesso", "falha"].includes(maybeStatus)
    ? (maybeStatus as CobrancaFilters["status"])
    : "all";

  return {
    tenantId: Number.isFinite(tenant) ? tenant : 1,
    status,
    startDate: pickString(searchParams.startDate) || startOfMonth(today),
    endDate: pickString(searchParams.endDate) || today
  };
}

export async function getCobrancas(filters: CobrancaFilters): Promise<CobrancaRow[]> {
  const params: unknown[] = [filters.tenantId, filters.startDate, filters.endDate];
  let whereSql = "cw.tenant_id = $1 AND cw.created_at::date BETWEEN $2::date AND $3::date";

  if (filters.status === "sucesso") {
    whereSql += " AND cw.status = TRUE";
  } else if (filters.status === "falha") {
    whereSql += " AND cw.status = FALSE";
  }

  const rows = await queryRows<CobrancaDbRow>(
    `
      SELECT
        cw.id,
        c.nome AS cliente_nome,
        cw.telefone,
        cw.status,
        cw.category,
        cw.channel,
        cw.created_at::text AS created_at
      FROM cobrancas_whatsapp cw
      LEFT JOIN clientes c ON c.id = cw.cliente_id
      WHERE ${whereSql}
      ORDER BY cw.created_at DESC
      LIMIT 300
    `,
    params
  );

  return rows.map((row) => ({
    id: toNumber(row.id),
    clienteNome: row.cliente_nome || "-",
    telefone: row.telefone,
    status: row.status,
    category: row.category,
    channel: row.channel,
    createdAt: row.created_at
  }));
}

export async function getAtendimentos(filters: CobrancaFilters): Promise<AtendimentoRow[]> {
  const rows = await queryRows<AtendimentoDbRow>(
    `
      SELECT
        ac.id,
        ac.telefone,
        ac.role,
        ac.message,
        ac.intent,
        ac.channel,
        ac.created_at::text AS created_at
      FROM atendimentos_chat ac
      WHERE ac.created_at::date BETWEEN $1::date AND $2::date
      ORDER BY ac.created_at DESC
      LIMIT 300
    `,
    [filters.startDate, filters.endDate]
  );

  return rows.map((row) => ({
    id: toNumber(row.id),
    telefone: row.telefone,
    role: row.role,
    message: row.message,
    intent: row.intent,
    channel: row.channel,
    createdAt: row.created_at
  }));
}
