CREATE TABLE IF NOT EXISTS clientes (
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

CREATE TABLE IF NOT EXISTS contatos (
    id BIGSERIAL PRIMARY KEY,
    cliente_id BIGINT NOT NULL REFERENCES clientes(id),
    nome TEXT NOT NULL,
    email TEXT,
    telefone TEXT NOT NULL,
    padrao BOOLEAN NOT NULL DEFAULT FALSE,
    whatsapp_opt_out BOOLEAN NOT NULL DEFAULT FALSE,
    whatsapp_opt_out_at TIMESTAMPTZ,
    whatsapp_opt_out_reason TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contas_receber (
    id BIGINT PRIMARY KEY,
    cliente_id BIGINT NOT NULL REFERENCES clientes(id),
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
    imposto_retido NUMERIC(12, 2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS boletos (
    id BIGINT PRIMARY KEY,
    conta_receber_id BIGINT NOT NULL REFERENCES contas_receber(id),
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

CREATE TABLE IF NOT EXISTS cobrancas_whatsapp (
    id BIGSERIAL PRIMARY KEY,
    boleto_id BIGINT NOT NULL REFERENCES boletos(id),
    tenant_id INTEGER NOT NULL DEFAULT 1,
    cliente_id BIGINT NOT NULL REFERENCES clientes(id),
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

CREATE TABLE IF NOT EXISTS atendimentos_chat (
    id BIGSERIAL PRIMARY KEY,
    cliente_id BIGINT REFERENCES clientes(id),
    telefone TEXT NOT NULL,
    documento_informado TEXT,
    role TEXT NOT NULL,
    message TEXT NOT NULL,
    intent TEXT,
    channel TEXT NOT NULL DEFAULT 'whatsapp',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alteracoes_vencimento (
    id BIGSERIAL PRIMARY KEY,
    boleto_id BIGINT NOT NULL REFERENCES boletos(id),
    tenant_id INTEGER NOT NULL DEFAULT 1,
    cliente_id BIGINT NOT NULL REFERENCES clientes(id),
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

CREATE TABLE IF NOT EXISTS chatbot_conversation_state (
    telefone TEXT PRIMARY KEY,
    cliente_id BIGINT REFERENCES clientes(id),
    current_state TEXT NOT NULL DEFAULT 'idle',
    active_flow TEXT NOT NULL DEFAULT '',
    last_intent TEXT NOT NULL DEFAULT '',
    context JSONB NOT NULL DEFAULT '{}'::jsonb,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parametros_mvp (
    chave TEXT PRIMARY KEY,
    valor TEXT NOT NULL,
    descricao TEXT NOT NULL DEFAULT ''
);
