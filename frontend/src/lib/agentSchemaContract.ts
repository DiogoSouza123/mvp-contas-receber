type ColumnContract = {
  name: string;
  description: string;
  allowedValues?: readonly string[];
};

type TableContract = {
  name: string;
  description: string;
  columns: readonly ColumnContract[];
};

type BusinessConcept = {
  name: string;
  sqlRule: string;
  description: string;
};

export class AgentSchemaContract {
  static readonly maxLimit = 120;
  static readonly tenantId = 1;

  static readonly contasReceberSituacao = {
    column: "contas_receber.situacao",
    allowedValues: ["EmAberto", "Pago"] as const,
    forbiddenValues: ["devedor", "devedora", "inadimplente", "vencido", "vencida", "aberto"] as const,
    description:
      "Situação operacional do título. Use apenas EmAberto ou Pago. Não representa diretamente inadimplência."
  };

  static readonly businessConcepts: readonly BusinessConcept[] = [
    {
      name: "inadimplente/devedor/vencido",
      sqlRule: "contas_receber.situacao = 'EmAberto' AND contas_receber.data_vencimento < CURRENT_DATE",
      description:
        "Título ainda não pago cuja data de vencimento já passou. Nunca use esses termos como valor de situação."
    },
    {
      name: "em aberto a vencer",
      sqlRule: "contas_receber.situacao = 'EmAberto' AND contas_receber.data_vencimento >= CURRENT_DATE",
      description: "Título não pago que ainda não venceu."
    },
    {
      name: "pago",
      sqlRule: "contas_receber.situacao = 'Pago'",
      description: "Título quitado."
    }
  ];

  static readonly tables: readonly TableContract[] = [
    {
      name: "clientes",
      description: "Clientes do tenant.",
      columns: [
        { name: "id", description: "Identificador do cliente." },
        { name: "tenant_id", description: "Tenant proprietário do registro." },
        { name: "nome", description: "Razão social ou nome principal." },
        { name: "nome_fantasia", description: "Nome comercial do cliente." },
        { name: "cpf_cnpj", description: "Documento fiscal do cliente." },
        { name: "ativo", description: "Indica se o cliente está ativo." }
      ]
    },
    {
      name: "contatos",
      description: "Contatos vinculados aos clientes.",
      columns: [
        { name: "id", description: "Identificador do contato." },
        { name: "cliente_id", description: "Cliente dono do contato." },
        { name: "nome", description: "Nome do contato." },
        { name: "email", description: "Email do contato." },
        { name: "telefone", description: "Telefone usado para atendimento e WhatsApp." },
        { name: "padrao", description: "Contato preferencial do cliente." },
        { name: "whatsapp_opt_out", description: "Cliente bloqueou cobranças automáticas por WhatsApp." }
      ]
    },
    {
      name: "contas_receber",
      description: "Títulos financeiros a receber.",
      columns: [
        { name: "id", description: "Identificador do título." },
        { name: "cliente_id", description: "Cliente relacionado ao título." },
        { name: "tenant_id", description: "Tenant proprietário do título." },
        {
          name: "situacao",
          description: AgentSchemaContract.contasReceberSituacao.description,
          allowedValues: AgentSchemaContract.contasReceberSituacao.allowedValues
        },
        { name: "documento", description: "Documento interno do título." },
        { name: "total", description: "Valor total do título." },
        { name: "data_vencimento", description: "Data de vencimento do título." },
        { name: "valor_pago", description: "Valor pago até o momento." },
        { name: "data_pagamento", description: "Data de pagamento, quando quitado." }
      ]
    },
    {
      name: "boletos",
      description: "Boletos associados a contas a receber.",
      columns: [
        { name: "id", description: "Identificador do boleto." },
        { name: "conta_receber_id", description: "Título financeiro relacionado." },
        { name: "tenant_id", description: "Tenant proprietário do boleto." },
        { name: "cprf", description: "CPF/CNPJ usado no boleto." },
        { name: "vencimento", description: "Vencimento do boleto." },
        { name: "valor", description: "Valor do boleto." },
        { name: "nosso_numero", description: "Identificador bancário do boleto." },
        { name: "linha_digitavel", description: "Linha digitável para pagamento." }
      ]
    },
    {
      name: "cobrancas_whatsapp",
      description: "Histórico de cobranças enviadas por WhatsApp.",
      columns: [
        { name: "id", description: "Identificador do envio." },
        { name: "boleto_id", description: "Boleto cobrado." },
        { name: "tenant_id", description: "Tenant proprietário do envio." },
        { name: "cliente_id", description: "Cliente cobrado." },
        { name: "telefone", description: "Telefone destino." },
        { name: "status", description: "Sucesso ou falha do envio." },
        { name: "message", description: "Mensagem de retorno do provedor." },
        { name: "created_at", description: "Data e hora do envio." }
      ]
    },
    {
      name: "alteracoes_vencimento",
      description: "Solicitações e registros de alteração de vencimento.",
      columns: [
        { name: "id", description: "Identificador da alteração." },
        { name: "boleto_id", description: "Boleto alterado." },
        { name: "tenant_id", description: "Tenant proprietário da alteração." },
        { name: "cliente_id", description: "Cliente solicitante." },
        { name: "previous_due_date", description: "Vencimento anterior." },
        { name: "new_due_date", description: "Novo vencimento." },
        { name: "reason", description: "Motivo informado." },
        { name: "created_at", description: "Data e hora do registro." }
      ]
    },
    {
      name: "atendimentos_chat",
      description: "Histórico de mensagens do chatbot.",
      columns: [
        { name: "id", description: "Identificador da mensagem." },
        { name: "cliente_id", description: "Cliente relacionado, quando identificado." },
        { name: "telefone", description: "Telefone do atendimento." },
        { name: "role", description: "Origem da mensagem." },
        { name: "message", description: "Conteúdo da mensagem." },
        { name: "intent", description: "Intenção classificada." },
        { name: "created_at", description: "Data e hora da mensagem." }
      ]
    },
    {
      name: "chatbot_conversation_state",
      description: "Estado de conversa do chatbot por telefone.",
      columns: [
        { name: "telefone", description: "Telefone que identifica a conversa." },
        { name: "cliente_id", description: "Cliente relacionado, quando identificado." },
        { name: "current_state", description: "Estado atual da conversa." },
        { name: "active_flow", description: "Fluxo ativo do chatbot." },
        { name: "last_intent", description: "Última intenção identificada." },
        { name: "context", description: "Contexto da conversa em JSON." },
        { name: "expires_at", description: "Data e hora de expiração do estado." },
        { name: "created_at", description: "Data e hora de criação do estado." },
        { name: "updated_at", description: "Data e hora da última atualização do estado." }
      ]
    },
    {
      name: "parametros_mvp",
      description: "Parâmetros operacionais do MVP.",
      columns: [
        { name: "chave", description: "Nome do parâmetro." },
        { name: "valor", description: "Valor configurado." }
      ]
    }
  ];

  static getAllowedTables() {
    return new Set(this.tables.map((table) => table.name));
  }

  static renderSchemaSummary() {
    const tableLines = this.tables.map((table) => {
      const columns = table.columns
        .map((column) => {
          const values = column.allowedValues ? ` valores permitidos: ${column.allowedValues.join(", ")}` : "";
          return `${column.name}${values}`;
        })
        .join(", ");
      return `- ${table.name}(${columns}) - ${table.description}`;
    });

    const conceptLines = this.businessConcepts.map(
      (concept) => `- ${concept.name}: ${concept.sqlRule}. ${concept.description}`
    );

    return [`Tabelas:`, ...tableLines, "", "Conceitos de negócio:", ...conceptLines].join("\n");
  }

  static renderSystemPrompt() {
    return [
      'Você é um analista SQL sênior. Gere somente JSON no formato {"sql":"...","rationale":"..."}.',
      "Use apenas SELECT/CTE leitura. Nunca use comandos de escrita.",
      `Sempre inclua filtro tenant_id=${this.tenantId} quando a tabela possuir tenant_id.`,
      `Sempre inclua LIMIT no máximo ${this.maxLimit}.`,
      `A coluna ${this.contasReceberSituacao.column} aceita apenas: ${this.contasReceberSituacao.allowedValues.join(", ")}.`,
      "Nunca use devedor, inadimplente ou vencido como valor de situação.",
      "Para perguntas sobre devedores, inadimplentes, atraso ou vencidos, aplique: situacao = 'EmAberto' AND data_vencimento < CURRENT_DATE.",
      "Para títulos em aberto ainda não vencidos, aplique: situacao = 'EmAberto' AND data_vencimento >= CURRENT_DATE."
    ].join(" ");
  }

  static validateSql(sql: string) {
    this.validateSituacaoLiterals(sql);
  }

  private static validateSituacaoLiterals(sql: string) {
    const directComparison = /\bsituacao\s*=\s*'([^']+)'/gi;
    const inComparison = /\bsituacao\s+in\s*\(([^)]+)\)/gi;
    const literals = new Set<string>();
    let match: RegExpExecArray | null = null;

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
      if (!this.contasReceberSituacao.allowedValues.includes(value as never)) {
        throw new Error(
          `Valor inválido para contas_receber.situacao: ${value}. Use apenas ${this.contasReceberSituacao.allowedValues.join(
            " ou "
          )}. Para inadimplência, combine situacao = 'EmAberto' com data_vencimento < CURRENT_DATE.`
        );
      }
    }
  }
}
