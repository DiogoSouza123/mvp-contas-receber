INSERT INTO clientes (id, tenant_id, nome, nome_fantasia, pessoa_tipo, cpf_cnpj, ativo)
VALUES
    (1001, 1, 'Condominio Alpha', 'Condominio Alpha', 2, '12345678000199', TRUE),
    (1002, 1, 'Condominio Beta', 'Condominio Beta', 2, '98765432000155', TRUE),
    (1003, 1, 'Condominio Gama', 'Condominio Gama', 2, '11222333000144', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO contatos (cliente_id, nome, email, telefone, padrao)
VALUES
    (1001, 'Financeiro Alpha', 'financeiro@alpha.com', '5511999990001', TRUE),
    (1001, 'Portaria Alpha', 'portaria@alpha.com', '5511999990002', FALSE),
    (1002, 'Financeiro Beta', 'financeiro@beta.com', '5511999990003', TRUE),
    (1003, 'Financeiro Gama', 'financeiro@gama.com', '5511999990004', TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO contas_receber (
    id, cliente_id, tenant_id, situacao, situacao_id, tipo_operacao, id_operacao, documento,
    historico, forma_pagamento, total_parcelas, numero_parcela, subtotal, desconto_total,
    juros_total, multa_total, total, data_vencimento, valor_pago, data_pagamento, imposto_retido
)
VALUES
    (2001, 1001, 1, 'EmAberto', 1, 'Servico', 'OS-2001', 'CR-2001', 'Mensalidade manutencao elevadores', 'Boleto', '1', 1, 850.00, 0, 12.50, 5.00, 867.50, DATE '2026-03-10', 0, NULL, 0),
    (2002, 1002, 1, 'EmAberto', 1, 'Servico', 'OS-2002', 'CR-2002', 'Mensalidade manutencao elevadores', 'Boleto', '1', 1, 920.00, 0, 0, 0, 920.00, DATE '2026-03-18', 0, NULL, 0),
    (2003, 1003, 1, 'Pago', 2, 'Servico', 'OS-2003', 'CR-2003', 'Mensalidade manutencao elevadores', 'Boleto', '1', 1, 780.00, 0, 0, 0, 780.00, DATE '2026-03-22', 780.00, DATE '2026-03-22', 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO boletos (
    id, conta_receber_id, tenant_id, cprf, vencimento, valor, nosso_numero, linha_digitavel, binario
)
VALUES
    (
        3001, 2001, 1, '12345678000199', DATE '2026-03-10', 867.50, 'NN-3001',
        '34191.79001 01043.510047 91020.150008 7 96220000086750',
        '{"tipo":"representacao","formato":"json","descricao":"boleto simplificado","codigo":"BOL-3001"}'
    ),
    (
        3002, 2002, 1, '98765432000155', DATE '2026-03-18', 920.00, 'NN-3002',
        '34191.79001 01043.510047 91020.150009 1 96300000092000',
        '{"tipo":"representacao","formato":"json","descricao":"boleto simplificado","codigo":"BOL-3002"}'
    ),
    (
        3003, 2003, 1, '11222333000144', DATE '2026-03-22', 780.00, 'NN-3003',
        '34191.79001 01043.510047 91020.150010 4 96340000078000',
        '{"tipo":"representacao","formato":"json","descricao":"boleto simplificado","codigo":"BOL-3003"}'
    )
ON CONFLICT (id) DO NOTHING;

INSERT INTO parametros_mvp (chave, valor, descricao)
VALUES
    ('daily_run_time', '08:00', 'Horario padrao da rotina diaria'),
    ('default_delay_days', '3', 'Dias padrao para prorrogacao do vencimento'),
    ('fallback_message', 'Recebemos sua mensagem e em breve um operador do contas a receber dara continuidade ao atendimento.', 'Mensagem default para encaminhamento ao operador'),
    ('initial_whatsapp_message', 'Prezado cliente, identificamos um boleto vencido em aberto. Por gentileza, nos informe se precisa de apoio para regularizacao.', 'Mensagem inicial curta de cobranca'),
    ('campaign_window_start', '08:00', 'Horario inicial permitido para cobrancas automaticas'),
    ('campaign_window_end', '18:00', 'Horario final permitido para cobrancas automaticas'),
    ('campaign_cooldown_minutes', '30', 'Janela minima entre envios automaticos para o mesmo telefone'),
    ('campaign_daily_limit_per_phone', '1', 'Quantidade maxima de cobrancas automaticas por telefone no mesmo dia'),
    ('campaign_dedupe_window_minutes', '1440', 'Janela para bloquear o reenvio do mesmo texto para o mesmo telefone'),
    ('conversation_state_ttl_hours', '12', 'Tempo padrao de expiracao do estado de conversa do chatbot')
ON CONFLICT (chave) DO NOTHING;
