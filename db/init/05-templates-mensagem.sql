CREATE TABLE IF NOT EXISTS app.templates_mensagem (
    id BIGSERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    chave TEXT NOT NULL,
    canal TEXT NOT NULL DEFAULT 'all',
    conteudo TEXT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, chave, canal)
);

COMMENT ON TABLE app.templates_mensagem IS 'Templates de mensagem configuraveis, com placeholders {{campo}} substituidos em tempo de envio.';
COMMENT ON COLUMN app.templates_mensagem.chave IS 'Identificador funcional do template (ex.: cobranca_inicial, fallback_atendimento, boas_vindas_menu).';
COMMENT ON COLUMN app.templates_mensagem.canal IS 'Canal de envio (whatsapp, telegram) ou "all" quando o template e o mesmo para qualquer canal.';
COMMENT ON COLUMN app.templates_mensagem.conteudo IS 'Texto do template com placeholders no formato {{campo}}.';
COMMENT ON COLUMN app.templates_mensagem.ativo IS 'Templates inativos nao sao usados na renderizacao (mantidos como historico).';

INSERT INTO app.templates_mensagem (tenant_id, chave, canal, conteudo) VALUES
    (1, 'cobranca_inicial', 'whatsapp', 'Prezado cliente, identificamos um boleto vencido em aberto. Por gentileza, nos informe se precisa de apoio para regularizacao.
Cliente: {{cliente_nome}}
Documento: {{documento}}
Vencimento: {{vencimento}}
Valor: R$ {{valor}}
Linha digitavel: {{linha_digitavel}}'),
    (1, 'fallback_atendimento', 'all', 'Recebemos sua mensagem e em breve um operador do contas a receber dara continuidade ao atendimento.'),
    (1, 'boas_vindas_menu', 'all', '👔 Olá. Bem-vindo ao canal de atendimento da Nippon Elevadores.

Através deste menu, podemos auxiliá-lo com questões de Contas a Receber. Por gentileza, selecione a opção que melhor atende à sua necessidade no momento:

🔸 1. Segunda via de boleto
🔸 2. Outros assuntos

Caso a sua solicitação demande suporte adicional, um atendente dará continuidade ao seu atendimento.')
ON CONFLICT (tenant_id, chave, canal) DO NOTHING;
