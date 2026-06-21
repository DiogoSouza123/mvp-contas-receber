-- Reset do ciclo de teste de cobranca diaria + reconciliacao de pagamentos.
-- Restaura a base ao mesmo estado pos-seed (db/init/02-seed.sql), sem precisar
-- recriar o volume do Postgres. Tambem dribla o antispam (cobrancas_whatsapp
-- alimenta o cooldown/limite diario/dedupe do CheckWhatsAppPolicy).
--
-- IDs em EmAberto no seed original (11 contas): 2001,2002,2004-2010,2017,2019.

UPDATE contas_receber
SET situacao = 'EmAberto',
    situacao_id = 1,
    valor_pago = 0,
    data_pagamento = NULL
WHERE id IN (2001, 2002, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2017, 2019);

UPDATE boletos
SET whatsapp_status = NULL,
    whatsapp_message = NULL
WHERE conta_receber_id IN (2001, 2002, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2017, 2019);

TRUNCATE TABLE cobranca_acompanhamento;
TRUNCATE TABLE cobrancas_whatsapp;

DELETE FROM atendimentos_chat WHERE intent = 'baixa_inferida';
