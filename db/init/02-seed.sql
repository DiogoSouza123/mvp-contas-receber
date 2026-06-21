INSERT INTO clientes (id, tenant_id, nome, nome_fantasia, pessoa_tipo, cpf_cnpj, ativo)
VALUES
    (1001, 1, 'Condominio Alpha', 'Condominio Alpha', 2, '12345678000199', TRUE),
    (1002, 1, 'Condominio Beta', 'Condominio Beta', 2, '98765432000155', TRUE),
    (1003, 1, 'Condominio Gama', 'Condominio Gama', 2, '11222333000144', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Telefones de teste usam 10 digitos de proposito (formato invalido de
-- celular BR, que exige 11: DDD + 9 + 8 digitos). Isso garante que o WAHA
-- rejeite/nao entregue a mensagem - sem depender de "parecer" fake (incidente
-- real em 2026-06-21: numeros de 13 digitos com mesmo formato de celular
-- valido foram entregues a linhas reais - ver db/reset-teste-cobranca.sql).
-- O node "Enviar Cobranca WhatsApp" (cobranca-diaria.json) tem
-- onError=continueRegularOutput para essa rejeicao nao travar o lote, e o
-- node seguinte grava o envio como sucesso mesmo assim (falso positivo
-- aceitavel no MVP). Unico contato com numero real e o de demonstracao
-- (Diogo Teste).
INSERT INTO contatos (cliente_id, nome, email, telefone, padrao)
VALUES
    (1001, 'Financeiro Alpha', 'financeiro@alpha.com', '5511000001', FALSE),
    (1001, 'Portaria Alpha', 'portaria@alpha.com', '5511000002', FALSE),
    (1001, 'Diogo Teste', 'diogo@teste.local', '5511984523415', TRUE),
    (1002, 'Financeiro Beta', 'financeiro@beta.com', '5511000003', TRUE),
    (1003, 'Financeiro Gama', 'financeiro@gama.com', '5511000004', TRUE)
ON CONFLICT (cliente_id, telefone) DO NOTHING;

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

-- Massa de teste adicional (2026-06-21): mais 17 clientes (totalizando 20),
-- com situacoes variadas entre EmAberto e Pago, para popular dashboard e
-- relatorio de efetividade. Nao altera nenhum registro existente acima.
-- Telefones de 10 digitos (formato invalido de proposito) - ver comentario
-- acima sobre o incidente de 2026-06-21.
INSERT INTO clientes (id, tenant_id, nome, nome_fantasia, pessoa_tipo, cpf_cnpj, ativo)
VALUES
    (1004, 1, 'Condominio Delta', 'Condominio Delta', 2, '30000000040001', TRUE),
    (1005, 1, 'Condominio Epsilon', 'Condominio Epsilon', 2, '30000000050001', TRUE),
    (1006, 1, 'Condominio Zeta', 'Condominio Zeta', 2, '30000000060001', TRUE),
    (1007, 1, 'Condominio Eta', 'Condominio Eta', 2, '30000000070001', TRUE),
    (1008, 1, 'Condominio Theta', 'Condominio Theta', 2, '30000000080001', TRUE),
    (1009, 1, 'Condominio Iota', 'Condominio Iota', 2, '30000000090001', TRUE),
    (1010, 1, 'Condominio Kappa', 'Condominio Kappa', 2, '30000000100001', TRUE),
    (1011, 1, 'Edificio Lambda', 'Edificio Lambda', 2, '30000000110001', TRUE),
    (1012, 1, 'Edificio Mu', 'Edificio Mu', 2, '30000000120001', TRUE),
    (1013, 1, 'Edificio Nu', 'Edificio Nu', 2, '30000000130001', TRUE),
    (1014, 1, 'Edificio Xi', 'Edificio Xi', 2, '30000000140001', TRUE),
    (1015, 1, 'Edificio Omicron', 'Edificio Omicron', 2, '30000000150001', TRUE),
    (1016, 1, 'Joao Pedro Silva', '', 1, '90000160001', TRUE),
    (1017, 1, 'Maria Souza Lima', '', 1, '90000170001', TRUE),
    (1018, 1, 'Carlos Eduardo Santos', '', 1, '90000180001', TRUE),
    (1019, 1, 'Edificio Pi', 'Edificio Pi', 2, '30000000190001', TRUE),
    (1020, 1, 'Edificio Rho', 'Edificio Rho', 2, '30000000200001', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO contatos (cliente_id, nome, email, telefone, padrao)
VALUES
    (1004, 'Financeiro Delta', 'financeiro@delta.local', '5511000005', TRUE),
    (1005, 'Financeiro Epsilon', 'financeiro@epsilon.local', '5511000006', TRUE),
    (1006, 'Financeiro Zeta', 'financeiro@zeta.local', '5511000007', TRUE),
    (1007, 'Financeiro Eta', 'financeiro@eta.local', '5511000008', TRUE),
    (1008, 'Financeiro Theta', 'financeiro@theta.local', '5511000009', TRUE),
    (1009, 'Financeiro Iota', 'financeiro@iota.local', '5511000010', TRUE),
    (1010, 'Financeiro Kappa', 'financeiro@kappa.local', '5511000011', TRUE),
    (1011, 'Financeiro Lambda', 'financeiro@lambda.local', '5511000012', TRUE),
    (1012, 'Financeiro Mu', 'financeiro@mu.local', '5511000013', TRUE),
    (1013, 'Financeiro Nu', 'financeiro@nu.local', '5511000014', TRUE),
    (1014, 'Financeiro Xi', 'financeiro@xi.local', '5511000015', TRUE),
    (1015, 'Financeiro Omicron', 'financeiro@omicron.local', '5511000016', TRUE),
    (1016, 'Joao Pedro Silva', 'joao.silva@teste.local', '5511000017', TRUE),
    (1017, 'Maria Souza Lima', 'maria.lima@teste.local', '5511000018', TRUE),
    (1018, 'Carlos Eduardo Santos', 'carlos.santos@teste.local', '5511000019', TRUE),
    (1019, 'Financeiro Pi', 'financeiro@pi.local', '5511000020', TRUE),
    (1020, 'Financeiro Rho', 'financeiro@rho.local', '5511000021', TRUE)
ON CONFLICT (cliente_id, telefone) DO NOTHING;

INSERT INTO contas_receber (
    id, cliente_id, tenant_id, situacao, situacao_id, tipo_operacao, id_operacao, documento,
    historico, forma_pagamento, total_parcelas, numero_parcela, subtotal, desconto_total,
    juros_total, multa_total, total, data_vencimento, valor_pago, data_pagamento, imposto_retido
)
VALUES
    -- EmAberto dentro da janela da cobranca diaria (5-90 dias atras de 2026-06-21)
    (2004, 1004, 1, 'EmAberto', 1, 'Servico', 'OS-2004', 'CR-2004', 'Mensalidade manutencao elevadores', 'Boleto', '1', 1, 945.00, 0, 0, 0, 945.00, DATE '2026-06-10', 0, NULL, 0),
    (2005, 1005, 1, 'EmAberto', 1, 'Servico', 'OS-2005', 'CR-2005', 'Mensalidade manutencao elevadores', 'Boleto', '1', 1, 1100.00, 0, 0, 0, 1100.00, DATE '2026-05-20', 0, NULL, 0),
    (2006, 1006, 1, 'EmAberto', 1, 'Servico', 'OS-2006', 'CR-2006', 'Mensalidade manutencao elevadores', 'Boleto', '1', 1, 875.50, 0, 0, 0, 875.50, DATE '2026-04-15', 0, NULL, 0),
    (2007, 1007, 1, 'EmAberto', 1, 'Servico', 'OS-2007', 'CR-2007', 'Mensalidade manutencao elevadores', 'Boleto', '1', 1, 990.00, 0, 0, 0, 990.00, DATE '2026-06-05', 0, NULL, 0),
    (2008, 1008, 1, 'EmAberto', 1, 'Servico', 'OS-2008', 'CR-2008', 'Mensalidade manutencao elevadores', 'Boleto', '1', 1, 820.00, 0, 0, 0, 820.00, DATE '2026-05-01', 0, NULL, 0),
    -- EmAberto fora da janela (recente demais ou vencido ha mais de 90 dias) - para testar os limites do cron e do relatorio
    (2009, 1009, 1, 'EmAberto', 1, 'Servico', 'OS-2009', 'CR-2009', 'Mensalidade manutencao elevadores', 'Boleto', '1', 1, 760.00, 0, 0, 0, 760.00, DATE '2026-06-19', 0, NULL, 0),
    (2010, 1010, 1, 'EmAberto', 1, 'Servico', 'OS-2010', 'CR-2010', 'Mensalidade manutencao elevadores', 'Boleto', '1', 1, 1050.00, 0, 0, 0, 1050.00, DATE '2025-12-01', 0, NULL, 0),
    (2017, 1017, 1, 'EmAberto', 1, 'Servico', 'OS-2017', 'CR-2017', 'Mensalidade manutencao elevadores', 'Boleto', '1', 1, 430.00, 0, 0, 0, 430.00, DATE '2026-06-12', 0, NULL, 0),
    (2019, 1019, 1, 'EmAberto', 1, 'Servico', 'OS-2019', 'CR-2019', 'Mensalidade manutencao elevadores', 'Boleto', '1', 1, 690.00, 0, 0, 0, 690.00, DATE '2026-05-28', 0, NULL, 0),
    -- Pago, com datas de pagamento variadas para o historico/tendencia
    (2011, 1011, 1, 'Pago', 2, 'Servico', 'OS-2011', 'CR-2011', 'Mensalidade manutencao elevadores', 'Boleto', '1', 1, 1180.00, 0, 0, 0, 1180.00, DATE '2026-05-15', 1180.00, DATE '2026-05-18', 0),
    (2012, 1012, 1, 'Pago', 2, 'Servico', 'OS-2012', 'CR-2012', 'Mensalidade manutencao elevadores', 'Boleto', '1', 1, 905.00, 0, 0, 0, 905.00, DATE '2026-04-20', 905.00, DATE '2026-04-25', 0),
    (2013, 1013, 1, 'Pago', 2, 'Servico', 'OS-2013', 'CR-2013', 'Mensalidade manutencao elevadores', 'Boleto', '1', 1, 850.00, 0, 0, 0, 850.00, DATE '2026-03-30', 850.00, DATE '2026-04-02', 0),
    (2014, 1014, 1, 'Pago', 2, 'Servico', 'OS-2014', 'CR-2014', 'Mensalidade manutencao elevadores', 'Boleto', '1', 1, 970.00, 0, 0, 0, 970.00, DATE '2026-06-01', 970.00, DATE '2026-06-08', 0),
    (2015, 1015, 1, 'Pago', 2, 'Servico', 'OS-2015', 'CR-2015', 'Mensalidade manutencao elevadores', 'Boleto', '1', 1, 715.00, 0, 0, 0, 715.00, DATE '2026-05-25', 715.00, DATE '2026-05-29', 0),
    (2016, 1016, 1, 'Pago', 2, 'Servico', 'OS-2016', 'CR-2016', 'Mensalidade manutencao elevadores', 'Boleto', '1', 1, 540.00, 0, 0, 0, 540.00, DATE '2026-04-10', 540.00, DATE '2026-04-14', 0),
    (2018, 1018, 1, 'Pago', 2, 'Servico', 'OS-2018', 'CR-2018', 'Mensalidade manutencao elevadores', 'Boleto', '1', 1, 480.00, 0, 0, 0, 480.00, DATE '2026-03-15', 480.00, DATE '2026-03-20', 0),
    (2020, 1020, 1, 'Pago', 2, 'Servico', 'OS-2020', 'CR-2020', 'Mensalidade manutencao elevadores', 'Boleto', '1', 1, 1250.00, 0, 0, 0, 1250.00, DATE '2026-06-15', 1250.00, DATE '2026-06-18', 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO boletos (
    id, conta_receber_id, tenant_id, cprf, vencimento, valor, nosso_numero, linha_digitavel, binario
)
VALUES
    (3004, 2004, 1, '30000000040001', DATE '2026-06-10', 945.00, 'NN-3004', '34191.79001 01043.510047 91020.150011 1 96100000094500', '{"tipo":"representacao","formato":"json","descricao":"boleto simplificado","codigo":"BOL-3004"}'),
    (3005, 2005, 1, '30000000050001', DATE '2026-05-20', 1100.00, 'NN-3005', '34191.79001 01043.510047 91020.150012 8 96200000110000', '{"tipo":"representacao","formato":"json","descricao":"boleto simplificado","codigo":"BOL-3005"}'),
    (3006, 2006, 1, '30000000060001', DATE '2026-04-15', 875.50, 'NN-3006', '34191.79001 01043.510047 91020.150013 5 96300000087550', '{"tipo":"representacao","formato":"json","descricao":"boleto simplificado","codigo":"BOL-3006"}'),
    (3007, 2007, 1, '30000000070001', DATE '2026-06-05', 990.00, 'NN-3007', '34191.79001 01043.510047 91020.150014 2 96400000099000', '{"tipo":"representacao","formato":"json","descricao":"boleto simplificado","codigo":"BOL-3007"}'),
    (3008, 2008, 1, '30000000080001', DATE '2026-05-01', 820.00, 'NN-3008', '34191.79001 01043.510047 91020.150015 9 96500000082000', '{"tipo":"representacao","formato":"json","descricao":"boleto simplificado","codigo":"BOL-3008"}'),
    (3009, 2009, 1, '30000000090001', DATE '2026-06-19', 760.00, 'NN-3009', '34191.79001 01043.510047 91020.150016 6 96600000076000', '{"tipo":"representacao","formato":"json","descricao":"boleto simplificado","codigo":"BOL-3009"}'),
    (3010, 2010, 1, '30000000100001', DATE '2025-12-01', 1050.00, 'NN-3010', '34191.79001 01043.510047 91020.150017 3 96700000105000', '{"tipo":"representacao","formato":"json","descricao":"boleto simplificado","codigo":"BOL-3010"}'),
    (3011, 2011, 1, '30000000110001', DATE '2026-05-15', 1180.00, 'NN-3011', '34191.79001 01043.510047 91020.150018 0 96800000118000', '{"tipo":"representacao","formato":"json","descricao":"boleto simplificado","codigo":"BOL-3011"}'),
    (3012, 2012, 1, '30000000120001', DATE '2026-04-20', 905.00, 'NN-3012', '34191.79001 01043.510047 91020.150019 7 96900000090500', '{"tipo":"representacao","formato":"json","descricao":"boleto simplificado","codigo":"BOL-3012"}'),
    (3013, 2013, 1, '30000000130001', DATE '2026-03-30', 850.00, 'NN-3013', '34191.79001 01043.510047 91020.150020 0 97000000085000', '{"tipo":"representacao","formato":"json","descricao":"boleto simplificado","codigo":"BOL-3013"}'),
    (3014, 2014, 1, '30000000140001', DATE '2026-06-01', 970.00, 'NN-3014', '34191.79001 01043.510047 91020.150021 7 97100000097000', '{"tipo":"representacao","formato":"json","descricao":"boleto simplificado","codigo":"BOL-3014"}'),
    (3015, 2015, 1, '30000000150001', DATE '2026-05-25', 715.00, 'NN-3015', '34191.79001 01043.510047 91020.150022 4 97200000071500', '{"tipo":"representacao","formato":"json","descricao":"boleto simplificado","codigo":"BOL-3015"}'),
    (3016, 2016, 1, '90000160001', DATE '2026-04-10', 540.00, 'NN-3016', '34191.79001 01043.510047 91020.150023 1 97300000054000', '{"tipo":"representacao","formato":"json","descricao":"boleto simplificado","codigo":"BOL-3016"}'),
    (3017, 2017, 1, '90000170001', DATE '2026-06-12', 430.00, 'NN-3017', '34191.79001 01043.510047 91020.150024 8 97400000043000', '{"tipo":"representacao","formato":"json","descricao":"boleto simplificado","codigo":"BOL-3017"}'),
    (3018, 2018, 1, '90000180001', DATE '2026-03-15', 480.00, 'NN-3018', '34191.79001 01043.510047 91020.150025 5 97500000048000', '{"tipo":"representacao","formato":"json","descricao":"boleto simplificado","codigo":"BOL-3018"}'),
    (3019, 2019, 1, '30000000190001', DATE '2026-05-28', 690.00, 'NN-3019', '34191.79001 01043.510047 91020.150026 2 97600000069000', '{"tipo":"representacao","formato":"json","descricao":"boleto simplificado","codigo":"BOL-3019"}'),
    (3020, 2020, 1, '30000000200001', DATE '2026-06-15', 1250.00, 'NN-3020', '34191.79001 01043.510047 91020.150027 9 97700000125000', '{"tipo":"representacao","formato":"json","descricao":"boleto simplificado","codigo":"BOL-3020"}')
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
    ('conversation_state_ttl_hours', '12', 'Tempo padrao de expiracao do estado de conversa do chatbot'),
    ('chat_manager_history_limit', '10', 'Quantidade maxima de mensagens do Chat Gerencial mantidas como contexto (client-side, zerado ao atualizar a pagina)')
ON CONFLICT (chave) DO NOTHING;
