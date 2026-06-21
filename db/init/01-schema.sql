CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE IF NOT EXISTS app.clientes (
    id BIGINT PRIMARY KEY,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    nome TEXT NOT NULL,
    nome_fantasia TEXT NOT NULL DEFAULT '',
    pessoa_tipo INTEGER NOT NULL DEFAULT 2,
    cpf_cnpj TEXT NOT NULL UNIQUE,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app.contatos (
    id BIGSERIAL PRIMARY KEY,
    cliente_id BIGINT NOT NULL REFERENCES app.clientes(id),
    nome TEXT NOT NULL,
    email TEXT,
    telefone TEXT NOT NULL,
    padrao BOOLEAN NOT NULL DEFAULT FALSE,
    whatsapp_opt_out BOOLEAN NOT NULL DEFAULT FALSE,
    whatsapp_opt_out_at TIMESTAMPTZ,
    whatsapp_opt_out_reason TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app.contas_receber (
    id BIGINT PRIMARY KEY,
    cliente_id BIGINT NOT NULL REFERENCES app.clientes(id),
    tenant_id INTEGER NOT NULL DEFAULT 1,
    situacao TEXT NOT NULL,
    situacao_id INTEGER NOT NULL DEFAULT 1,
    tipo_operacao TEXT NOT NULL DEFAULT 'Servico',
    id_operacao TEXT NOT NULL DEFAULT '',
    documento TEXT NOT NULL DEFAULT '',
    data_hora_cadastro TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data_hora_manutencao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    historico TEXT NOT NULL DEFAULT '',
    forma_pagamento TEXT NOT NULL DEFAULT 'Boleto',
    total_parcelas TEXT NOT NULL DEFAULT '1',
    numero_parcela INTEGER NOT NULL DEFAULT 1,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
    desconto_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    juros_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    multa_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    data_vencimento DATE NOT NULL,
    valor_pago NUMERIC(12, 2) NOT NULL DEFAULT 0,
    data_pagamento DATE,
    imposto_retido NUMERIC(12, 2) NOT NULL DEFAULT 0,
    CONSTRAINT contas_receber_situacao_check CHECK (situacao IN ('EmAberto', 'Pago'))
);

CREATE TABLE IF NOT EXISTS app.boletos (
    id BIGINT PRIMARY KEY,
    conta_receber_id BIGINT NOT NULL REFERENCES app.contas_receber(id),
    tenant_id INTEGER NOT NULL DEFAULT 1,
    cprf TEXT NOT NULL,
    vencimento DATE NOT NULL,
    valor NUMERIC(12, 2) NOT NULL,
    nosso_numero TEXT NOT NULL,
    linha_digitavel TEXT NOT NULL,
    binario TEXT NOT NULL,
    whatsapp_status BOOLEAN,
    whatsapp_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app.cobrancas_whatsapp (
    id BIGSERIAL PRIMARY KEY,
    boleto_id BIGINT NOT NULL REFERENCES app.boletos(id),
    tenant_id INTEGER NOT NULL DEFAULT 1,
    cliente_id BIGINT NOT NULL REFERENCES app.clientes(id),
    telefone TEXT NOT NULL,
    status BOOLEAN NOT NULL,
    message TEXT NOT NULL DEFAULT '',
    sent_text TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'general',
    policy_type TEXT NOT NULL DEFAULT 'campaign',
    dedupe_key TEXT NOT NULL DEFAULT '',
    direction TEXT NOT NULL DEFAULT 'outbound',
    channel TEXT NOT NULL DEFAULT 'whatsapp',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app.atendimentos_chat (
    id BIGSERIAL PRIMARY KEY,
    cliente_id BIGINT REFERENCES app.clientes(id),
    telefone TEXT NOT NULL,
    documento_informado TEXT,
    role TEXT NOT NULL,
    message TEXT NOT NULL,
    intent TEXT,
    channel TEXT NOT NULL DEFAULT 'whatsapp',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app.alteracoes_vencimento (
    id BIGSERIAL PRIMARY KEY,
    boleto_id BIGINT NOT NULL REFERENCES app.boletos(id),
    tenant_id INTEGER NOT NULL DEFAULT 1,
    cliente_id BIGINT NOT NULL REFERENCES app.clientes(id),
    requested_document TEXT NOT NULL,
    requested_phone TEXT NOT NULL,
    previous_due_date DATE NOT NULL,
    new_due_date DATE NOT NULL,
    reason TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'whatsapp',
    requested_by TEXT NOT NULL DEFAULT 'cliente',
    status TEXT NOT NULL DEFAULT 'approved',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app.chatbot_conversation_state (
    telefone TEXT PRIMARY KEY,
    cliente_id BIGINT REFERENCES app.clientes(id),
    current_state TEXT NOT NULL DEFAULT 'idle',
    active_flow TEXT NOT NULL DEFAULT '',
    last_intent TEXT NOT NULL DEFAULT '',
    context JSONB NOT NULL DEFAULT '{}'::jsonb,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app.parametros_mvp (
    chave TEXT PRIMARY KEY,
    valor TEXT NOT NULL,
    descricao TEXT NOT NULL DEFAULT ''
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'contas_receber_situacao_check'
          AND conrelid = 'app.contas_receber'::regclass
    ) THEN
        ALTER TABLE app.contas_receber
            ADD CONSTRAINT contas_receber_situacao_check
            CHECK (situacao IN ('EmAberto', 'Pago'));
    END IF;
END $$;

COMMENT ON TABLE app.clientes IS 'Clientes do tenant usados no MVP de contas a receber.';
COMMENT ON COLUMN app.clientes.id IS 'Identificador unico do cliente.';
COMMENT ON COLUMN app.clientes.tenant_id IS 'Identificador do tenant proprietario do cliente.';
COMMENT ON COLUMN app.clientes.nome IS 'Razao social ou nome principal do cliente.';
COMMENT ON COLUMN app.clientes.nome_fantasia IS 'Nome comercial ou nome fantasia do cliente.';
COMMENT ON COLUMN app.clientes.pessoa_tipo IS 'Tipo de pessoa do cliente conforme origem do ERP.';
COMMENT ON COLUMN app.clientes.cpf_cnpj IS 'Documento fiscal do cliente, CPF ou CNPJ.';
COMMENT ON COLUMN app.clientes.ativo IS 'Indica se o cliente esta ativo.';
COMMENT ON COLUMN app.clientes.created_at IS 'Data e hora de criacao do cliente no MVP.';
COMMENT ON COLUMN app.clientes.updated_at IS 'Data e hora da ultima atualizacao do cliente no MVP.';

COMMENT ON TABLE app.contatos IS 'Contatos vinculados aos clientes para atendimento e cobranca.';
COMMENT ON COLUMN app.contatos.id IS 'Identificador unico do contato.';
COMMENT ON COLUMN app.contatos.cliente_id IS 'Cliente dono do contato.';
COMMENT ON COLUMN app.contatos.nome IS 'Nome da pessoa ou area de contato.';
COMMENT ON COLUMN app.contatos.email IS 'Email do contato, quando disponivel.';
COMMENT ON COLUMN app.contatos.telefone IS 'Telefone do contato usado para atendimento e WhatsApp.';
COMMENT ON COLUMN app.contatos.padrao IS 'Indica se este e o contato preferencial do cliente.';
COMMENT ON COLUMN app.contatos.whatsapp_opt_out IS 'Indica se o contato bloqueou cobrancas automaticas por WhatsApp.';
COMMENT ON COLUMN app.contatos.whatsapp_opt_out_at IS 'Data e hora em que o opt-out de WhatsApp foi registrado.';
COMMENT ON COLUMN app.contatos.whatsapp_opt_out_reason IS 'Motivo ou origem do opt-out de WhatsApp.';
COMMENT ON COLUMN app.contatos.created_at IS 'Data e hora de criacao do contato.';

COMMENT ON TABLE app.contas_receber IS 'Titulos financeiros a receber, pagos ou em aberto.';
COMMENT ON COLUMN app.contas_receber.id IS 'Identificador unico do titulo a receber.';
COMMENT ON COLUMN app.contas_receber.cliente_id IS 'Cliente relacionado ao titulo.';
COMMENT ON COLUMN app.contas_receber.tenant_id IS 'Identificador do tenant proprietario do titulo.';
COMMENT ON COLUMN app.contas_receber.situacao IS 'Valores permitidos: EmAberto, Pago. EmAberto inclui titulos nao pagos; inadimplencia deve ser inferida por situacao = ''EmAberto'' AND data_vencimento < CURRENT_DATE.';
COMMENT ON COLUMN app.contas_receber.situacao_id IS 'Codigo numerico da situacao conforme origem do ERP.';
COMMENT ON COLUMN app.contas_receber.tipo_operacao IS 'Tipo de operacao que originou o titulo.';
COMMENT ON COLUMN app.contas_receber.id_operacao IS 'Identificador da operacao de origem.';
COMMENT ON COLUMN app.contas_receber.documento IS 'Documento interno do titulo a receber.';
COMMENT ON COLUMN app.contas_receber.data_hora_cadastro IS 'Data e hora de cadastro do titulo.';
COMMENT ON COLUMN app.contas_receber.data_hora_manutencao IS 'Data e hora da ultima manutencao do titulo.';
COMMENT ON COLUMN app.contas_receber.historico IS 'Descricao ou historico do titulo.';
COMMENT ON COLUMN app.contas_receber.forma_pagamento IS 'Forma de pagamento prevista para o titulo.';
COMMENT ON COLUMN app.contas_receber.total_parcelas IS 'Quantidade total de parcelas da operacao.';
COMMENT ON COLUMN app.contas_receber.numero_parcela IS 'Numero da parcela deste titulo.';
COMMENT ON COLUMN app.contas_receber.subtotal IS 'Valor original antes de descontos, juros e multa.';
COMMENT ON COLUMN app.contas_receber.desconto_total IS 'Valor total de desconto aplicado.';
COMMENT ON COLUMN app.contas_receber.juros_total IS 'Valor total de juros aplicado.';
COMMENT ON COLUMN app.contas_receber.multa_total IS 'Valor total de multa aplicado.';
COMMENT ON COLUMN app.contas_receber.total IS 'Valor total do titulo.';
COMMENT ON COLUMN app.contas_receber.data_vencimento IS 'Data de vencimento do titulo. Use junto com situacao para identificar atraso.';
COMMENT ON COLUMN app.contas_receber.valor_pago IS 'Valor pago ate o momento.';
COMMENT ON COLUMN app.contas_receber.data_pagamento IS 'Data de pagamento do titulo, quando quitado.';
COMMENT ON COLUMN app.contas_receber.imposto_retido IS 'Valor de imposto retido no titulo.';

COMMENT ON TABLE app.boletos IS 'Boletos associados aos titulos de contas a receber.';
COMMENT ON COLUMN app.boletos.id IS 'Identificador unico do boleto.';
COMMENT ON COLUMN app.boletos.conta_receber_id IS 'Titulo de contas a receber relacionado ao boleto.';
COMMENT ON COLUMN app.boletos.tenant_id IS 'Identificador do tenant proprietario do boleto.';
COMMENT ON COLUMN app.boletos.cprf IS 'CPF ou CNPJ usado no boleto.';
COMMENT ON COLUMN app.boletos.vencimento IS 'Data de vencimento do boleto.';
COMMENT ON COLUMN app.boletos.valor IS 'Valor do boleto.';
COMMENT ON COLUMN app.boletos.nosso_numero IS 'Identificador bancario do boleto.';
COMMENT ON COLUMN app.boletos.linha_digitavel IS 'Linha digitavel para pagamento do boleto.';
COMMENT ON COLUMN app.boletos.binario IS 'Representacao simplificada do conteudo do boleto no MVP.';
COMMENT ON COLUMN app.boletos.whatsapp_status IS 'Status do ultimo envio de WhatsApp relacionado ao boleto.';
COMMENT ON COLUMN app.boletos.whatsapp_message IS 'Mensagem de retorno do ultimo envio de WhatsApp.';
COMMENT ON COLUMN app.boletos.created_at IS 'Data e hora de criacao do boleto.';
COMMENT ON COLUMN app.boletos.updated_at IS 'Data e hora da ultima atualizacao do boleto.';

COMMENT ON TABLE app.cobrancas_whatsapp IS 'Historico de mensagens de cobranca enviadas por WhatsApp.';
COMMENT ON COLUMN app.cobrancas_whatsapp.id IS 'Identificador unico da cobranca por WhatsApp.';
COMMENT ON COLUMN app.cobrancas_whatsapp.boleto_id IS 'Boleto relacionado a cobranca.';
COMMENT ON COLUMN app.cobrancas_whatsapp.tenant_id IS 'Identificador do tenant proprietario da cobranca.';
COMMENT ON COLUMN app.cobrancas_whatsapp.cliente_id IS 'Cliente relacionado a cobranca.';
COMMENT ON COLUMN app.cobrancas_whatsapp.telefone IS 'Telefone de destino da mensagem.';
COMMENT ON COLUMN app.cobrancas_whatsapp.status IS 'Indica sucesso ou falha no envio.';
COMMENT ON COLUMN app.cobrancas_whatsapp.message IS 'Mensagem de retorno do provedor ou integracao.';
COMMENT ON COLUMN app.cobrancas_whatsapp.sent_text IS 'Texto enviado ao cliente.';
COMMENT ON COLUMN app.cobrancas_whatsapp.category IS 'Categoria da mensagem enviada.';
COMMENT ON COLUMN app.cobrancas_whatsapp.policy_type IS 'Politica aplicada ao envio.';
COMMENT ON COLUMN app.cobrancas_whatsapp.dedupe_key IS 'Chave usada para evitar reenvios duplicados.';
COMMENT ON COLUMN app.cobrancas_whatsapp.direction IS 'Direcao da mensagem, como outbound ou inbound.';
COMMENT ON COLUMN app.cobrancas_whatsapp.channel IS 'Canal usado no atendimento.';
COMMENT ON COLUMN app.cobrancas_whatsapp.metadata IS 'Metadados adicionais do envio em JSON.';
COMMENT ON COLUMN app.cobrancas_whatsapp.created_at IS 'Data e hora do envio ou registro.';

COMMENT ON TABLE app.atendimentos_chat IS 'Historico de mensagens trocadas no atendimento automatizado.';
COMMENT ON COLUMN app.atendimentos_chat.id IS 'Identificador unico da mensagem.';
COMMENT ON COLUMN app.atendimentos_chat.cliente_id IS 'Cliente relacionado, quando identificado.';
COMMENT ON COLUMN app.atendimentos_chat.telefone IS 'Telefone usado na conversa.';
COMMENT ON COLUMN app.atendimentos_chat.documento_informado IS 'CPF ou CNPJ informado pelo usuario, quando houver.';
COMMENT ON COLUMN app.atendimentos_chat.role IS 'Origem da mensagem, como user, assistant ou system.';
COMMENT ON COLUMN app.atendimentos_chat.message IS 'Conteudo da mensagem.';
COMMENT ON COLUMN app.atendimentos_chat.intent IS 'Intencao classificada para a mensagem.';
COMMENT ON COLUMN app.atendimentos_chat.channel IS 'Canal da conversa.';
COMMENT ON COLUMN app.atendimentos_chat.metadata IS 'Metadados adicionais da mensagem em JSON.';
COMMENT ON COLUMN app.atendimentos_chat.created_at IS 'Data e hora da mensagem.';

COMMENT ON TABLE app.alteracoes_vencimento IS 'Registros de solicitacoes de alteracao de vencimento.';
COMMENT ON COLUMN app.alteracoes_vencimento.id IS 'Identificador unico da alteracao.';
COMMENT ON COLUMN app.alteracoes_vencimento.boleto_id IS 'Boleto relacionado a alteracao.';
COMMENT ON COLUMN app.alteracoes_vencimento.tenant_id IS 'Identificador do tenant proprietario da alteracao.';
COMMENT ON COLUMN app.alteracoes_vencimento.cliente_id IS 'Cliente solicitante ou relacionado.';
COMMENT ON COLUMN app.alteracoes_vencimento.requested_document IS 'Documento informado na solicitacao.';
COMMENT ON COLUMN app.alteracoes_vencimento.requested_phone IS 'Telefone informado na solicitacao.';
COMMENT ON COLUMN app.alteracoes_vencimento.previous_due_date IS 'Vencimento anterior.';
COMMENT ON COLUMN app.alteracoes_vencimento.new_due_date IS 'Novo vencimento.';
COMMENT ON COLUMN app.alteracoes_vencimento.reason IS 'Motivo informado para a alteracao.';
COMMENT ON COLUMN app.alteracoes_vencimento.channel IS 'Canal da solicitacao.';
COMMENT ON COLUMN app.alteracoes_vencimento.requested_by IS 'Origem ou autor da solicitacao.';
COMMENT ON COLUMN app.alteracoes_vencimento.status IS 'Status da solicitacao.';
COMMENT ON COLUMN app.alteracoes_vencimento.created_at IS 'Data e hora do registro da alteracao.';

COMMENT ON TABLE app.chatbot_conversation_state IS 'Estado de conversa do chatbot por telefone.';
COMMENT ON COLUMN app.chatbot_conversation_state.telefone IS 'Telefone que identifica a conversa.';
COMMENT ON COLUMN app.chatbot_conversation_state.cliente_id IS 'Cliente relacionado, quando identificado.';
COMMENT ON COLUMN app.chatbot_conversation_state.current_state IS 'Estado atual da conversa.';
COMMENT ON COLUMN app.chatbot_conversation_state.active_flow IS 'Fluxo ativo do chatbot.';
COMMENT ON COLUMN app.chatbot_conversation_state.last_intent IS 'Ultima intencao identificada.';
COMMENT ON COLUMN app.chatbot_conversation_state.context IS 'Contexto da conversa em JSON.';
COMMENT ON COLUMN app.chatbot_conversation_state.expires_at IS 'Data e hora de expiracao do estado.';
COMMENT ON COLUMN app.chatbot_conversation_state.created_at IS 'Data e hora de criacao do estado.';
COMMENT ON COLUMN app.chatbot_conversation_state.updated_at IS 'Data e hora da ultima atualizacao do estado.';

COMMENT ON TABLE app.parametros_mvp IS 'Parametros operacionais do MVP.';
COMMENT ON COLUMN app.parametros_mvp.chave IS 'Chave unica do parametro.';
COMMENT ON COLUMN app.parametros_mvp.valor IS 'Valor configurado para o parametro.';
COMMENT ON COLUMN app.parametros_mvp.descricao IS 'Descricao funcional do parametro.';

-- Faz com que conexoes do usuario postgres busquem o schema app por padrao,
-- sem exigir qualificacao nas queries do api/frontend.
ALTER ROLE postgres SET search_path = app, public;
