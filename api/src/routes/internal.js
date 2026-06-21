const express = require('express');
const db = require('../db');

const router = express.Router();

function normalizeMessageText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function parseTimeToMinutes(value, fallback) {
  const source = value || fallback;
  const [hour, minute] = String(source)
    .split(':')
    .map((item) => Number(item));
  return hour * 60 + minute;
}

function getSaoPauloTimeInMinutes(date = new Date()) {
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  return parseTimeToMinutes(formatted, '00:00');
}

function isTimeWithinWindow(currentMinutes, startMinutes, endMinutes) {
  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
}

async function getParametro(chave, fallback) {
  const result = await db.query(
    'SELECT valor FROM parametros_mvp WHERE chave = $1',
    [chave]
  );

  if (result.rowCount === 0) {
    return fallback;
  }

  return result.rows[0].valor;
}

async function getCampaignPolicy() {
  const [
    windowStart,
    windowEnd,
    cooldownMinutes,
    dailyLimitPerPhone,
    dedupeWindowMinutes,
  ] = await Promise.all([
    getParametro('campaign_window_start', '08:00'),
    getParametro('campaign_window_end', '18:00'),
    getParametro('campaign_cooldown_minutes', '30'),
    getParametro('campaign_daily_limit_per_phone', '1'),
    getParametro('campaign_dedupe_window_minutes', '1440'),
  ]);

  return {
    windowStart,
    windowEnd,
    cooldownMinutes: Number(cooldownMinutes),
    dailyLimitPerPhone: Number(dailyLimitPerPhone),
    dedupeWindowMinutes: Number(dedupeWindowMinutes),
  };
}

async function checkWhatsAppPolicy({
  phone,
  message,
  policyType = 'campaign',
}) {
  const policy = await getCampaignPolicy();
  const dedupeKey = normalizeMessageText(message);

  const optOutResult = await db.query(
    `
      SELECT COUNT(*)::int AS total
      FROM contatos
      WHERE telefone = $1
        AND whatsapp_opt_out = TRUE
    `,
    [phone]
  );

  if (optOutResult.rows[0].total > 0) {
    return {
      allowed: false,
      reasonCode: 'OPT_OUT',
      reasonMessage:
        'O telefone solicitou bloqueio de cobrancas automaticas por WhatsApp.',
      policy,
      dedupeKey,
    };
  }

  if (policyType === 'campaign') {
    const currentMinutes = getSaoPauloTimeInMinutes();
    const startMinutes = parseTimeToMinutes(policy.windowStart, '08:00');
    const endMinutes = parseTimeToMinutes(policy.windowEnd, '18:00');

    if (!isTimeWithinWindow(currentMinutes, startMinutes, endMinutes)) {
      return {
        allowed: false,
        reasonCode: 'OUTSIDE_WINDOW',
        reasonMessage:
          'O envio automatico esta fora da janela permitida para cobranca.',
        policy,
        dedupeKey,
      };
    }

    const activityResult = await db.query(
      `
        SELECT
          COUNT(*) FILTER (
            WHERE created_at >= NOW() - make_interval(mins => $2::int)
          )::int AS cooldown_hits,
          COUNT(*) FILTER (
            WHERE timezone('America/Sao_Paulo', created_at)::date =
                  timezone('America/Sao_Paulo', NOW())::date
          )::int AS daily_count,
          COUNT(*) FILTER (
            WHERE created_at >= NOW() - make_interval(mins => $3::int)
              AND dedupe_key = $4
          )::int AS dedupe_hits
        FROM cobrancas_whatsapp
        WHERE telefone = $1
          AND direction = 'outbound'
          AND channel = 'whatsapp'
          AND policy_type = 'campaign'
      `,
      [
        phone,
        policy.cooldownMinutes,
        policy.dedupeWindowMinutes,
        dedupeKey,
      ]
    );

    const activity = activityResult.rows[0];

    if (activity.daily_count >= policy.dailyLimitPerPhone) {
      return {
        allowed: false,
        reasonCode: 'DAILY_LIMIT',
        reasonMessage:
          'O telefone ja atingiu o limite diario de cobrancas automaticas.',
        policy,
        dedupeKey,
      };
    }

    if (activity.cooldown_hits > 0) {
      return {
        allowed: false,
        reasonCode: 'COOLDOWN',
        reasonMessage:
          'Existe um envio recente para este telefone dentro da janela minima.',
        policy,
        dedupeKey,
      };
    }

    if (activity.dedupe_hits > 0) {
      return {
        allowed: false,
        reasonCode: 'DUPLICATE_MESSAGE',
        reasonMessage:
          'A mesma mensagem ja foi enviada recentemente para este telefone.',
        policy,
        dedupeKey,
      };
    }
  }

  return {
    allowed: true,
    reasonCode: 'ALLOWED',
    reasonMessage: 'Envio permitido pela politica configurada.',
    policy,
    dedupeKey,
  };
}

async function getConversationState(telefone) {
  if (!telefone) {
    return null;
  }

  const result = await db.query(
    `
      SELECT
        telefone,
        cliente_id,
        current_state,
        active_flow,
        last_intent,
        context,
        expires_at,
        updated_at
      FROM chatbot_conversation_state
      WHERE telefone = $1
        AND (expires_at IS NULL OR expires_at > NOW())
    `,
    [telefone]
  );

  if (result.rowCount > 0) {
    return result.rows[0];
  }

  await db.query(
    `
      DELETE FROM chatbot_conversation_state
      WHERE telefone = $1
        AND expires_at IS NOT NULL
        AND expires_at <= NOW()
    `,
    [telefone]
  );

  return null;
}

router.get('/MvpConfig', async (_req, res, next) => {
  try {
    const [
      dailyRunTime,
      defaultDelayDays,
      fallbackMessage,
      initialMessage,
      campaignWindowStart,
      campaignWindowEnd,
      campaignCooldownMinutes,
      campaignDailyLimitPerPhone,
      campaignDedupeWindowMinutes,
      conversationStateTtlHours,
    ] =
      await Promise.all([
        getParametro('daily_run_time', process.env.DAILY_RUN_TIME || '08:00'),
        getParametro(
          'default_delay_days',
          process.env.DEFAULT_DELAY_DAYS || '3'
        ),
        getParametro(
          'fallback_message',
          process.env.DEFAULT_FALLBACK_MESSAGE ||
            'Recebemos sua mensagem e em breve um operador do contas a receber dara continuidade ao atendimento.'
        ),
        getParametro(
          'initial_whatsapp_message',
          'Prezado cliente, identificamos um boleto vencido em aberto. Por gentileza, nos informe se precisa de apoio para regularizacao.'
        ),
        getParametro('campaign_window_start', '08:00'),
        getParametro('campaign_window_end', '18:00'),
        getParametro('campaign_cooldown_minutes', '30'),
        getParametro('campaign_daily_limit_per_phone', '1'),
        getParametro('campaign_dedupe_window_minutes', '1440'),
        getParametro('conversation_state_ttl_hours', '12'),
      ]);

    return res.json({
      DailyRunTime: dailyRunTime,
      DefaultDelayDays: Number(defaultDelayDays),
      DefaultFallbackMessage: fallbackMessage,
      InitialWhatsAppMessage: initialMessage,
      LlmProvider: 'openai',
      IntentMode: 'parametrizable',
      CampaignWindowStart: campaignWindowStart,
      CampaignWindowEnd: campaignWindowEnd,
      CampaignCooldownMinutes: Number(campaignCooldownMinutes),
      CampaignDailyLimitPerPhone: Number(campaignDailyLimitPerPhone),
      CampaignDedupeWindowMinutes: Number(campaignDedupeWindowMinutes),
      ConversationStateTtlHours: Number(conversationStateTtlHours),
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/GetConversationState', async (req, res, next) => {
  try {
    const telefone = req.query.Telefone;

    if (!telefone) {
      return res.status(400).json({
        Success: false,
        Message: 'Telefone e obrigatorio.',
      });
    }

    const state = await getConversationState(telefone);

    if (!state) {
      return res.json({
        Success: true,
        Found: false,
        Telefone: telefone,
        CurrentState: 'idle',
        ActiveFlow: '',
        LastIntent: '',
        Context: {},
        ExpiresAt: null,
      });
    }

    return res.json({
      Success: true,
      Found: true,
      Telefone: state.telefone,
      ClienteId: state.cliente_id ? Number(state.cliente_id) : null,
      CurrentState: state.current_state,
      ActiveFlow: state.active_flow,
      LastIntent: state.last_intent,
      Context: state.context || {},
      ExpiresAt: state.expires_at,
      UpdatedAt: state.updated_at,
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/SetConversationState', async (req, res, next) => {
  try {
    const {
      Telefone,
      ClienteId = null,
      CurrentState = 'idle',
      ActiveFlow = '',
      LastIntent = '',
      Context = {},
      ExpiresInHours = null,
      PassThrough = {},
    } = req.body || {};

    if (!Telefone) {
      return res.status(400).json({
        Success: false,
        Message: 'Telefone e obrigatorio.',
      });
    }

    const ttlHours =
      ExpiresInHours ||
      Number(await getParametro('conversation_state_ttl_hours', '12'));

    await db.query(
      `
        INSERT INTO chatbot_conversation_state (
          telefone,
          cliente_id,
          current_state,
          active_flow,
          last_intent,
          context,
          expires_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6::jsonb,
          NOW() + make_interval(hours => $7::int),
          NOW()
        )
        ON CONFLICT (telefone) DO UPDATE
        SET cliente_id = EXCLUDED.cliente_id,
            current_state = EXCLUDED.current_state,
            active_flow = EXCLUDED.active_flow,
            last_intent = EXCLUDED.last_intent,
            context = EXCLUDED.context,
            expires_at = EXCLUDED.expires_at,
            updated_at = NOW()
      `,
      [
        Telefone,
        ClienteId,
        CurrentState,
        ActiveFlow,
        LastIntent,
        JSON.stringify(Context),
        Number(ttlHours),
      ]
    );

    return res.json({
      Success: true,
      Telefone,
      CurrentState,
      ActiveFlow,
      LastIntent,
      Context,
      ExpiresInHours: Number(ttlHours),
      ...PassThrough,
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/ClearConversationState', async (req, res, next) => {
  try {
    const { Telefone, PassThrough = {} } = req.body || {};

    if (!Telefone) {
      return res.status(400).json({
        Success: false,
        Message: 'Telefone e obrigatorio.',
      });
    }

    const result = await db.query(
      `
        DELETE FROM chatbot_conversation_state
        WHERE telefone = $1
      `,
      [Telefone]
    );

    return res.json({
      Success: true,
      Cleared: result.rowCount > 0,
      Telefone,
      ...PassThrough,
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/KnowledgeBaseAnswer', async (req, res, next) => {
  try {
    const {
      Question,
      Telefone = '',
      MaxChunks = null,
      PassThrough = {},
    } = req.body || {};

    if (!Question) {
      return res.status(400).json({
        Success: false,
        Message: 'Question e obrigatoria.',
      });
    }

    const knowledgeBaseUrl =
      process.env.KNOWLEDGE_BASE_URL || 'http://knowledge-base:8011';

    const response = await fetch(`${knowledgeBaseUrl}/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Question,
        Telefone,
        MaxChunks,
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(
        `Falha ao consultar knowledge-base: ${response.status} ${details}`
      );
    }

    const answer = await response.json();

    return res.json({
      Success: true,
      Found: Boolean(answer.found),
      Answer: answer.answer || '',
      Confidence: Number(answer.confidence || 0),
      Sources: answer.sources || [],
      TopScore: Number(answer.topScore || 0),
      Question,
      Telefone,
      ...PassThrough,
      knowledgeBaseFound: Boolean(answer.found),
      knowledgeBaseAnswer: answer.answer || '',
      knowledgeBaseSources: answer.sources || [],
      knowledgeBaseConfidence: Number(answer.confidence || 0),
      knowledgeBaseTopScore: Number(answer.topScore || 0),
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/CheckWhatsAppPolicy', async (req, res, next) => {
  try {
    const {
      Telefone,
      Message,
      PolicyType = 'campaign',
      PassThrough = {},
    } = req.body || {};

    if (!Telefone || !Message) {
      return res.status(400).json({
        Allowed: false,
        ReasonCode: 'VALIDATION_ERROR',
        ReasonMessage: 'Telefone e Message sao obrigatorios.',
      });
    }

    const decision = await checkWhatsAppPolicy({
      phone: Telefone,
      message: Message,
      policyType: PolicyType,
    });

    return res.json({
      Allowed: decision.allowed,
      ReasonCode: decision.reasonCode,
      ReasonMessage: decision.reasonMessage,
      DedupeKey: decision.dedupeKey,
      ...PassThrough,
      Policy: {
        WindowStart: decision.policy.windowStart,
        WindowEnd: decision.policy.windowEnd,
        CooldownMinutes: decision.policy.cooldownMinutes,
        DailyLimitPerPhone: decision.policy.dailyLimitPerPhone,
        DedupeWindowMinutes: decision.policy.dedupeWindowMinutes,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/SetWhatsAppOptOut', async (req, res, next) => {
  try {
    const {
      Telefone,
      OptOut = true,
      Reason = '',
      Source = 'chatbot',
      SourceMessage = '',
    } = req.body || {};

    if (!Telefone) {
      return res.status(400).json({
        Success: false,
        Message: 'Telefone e obrigatorio.',
      });
    }

    const result = await db.query(
      `
        UPDATE contatos
        SET whatsapp_opt_out = $2,
            whatsapp_opt_out_at = CASE WHEN $2 THEN NOW() ELSE NULL END,
            whatsapp_opt_out_reason = CASE WHEN $2 THEN $3 ELSE '' END
        WHERE telefone = $1
        RETURNING id, cliente_id
      `,
      [Telefone, OptOut, Reason]
    );

    await db.query(
      `
        INSERT INTO atendimentos_chat (
          cliente_id,
          telefone,
          role,
          message,
          intent,
          channel,
          metadata
        )
        VALUES ($1, $2, 'system', $3, 'opt_out', 'whatsapp', $4::jsonb)
      `,
      [
        result.rowCount > 0 ? result.rows[0].cliente_id : null,
        Telefone,
        OptOut
          ? 'Opt-out de cobrancas automaticas registrado.'
          : 'Opt-out de cobrancas automaticas removido.',
        JSON.stringify({ reason: Reason, source: Source, sourceMessage: SourceMessage }),
      ]
    );

    return res.json({
      Success: result.rowCount > 0,
      Message:
        result.rowCount > 0
          ? 'Preferencia de WhatsApp atualizada com sucesso.'
          : 'Nenhum contato encontrado para o telefone informado.',
      UpdatedContacts: result.rowCount,
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/RegistrarAcompanhamentoCobranca', async (req, res, next) => {
  try {
    const { ContaReceberId, ClienteId, TenantId = 1 } = req.body || {};

    if (!ContaReceberId || !ClienteId) {
      return res.status(400).json({
        Success: false,
        Message: 'ContaReceberId e ClienteId sao obrigatorios.',
      });
    }

    await db.query(
      `
        INSERT INTO cobranca_acompanhamento (conta_receber_id, tenant_id, cliente_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (conta_receber_id) DO NOTHING
      `,
      [ContaReceberId, TenantId, ClienteId]
    );

    return res.json({ Success: true });
  } catch (error) {
    return next(error);
  }
});

router.post('/ReconciliarPagamentos', async (req, res, next) => {
  try {
    const tracked = await db.query(
      `
        SELECT conta_receber_id, cliente_id
        FROM cobranca_acompanhamento
        WHERE status = 'em_cobranca'
      `
    );

    if (tracked.rowCount === 0) {
      return res.json({ Success: true, Verificados: 0, BaixasAplicadas: 0 });
    }

    const trackedIds = tracked.rows.map((row) => Number(row.conta_receber_id));

    // Mesma janela usada pela cobranca diaria (Montar Janela de Datas em
    // cobranca-diaria.json): vencimento entre 90 e 5 dias atras. Um titulo
    // rastreado que sai dessa janela e considerado resolvido — por baixa real
    // (situacao mudou) ou por envelhecer alem de 90 dias sem pagar. Essa
    // segunda hipotese e um falso positivo aceito (decisao registrada no
    // plano de implementacao), ja que hoje nao ha sinal de pagamento real do
    // ERP para diferenciar os dois casos.
    const stillInWindow = await db.query(
      `
        SELECT id
        FROM contas_receber
        WHERE id = ANY($1::bigint[])
          AND situacao = 'EmAberto'
          AND data_vencimento BETWEEN CURRENT_DATE - INTERVAL '90 days' AND CURRENT_DATE - INTERVAL '5 days'
      `,
      [trackedIds]
    );
    const stillInWindowIds = new Set(stillInWindow.rows.map((row) => Number(row.id)));

    let baixasAplicadas = 0;

    for (const row of tracked.rows) {
      const contaReceberId = Number(row.conta_receber_id);

      await db.query(
        `UPDATE cobranca_acompanhamento SET ultima_verificacao_em = NOW() WHERE conta_receber_id = $1`,
        [contaReceberId]
      );

      if (stillInWindowIds.has(contaReceberId)) {
        continue;
      }

      const updateResult = await db.query(
        `
          UPDATE contas_receber
          SET situacao = 'Pago',
              valor_pago = total,
              data_pagamento = CURRENT_DATE
          WHERE id = $1 AND situacao = 'EmAberto'
          RETURNING id
        `,
        [contaReceberId]
      );

      await db.query(
        `UPDATE cobranca_acompanhamento SET status = 'baixado_por_ausencia' WHERE conta_receber_id = $1`,
        [contaReceberId]
      );

      if (updateResult.rowCount > 0) {
        baixasAplicadas += 1;

        await db.query(
          `
            INSERT INTO atendimentos_chat (cliente_id, telefone, role, message, intent, channel, metadata)
            VALUES ($1, '', 'system', $2, 'baixa_inferida', 'sistema', $3::jsonb)
          `,
          [
            row.cliente_id,
            `Baixa de pagamento inferida automaticamente para o titulo ${contaReceberId}: saiu da janela de cobranca sem confirmacao de pagamento real do ERP.`,
            JSON.stringify({ contaReceberId, metodo: 'reconciliacao_por_ausencia' }),
          ]
        );
      }
    }

    return res.json({
      Success: true,
      Verificados: tracked.rowCount,
      BaixasAplicadas: baixasAplicadas,
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/ChatbotLog', async (req, res, next) => {
  try {
    const {
      ClienteId = null,
      Telefone,
      DocumentoInformado = null,
      Role,
      Message,
      Intent = null,
      Channel = 'whatsapp',
      Metadata = {},
    } = req.body || {};

    if (!Telefone || !Role || !Message) {
      return res.status(400).json({
        success: false,
        message: 'Telefone, Role e Message sao obrigatorios.',
      });
    }

    const result = await db.query(
      `
        INSERT INTO atendimentos_chat (
          cliente_id,
          telefone,
          documento_informado,
          role,
          message,
          intent,
          channel,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
        RETURNING id
      `,
      [
        ClienteId,
        Telefone,
        DocumentoInformado,
        Role,
        Message,
        Intent,
        Channel,
        JSON.stringify(Metadata),
      ]
    );

    return res.json({
      success: true,
      id: Number(result.rows[0].id),
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
