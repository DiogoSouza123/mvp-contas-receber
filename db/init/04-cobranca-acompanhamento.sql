CREATE TABLE IF NOT EXISTS app.cobranca_acompanhamento (
    conta_receber_id BIGINT PRIMARY KEY REFERENCES app.contas_receber(id),
    tenant_id INTEGER NOT NULL DEFAULT 1,
    cliente_id BIGINT NOT NULL REFERENCES app.clientes(id),
    primeira_cobranca_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ultima_verificacao_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'em_cobranca'
        CHECK (status IN ('em_cobranca', 'baixado_por_ausencia')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE app.cobranca_acompanhamento IS 'Snapshot de quais contas a receber estao sob cobranca automatica ativa, usado pela reconciliacao de pagamentos para inferir baixa por ausencia.';
COMMENT ON COLUMN app.cobranca_acompanhamento.conta_receber_id IS 'Titulo que entrou em cobranca automatica.';
COMMENT ON COLUMN app.cobranca_acompanhamento.tenant_id IS 'Identificador do tenant proprietario do registro.';
COMMENT ON COLUMN app.cobranca_acompanhamento.cliente_id IS 'Cliente relacionado ao titulo.';
COMMENT ON COLUMN app.cobranca_acompanhamento.primeira_cobranca_em IS 'Data e hora em que o titulo entrou em cobranca automatica por este mecanismo.';
COMMENT ON COLUMN app.cobranca_acompanhamento.ultima_verificacao_em IS 'Data e hora da ultima vez que a reconciliacao de pagamentos verificou este titulo.';
COMMENT ON COLUMN app.cobranca_acompanhamento.status IS 'em_cobranca: ainda monitorado. baixado_por_ausencia: titulo nao apareceu mais na consulta ampla de em aberto, baixa heuristica ja aplicada ou ja resolvida por outro meio.';
