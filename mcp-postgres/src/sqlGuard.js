import {
  ALLOWED_TABLES,
  MAX_ROW_LIMIT,
  SITUACAO_ALLOWED_VALUES,
  TENANT_ID,
  TENANT_SCOPED_TABLES,
} from "./schemaContract.js";

const allowedTablesSet = new Set(ALLOWED_TABLES);
const tenantScopedSet = new Set(TENANT_SCOPED_TABLES);

function extractTables(sql) {
  const regex = /\b(?:from|join)\s+([a-z0-9_."]+)/gi;
  const found = new Set();
  let match = null;

  while ((match = regex.exec(sql))) {
    const raw = match[1].replace(/"/g, "");
    const table = raw.includes(".") ? raw.split(".").pop() || raw : raw;
    found.add(table.toLowerCase());
  }

  return [...found];
}

function validateSituacaoLiterals(sql) {
  const directComparison = /\bsituacao\s*=\s*'([^']+)'/gi;
  const inComparison = /\bsituacao\s+in\s*\(([^)]+)\)/gi;
  const literals = new Set();
  let match = null;

  while ((match = directComparison.exec(sql))) {
    literals.add(match[1]);
  }

  while ((match = inComparison.exec(sql))) {
    const values = match[1].match(/'([^']+)'/g) || [];
    for (const value of values) {
      literals.add(value.slice(1, -1));
    }
  }

  for (const value of literals) {
    if (!SITUACAO_ALLOWED_VALUES.includes(value)) {
      throw new Error(
        `Valor invalido para contas_receber.situacao: ${value}. Use apenas ${SITUACAO_ALLOWED_VALUES.join(
          " ou "
        )}. Para inadimplencia, combine situacao = 'EmAberto' com data_vencimento < CURRENT_DATE.`
      );
    }
  }
}

function validateTenantFilter(sql, tables) {
  const needsTenantFilter = tables.some((table) => tenantScopedSet.has(table));
  if (!needsTenantFilter) {
    return;
  }

  const tenantFilterPattern = new RegExp(`tenant_id\\s*=\\s*${TENANT_ID}\\b`, "i");
  if (!tenantFilterPattern.test(sql)) {
    throw new Error(
      `A consulta acessa tabela com tenant_id e precisa filtrar explicitamente tenant_id = ${TENANT_ID}.`
    );
  }
}

/**
 * Valida e normaliza uma SQL gerada pela LLM antes de executar.
 * Lanca Error com mensagem segura para devolver ao cliente MCP em caso de violacao.
 */
export function guardSql(rawSql) {
  const trimmed = rawSql.trim().replace(/;+$/, "");
  const lowered = trimmed.toLowerCase();

  if (trimmed.includes(";")) {
    throw new Error("A consulta contem delimitador invalido (multiplos statements).");
  }

  if (!(lowered.startsWith("select") || lowered.startsWith("with"))) {
    throw new Error("A consulta gerada nao e de leitura (precisa comecar com SELECT ou WITH).");
  }

  if (
    /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|copy|call|execute|merge)\b/i.test(
      lowered
    )
  ) {
    throw new Error("A consulta gerada contem comando bloqueado.");
  }

  const tables = extractTables(trimmed);
  if (tables.length === 0) {
    throw new Error("Nao foi possivel identificar nenhuma tabela na consulta.");
  }

  for (const table of tables) {
    if (!allowedTablesSet.has(table)) {
      throw new Error(`Tabela nao permitida na consulta: ${table}`);
    }
  }

  validateSituacaoLiterals(trimmed);
  validateTenantFilter(lowered, tables);

  const limitMatch = lowered.match(/\blimit\s+(\d+)/i);
  if (!limitMatch) {
    return `${trimmed}\nLIMIT ${MAX_ROW_LIMIT}`;
  }

  const requestedLimit = Number(limitMatch[1]);
  if (Number.isFinite(requestedLimit) && requestedLimit <= MAX_ROW_LIMIT) {
    return trimmed;
  }

  return trimmed.replace(/\blimit\s+\d+/i, `LIMIT ${MAX_ROW_LIMIT}`);
}
