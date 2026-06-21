import { queryRows } from "@/lib/db";

export type ClienteFilters = {
  tenantId: number;
  search: string;
};

type ClienteDbRow = {
  id: string | number;
  nome: string;
  nome_fantasia: string;
  cpf_cnpj: string;
  ativo: boolean;
  total_titulos: string | number;
  titulos_em_aberto: string | number;
  valor_em_aberto: string | number;
};

export type ClienteRow = {
  id: number;
  nome: string;
  nomeFantasia: string;
  cpfCnpj: string;
  ativo: boolean;
  totalTitulos: number;
  titulosEmAberto: number;
  valorEmAberto: number;
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

export function normalizeClienteFilters(
  searchParams: Record<string, string | string[] | undefined>
): ClienteFilters {
  const tenant = Number(process.env.APP_TENANT_ID || 1);

  return {
    tenantId: Number.isFinite(tenant) ? tenant : 1,
    search: pickString(searchParams.search).trim()
  };
}

export async function getClientes(filters: ClienteFilters): Promise<ClienteRow[]> {
  const params: unknown[] = [filters.tenantId];
  let whereSql = "c.tenant_id = $1";

  if (filters.search) {
    params.push(`%${filters.search}%`);
    whereSql += ` AND (c.nome ILIKE $${params.length} OR c.nome_fantasia ILIKE $${params.length} OR c.cpf_cnpj ILIKE $${params.length})`;
  }

  const rows = await queryRows<ClienteDbRow>(
    `
      SELECT
        c.id,
        c.nome,
        c.nome_fantasia,
        c.cpf_cnpj,
        c.ativo,
        COUNT(cr.id)::int AS total_titulos,
        COUNT(cr.id) FILTER (WHERE cr.situacao <> 'Pago')::int AS titulos_em_aberto,
        COALESCE(SUM(cr.total) FILTER (WHERE cr.situacao <> 'Pago'), 0)::numeric AS valor_em_aberto
      FROM clientes c
      LEFT JOIN contas_receber cr ON cr.cliente_id = c.id
      WHERE ${whereSql}
      GROUP BY c.id, c.nome, c.nome_fantasia, c.cpf_cnpj, c.ativo
      ORDER BY c.nome ASC
      LIMIT 200
    `,
    params
  );

  return rows.map((row) => ({
    id: toNumber(row.id),
    nome: row.nome,
    nomeFantasia: row.nome_fantasia,
    cpfCnpj: row.cpf_cnpj,
    ativo: row.ativo,
    totalTitulos: toNumber(row.total_titulos),
    titulosEmAberto: toNumber(row.titulos_em_aberto),
    valorEmAberto: toNumber(row.valor_em_aberto)
  }));
}
