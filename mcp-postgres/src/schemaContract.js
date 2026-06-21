export const ALLOWED_TABLES = [
  "clientes",
  "contatos",
  "contas_receber",
  "boletos",
  "cobrancas_whatsapp",
  "alteracoes_vencimento",
  "atendimentos_chat",
  "chatbot_conversation_state",
  "parametros_mvp",
];

export const MAX_ROW_LIMIT = 120;
export const STATEMENT_TIMEOUT_MS = 5000;

export const TENANT_ID = 1;
export const TENANT_SCOPED_TABLES = [
  "clientes",
  "contas_receber",
  "boletos",
  "cobrancas_whatsapp",
  "alteracoes_vencimento",
];

export const SITUACAO_ALLOWED_VALUES = ["EmAberto", "Pago"];

const BUSINESS_CONCEPTS = [
  {
    name: "inadimplente/devedor/vencido",
    sqlRule:
      "contas_receber.situacao = 'EmAberto' AND contas_receber.data_vencimento < CURRENT_DATE",
    description:
      "Titulo ainda nao pago cuja data de vencimento ja passou. Nunca use esses termos como valor de situacao.",
  },
  {
    name: "em aberto a vencer",
    sqlRule:
      "contas_receber.situacao = 'EmAberto' AND contas_receber.data_vencimento >= CURRENT_DATE",
    description: "Titulo nao pago que ainda nao venceu.",
  },
  {
    name: "pago",
    sqlRule: "contas_receber.situacao = 'Pago'",
    description: "Titulo quitado.",
  },
];

export function renderBusinessConcepts() {
  return BUSINESS_CONCEPTS.map(
    (concept) => `- ${concept.name}: ${concept.sqlRule}. ${concept.description}`
  ).join("\n");
}
