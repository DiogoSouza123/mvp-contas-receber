const express = require('express');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const db = require('./db');

const execFileAsync = promisify(execFile);

const app = express();
const port = Number(process.env.PORT || 3000);
const basePath = '/Liftflex_API/rest/v2';

app.use(express.json());

function toMoney(value) {
  return Number(value || 0);
}

function asDateString(value) {
  if (!value) {
    return null;
  }
  return new Date(value).toISOString().slice(0, 10);
}

function normalizeMessageText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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

async function ensureRuntimeSchema() {
  const statements = [
    `
      ALTER TABLE contatos
      ADD COLUMN IF NOT EXISTS whatsapp_opt_out BOOLEAN NOT NULL DEFAULT FALSE
    `,
    `
      ALTER TABLE contatos
      ADD COLUMN IF NOT EXISTS whatsapp_opt_out_at TIMESTAMPTZ
    `,
    `
      ALTER TABLE contatos
      ADD COLUMN IF NOT EXISTS whatsapp_opt_out_reason TEXT NOT NULL DEFAULT ''
    `,
    `
      ALTER TABLE cobrancas_whatsapp
      ADD COLUMN IF NOT EXISTS sent_text TEXT NOT NULL DEFAULT ''
    `,
    `
      ALTER TABLE cobrancas_whatsapp
      ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general'
    `,
    `
      ALTER TABLE cobrancas_whatsapp
      ADD COLUMN IF NOT EXISTS policy_type TEXT NOT NULL DEFAULT 'campaign'
    `,
    `
      ALTER TABLE cobrancas_whatsapp
      ADD COLUMN IF NOT EXISTS dedupe_key TEXT NOT NULL DEFAULT ''
    `,
    `
      CREATE INDEX IF NOT EXISTS idx_cobrancas_whatsapp_phone_created_at
      ON cobrancas_whatsapp (telefone, created_at DESC)
    `,
    `
      INSERT INTO parametros_mvp (chave, valor, descricao)
      VALUES
        ('campaign_window_start', '08:00', 'Horario inicial permitido para cobrancas automaticas'),
        ('campaign_window_end', '18:00', 'Horario final permitido para cobrancas automaticas'),
        ('campaign_cooldown_minutes', '30', 'Janela minima entre envios automaticos para o mesmo telefone'),
        ('campaign_daily_limit_per_phone', '1', 'Quantidade maxima de cobrancas automaticas por telefone no mesmo dia'),
        ('campaign_dedupe_window_minutes', '1440', 'Janela para bloquear o reenvio do mesmo texto para o mesmo telefone'),
        ('conversation_state_ttl_hours', '12', 'Tempo padrao de expiracao do estado de conversa do chatbot')
      ON CONFLICT (chave) DO NOTHING
    `,
    `
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
      )
    `,
    `
      CREATE INDEX IF NOT EXISTS idx_chatbot_conversation_state_expires_at
      ON chatbot_conversation_state (expires_at)
    `,
  ];

  for (const statement of statements) {
    await db.query(statement);
  }
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

function rewriteServiceUrl(value, targetBaseUrl) {
  if (!value) {
    return '';
  }

  try {
    const sourceUrl = new URL(value);
    const targetUrl = new URL(targetBaseUrl);
    sourceUrl.protocol = targetUrl.protocol;
    sourceUrl.host = targetUrl.host;
    return sourceUrl.toString();
  } catch (_error) {
    return value;
  }
}

function normalizeDocumentDigits(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length === 11 || digits.length === 14 ? digits : '';
}

function findLabeledDocumentCandidate(value) {
  const text = String(value || '');
  const labelPatterns = [
    /(?:cpf\s*\/?\s*cnpj|cnpj\s*\/?\s*cpf|cpfcnpj|cnpjcpf)[^0-9]{0,25}([0-9.\-\/\s]{11,25})/i,
    /(?:cpf|cnpj)[^0-9]{0,25}([0-9.\-\/\s]{11,25})/i,
  ];

  for (const pattern of labelPatterns) {
    const match = text.match(pattern);
    if (!match) {
      continue;
    }

    const normalized = normalizeDocumentDigits(match[1]);
    if (normalized) {
      return normalized;
    }
  }

  return '';
}

function findDocumentCandidate(value) {
  const text = String(value || '');
  const direct = normalizeDocumentDigits(text);
  if (direct) {
    return direct;
  }

  const keywordMatch = text.match(
    /(?:cpf\s*\/?\s*cnpj|cnpj|cpf)[^0-9]{0,20}([0-9.\-\/\s]{11,25})/i
  );
  if (keywordMatch) {
    const normalized = normalizeDocumentDigits(keywordMatch[1]);
    if (normalized) {
      return normalized;
    }
  }

  const cnpjMatch = text.match(/(?<!\d)(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})(?!\d)/);
  if (cnpjMatch) {
    const normalized = normalizeDocumentDigits(cnpjMatch[1]);
    if (normalized) {
      return normalized;
    }
  }

  const cpfMatch = text.match(/(?<!\d)(\d{3}\.?\d{3}\.?\d{3}-?\d{2})(?!\d)/);
  if (cpfMatch) {
    const normalized = normalizeDocumentDigits(cpfMatch[1]);
    if (normalized) {
      return normalized;
    }
  }

  const digitRuns = text.match(/\d+/g) || [];
  for (const run of digitRuns) {
    if (run.length === 14 || run.length === 11) {
      return run;
    }
  }

  return '';
}

function findDocumentCandidateFromOcrText(value) {
  const text = String(value || '');
  const labeled = findLabeledDocumentCandidate(text);
  if (labeled) {
    return labeled;
  }

  return '';
}

function detectFileExtension(mimeType, mediaUrl) {
  const lowerMimeType = String(mimeType || '').toLowerCase();
  if (lowerMimeType.includes('jpeg') || lowerMimeType.includes('jpg')) {
    return '.jpg';
  }
  if (lowerMimeType.includes('png')) {
    return '.png';
  }
  if (lowerMimeType.includes('webp')) {
    return '.webp';
  }
  if (lowerMimeType.includes('gif')) {
    return '.gif';
  }

  try {
    const urlPath = new URL(mediaUrl).pathname;
    const extension = path.extname(urlPath);
    return extension || '.img';
  } catch (_error) {
    return '.img';
  }
}

async function runTesseractOcr({ imageBuffer, mimeType, mediaUrl }) {
  const extension = detectFileExtension(mimeType, mediaUrl);
  const inputPath = path.join(
    os.tmpdir(),
    `ocr-${Date.now()}-${Math.random().toString(16).slice(2)}${extension}`
  );

  await fs.writeFile(inputPath, imageBuffer);

  try {
    const { stdout } = await execFileAsync(
      'tesseract',
      [inputPath, 'stdout', '-l', 'por+eng', '--psm', '6'],
      {
        maxBuffer: 10 * 1024 * 1024,
      }
    );

    return String(stdout || '');
  } finally {
    await fs.unlink(inputPath).catch(() => {});
  }
}

async function getImageDimensions(filePath) {
  const { stdout } = await execFileAsync(
    'identify',
    ['-format', '%w %h', filePath],
    {
      maxBuffer: 1024 * 1024,
    }
  );

  const [width, height] = String(stdout || '')
    .trim()
    .split(/\s+/)
    .map((value) => Number(value));

  return {
    width,
    height,
  };
}

async function preprocessCropForOcr({
  imageBuffer,
  mimeType,
  mediaUrl,
  crop,
  suffix,
}) {
  const extension = detectFileExtension(mimeType, mediaUrl);
  const inputPath = path.join(
    os.tmpdir(),
    `ocr-input-${suffix}-${Date.now()}-${Math.random().toString(16).slice(2)}${extension}`
  );
  const outputPath = path.join(
    os.tmpdir(),
    `ocr-crop-${suffix}-${Date.now()}-${Math.random().toString(16).slice(2)}.png`
  );

  await fs.writeFile(inputPath, imageBuffer);

  try {
    const dimensions = await getImageDimensions(inputPath);
    const cropWidth = Math.max(1, Math.floor(dimensions.width * crop.width));
    const cropHeight = Math.max(1, Math.floor(dimensions.height * crop.height));
    const cropX = Math.max(0, Math.floor(dimensions.width * crop.x));
    const cropY = Math.max(0, Math.floor(dimensions.height * crop.y));

    await execFileAsync(
      'convert',
      [
        inputPath,
        '-crop',
        `${cropWidth}x${cropHeight}+${cropX}+${cropY}`,
        '-colorspace',
        'Gray',
        '-resize',
        '300%',
        '-sharpen',
        '0x1.0',
        '-threshold',
        '65%',
        outputPath,
      ],
      {
        maxBuffer: 10 * 1024 * 1024,
      }
    );

    const { stdout } = await execFileAsync(
      'tesseract',
      [
        outputPath,
        'stdout',
        '-l',
        'por+eng',
        '--psm',
        '6',
        '-c',
        'tessedit_char_whitelist=0123456789./-ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz: ',
      ],
      {
        maxBuffer: 10 * 1024 * 1024,
      }
    );

    return String(stdout || '');
  } finally {
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
  }
}

async function extractDocumentFromOcrWithLlm({
  ocrText,
  ollamaBaseUrl,
  ollamaTextModel,
}) {
  const prompt = [
    'Texto OCR de um boleto abaixo.',
    'Qual o CPF ou CNPJ do pagador ou cliente?',
    'Responda apenas com o numero.',
    'Se nao encontrar, responda NULO.',
    '',
    ocrText,
  ].join('\n');

  const ollamaResponse = await fetch(`${ollamaBaseUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: ollamaTextModel,
      stream: false,
      options: {
        temperature: 0,
      },
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!ollamaResponse.ok) {
    throw new Error(
      `Falha ao consultar Ollama texto: ${ollamaResponse.status} ${ollamaResponse.statusText}`
    );
  }

  const payload = await ollamaResponse.json();
  const rawContent = String(payload.message?.content || '').trim();

  return {
    rawContent,
    document: findDocumentCandidate(rawContent),
  };
}

async function extractDocumentFromImage({
  mediaUrl,
  mimeType,
}) {
  const wahaBaseUrl = process.env.WAHA_INTERNAL_BASE_URL || 'http://waha:3000';
  const ollamaBaseUrl =
    process.env.OLLAMA_BASE_URL || 'http://host.docker.internal:11434';
  const ollamaTextModel = process.env.OLLAMA_TEXT_MODEL || 'llama3:latest';
  const resolvedMediaUrl = rewriteServiceUrl(mediaUrl, wahaBaseUrl);

  const mediaResponse = await fetch(resolvedMediaUrl, {
    headers: process.env.WAHA_API_KEY
      ? {
          'X-Api-Key': process.env.WAHA_API_KEY,
        }
      : {},
  });

  if (!mediaResponse.ok) {
    throw new Error(
      `Falha ao baixar imagem do WAHA: ${mediaResponse.status} ${mediaResponse.statusText}`
    );
  }

  const mediaBuffer = Buffer.from(await mediaResponse.arrayBuffer());
  const focusedRegions = [
    {
      name: 'top_stub_document',
      x: 0.22,
      y: 0.07,
      width: 0.36,
      height: 0.12,
    },
    {
      name: 'bottom_stub_document',
      x: 0.22,
      y: 0.45,
      width: 0.36,
      height: 0.12,
    },
  ];

  let focusedPreview = '';
  let focusedDocument = '';

  for (const region of focusedRegions) {
    const focusedText = await preprocessCropForOcr({
      imageBuffer: mediaBuffer,
      mimeType,
      mediaUrl: resolvedMediaUrl,
      crop: region,
      suffix: region.name,
    });

    if (!focusedPreview && focusedText.trim()) {
      focusedPreview = focusedText;
    }

    focusedDocument = findDocumentCandidateFromOcrText(focusedText);
    if (focusedDocument) {
      break;
    }
  }

  const ocrText = await runTesseractOcr({
    imageBuffer: mediaBuffer,
    mimeType,
    mediaUrl: resolvedMediaUrl,
  });
  const ocrDocument = findDocumentCandidateFromOcrText(ocrText);
  let finalDocument = focusedDocument || ocrDocument;
  let rawDocument = finalDocument || null;
  let reason = focusedDocument
    ? 'focused_ocr_regex'
    : ocrDocument
      ? 'ocr_regex'
      : 'ocr_document_not_found';
  let confidence = finalDocument ? 'high' : 'low';

  if (!finalDocument && ocrText.trim()) {
    const llmAttempt = await extractDocumentFromOcrWithLlm({
      ocrText,
      ollamaBaseUrl,
      ollamaTextModel,
    });

    if (llmAttempt.document) {
      finalDocument = llmAttempt.document;
      rawDocument = llmAttempt.rawContent || null;
      reason = 'ocr_llm_fallback';
      confidence = 'medium';
    } else {
      rawDocument = llmAttempt.rawContent || null;
      reason = llmAttempt.rawContent
        ? 'ocr_llm_not_found'
        : 'ocr_llm_empty_response';
    }
  }

  return {
    found: Boolean(finalDocument),
    document: finalDocument,
    rawDocument,
    confidence,
    reason,
    model: ollamaTextModel,
    usedMediaUrl: resolvedMediaUrl,
    mimeType: mimeType || mediaResponse.headers.get('content-type') || '',
    ocrPreview: ocrText.slice(0, 1000),
    focusedOcrPreview: focusedPreview.slice(0, 600),
  };
}

function mapContaReceber(row) {
  return {
    Pagador: {
      Id: Number(row.cliente_id),
      Ativo: Boolean(row.cliente_ativo),
      Nome: row.cliente_nome,
      NomeFantasia: row.cliente_nome_fantasia || '',
      Tipo: row.pessoa_tipo === 1 ? 'PessoaFisica' : 'PessoaJuridica',
      Cnpj: row.pessoa_tipo === 2 ? row.cpf_cnpj : '',
      Cpf: row.pessoa_tipo === 1 ? row.cpf_cnpj : '',
    },
    Conta: {
      Id: Number(row.id),
      Situacao: row.situacao,
      TipoOperacao: row.tipo_operacao,
      IdOperacao: row.id_operacao,
      Documento: row.documento,
      DataHoraCadastro: new Date(row.data_hora_cadastro).toISOString(),
      DataHoraManutencao: new Date(row.data_hora_manutencao).toISOString(),
      Historico: row.historico,
      FormaPagamento: row.forma_pagamento,
      TotalParcelas: row.total_parcelas,
      NumeroParcela: Number(row.numero_parcela),
      SubTotal: toMoney(row.subtotal),
      DescontoTotal: toMoney(row.desconto_total),
      JurosTotal: toMoney(row.juros_total),
      MultaTotal: toMoney(row.multa_total),
      Total: toMoney(row.total),
      DataVencimento: asDateString(row.data_vencimento),
      ValorPago: toMoney(row.valor_pago),
      DataPagamento: asDateString(row.data_pagamento),
      ImpostoRetido: toMoney(row.imposto_retido),
    },
    Rateio: [
      {
        Id: Number(row.id),
        PlanoContaOrdenador: '1.01',
        PlanoContaNome: 'Receita de manutencao',
        CentroCusto: 'Carteira principal',
        Valor: toMoney(row.total),
        ValorPago: toMoney(row.valor_pago),
        Desconto: toMoney(row.desconto_total),
        Multa: toMoney(row.multa_total),
        Juros: toMoney(row.juros_total),
      },
    ],
  };
}

function mapBoleto(row) {
  return {
    Identificador: Number(row.id),
    Vencimento: asDateString(row.vencimento),
    Valor: toMoney(row.valor),
    NossoNumero: row.nosso_numero,
    LinhaDigitavel: row.linha_digitavel,
    Binario: row.binario,
  };
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

app.get('/health', async (_req, res, next) => {
  try {
    await db.query('SELECT 1');
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get(`${basePath}/GetContasReceberByVencimento`, async (req, res, next) => {
  try {
    const { Key, DataInicial, DataFinal } = req.query;

    if (!Key || !DataInicial || !DataFinal) {
      return res.status(400).json({
        Resultado: false,
        ResultadoMsg: 'Parametros Key, DataInicial e DataFinal sao obrigatorios.',
        Dados: [],
      });
    }

    const result = await db.query(
      `
        SELECT
          cr.*,
          c.nome AS cliente_nome,
          c.nome_fantasia AS cliente_nome_fantasia,
          c.cpf_cnpj,
          c.pessoa_tipo,
          c.ativo AS cliente_ativo
        FROM contas_receber cr
        INNER JOIN clientes c ON c.id = cr.cliente_id
        WHERE cr.data_vencimento BETWEEN $1::date AND $2::date
        ORDER BY cr.data_vencimento ASC
      `,
      [DataInicial, DataFinal]
    );

    return res.json({
      Resultado: true,
      ResultadoMsg: 'Sucesso',
      Dados: result.rows.map(mapContaReceber),
    });
  } catch (error) {
    return next(error);
  }
});

app.get(`${basePath}/GetContasReceberById`, async (req, res, next) => {
  try {
    const { Key, ContasReceberId } = req.query;

    if (!Key || !ContasReceberId) {
      return res.status(400).json({
        Resultado: false,
        ResultadoMsg: 'Parametros Key e ContasReceberId sao obrigatorios.',
        Dados: [],
      });
    }

    const result = await db.query(
      `
        SELECT
          cr.*,
          c.nome AS cliente_nome,
          c.nome_fantasia AS cliente_nome_fantasia,
          c.cpf_cnpj,
          c.pessoa_tipo,
          c.ativo AS cliente_ativo
        FROM contas_receber cr
        INNER JOIN clientes c ON c.id = cr.cliente_id
        WHERE cr.id = $1
      `,
      [ContasReceberId]
    );

    return res.json({
      Resultado: true,
      ResultadoMsg: result.rowCount ? 'Sucesso' : 'Nenhum registro encontrado.',
      Dados: result.rows.map(mapContaReceber),
    });
  } catch (error) {
    return next(error);
  }
});

app.get(`${basePath}/GetContatoCliente`, async (req, res, next) => {
  try {
    const { Key, ClienteId } = req.query;

    if (!Key || !ClienteId) {
      return res.status(400).json({
        Mensagem: 'Parametros Key e ClienteId sao obrigatorios.',
        Total: 0,
        IsSucesso: false,
        Contatos: [],
      });
    }

    const result = await db.query(
      `
        SELECT
          ct.id,
          ct.nome,
          ct.telefone,
          ct.padrao,
          ct.email
        FROM contatos ct
        WHERE ct.cliente_id = $1
        ORDER BY ct.padrao DESC, ct.id ASC
      `,
      [ClienteId]
    );

    return res.json({
      Mensagem: 'Sucesso',
      Total: result.rowCount,
      IsSucesso: true,
      Contatos: result.rows.map((row) => ({
        Id: Number(row.id),
        Nome: row.nome,
        DataNascimento: '',
        Rascunho: '',
        ContatosTelefone: [
          {
            Id: Number(row.id),
            Telefone: row.telefone,
            Padrao: row.padrao ? 'S' : 'N',
            EventoTelefone: {
              Id: 1,
              Label: 'WhatsApp',
              LabelTable: 'contatos',
            },
          },
        ],
        ContatosEmails: row.email
          ? [
              {
                Email: row.email,
                EventoEmail: 'Financeiro',
                EventoEmailTable: 'contatos',
              },
            ]
          : [],
      })),
    });
  } catch (error) {
    return next(error);
  }
});

app.get(`${basePath}/GetBoletoById`, async (req, res, next) => {
  try {
    const { Id, TenandId } = req.query;

    if (!Id || !TenandId) {
      return res.status(400).json({
        Resultado: false,
        Mensagem: 'Parametros Id e TenandId sao obrigatorios.',
        Boleto: null,
      });
    }

    const result = await db.query(
      'SELECT * FROM boletos WHERE id = $1 AND tenant_id = $2',
      [Id, TenandId]
    );

    return res.json({
      Resultado: result.rowCount > 0,
      Mensagem: result.rowCount > 0 ? 'Sucesso' : 'Boleto nao encontrado.',
      Boleto: result.rowCount > 0 ? mapBoleto(result.rows[0]) : null,
    });
  } catch (error) {
    return next(error);
  }
});

app.get(`${basePath}/GetBoletoByCprf`, async (req, res, next) => {
  try {
    const { Cprf, TenantId } = req.query;

    if (!Cprf || !TenantId) {
      return res.status(400).json({
        Resultado: false,
        Mensagem: 'Parametros Cprf e TenantId sao obrigatorios.',
        Boletos: [],
      });
    }

    const result = await db.query(
      'SELECT * FROM boletos WHERE cprf = $1 AND tenant_id = $2 ORDER BY vencimento ASC',
      [Cprf, TenantId]
    );

    return res.json({
      Resultado: true,
      Mensagem: result.rowCount > 0 ? 'Sucesso' : 'Nenhum boleto encontrado.',
      Boletos: result.rows.map(mapBoleto),
    });
  } catch (error) {
    return next(error);
  }
});

app.get(`${basePath}/ValidarCprfTelefone`, async (req, res, next) => {
  try {
    const { TenantId, Cprf, Telefone } = req.query;

    if (!TenantId || !Cprf || !Telefone) {
      return res.status(400).json({
        CprfValido: false,
        TelefoneValido: false,
        Mensagem: 'Parametros TenantId, Cprf e Telefone sao obrigatorios.',
        CodigoErro: 'VALIDATION_ERROR',
      });
    }

    const result = await db.query(
      `
        SELECT c.id
        FROM clientes c
        INNER JOIN contatos ct ON ct.cliente_id = c.id
        WHERE c.tenant_id = $1
          AND c.cpf_cnpj = $2
          AND ct.telefone = $3
        LIMIT 1
      `,
      [TenantId, Cprf, Telefone]
    );

    const isValid = result.rowCount > 0;
    return res.json({
      CprfValido: isValid,
      TelefoneValido: isValid,
      Mensagem: isValid ? 'Documento e telefone validados.' : 'Documento e telefone nao conferem.',
      CodigoErro: isValid ? '' : 'NOT_FOUND',
    });
  } catch (error) {
    return next(error);
  }
});

app.post(`${basePath}/UpdateWhatsAppBoletoMessage`, async (req, res, next) => {
  try {
    const { BoletoId, TenantId } = req.query;
    const {
      Status,
      Message,
      SentText = '',
      Category = 'collection_initial',
      PolicyType = 'campaign',
      Metadata = {},
    } = req.body || {};

    if (!BoletoId || !TenantId || typeof Status !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Parametros BoletoId, TenantId e body.Status sao obrigatorios.',
      });
    }

    const boletoResult = await db.query(
      `
        SELECT
          b.id,
          b.tenant_id,
          cr.cliente_id,
          COALESCE(
            (SELECT telefone FROM contatos WHERE cliente_id = cr.cliente_id ORDER BY padrao DESC, id ASC LIMIT 1),
            ''
          ) AS telefone
        FROM boletos b
        INNER JOIN contas_receber cr ON cr.id = b.conta_receber_id
        WHERE b.id = $1 AND b.tenant_id = $2
      `,
      [BoletoId, TenantId]
    );

    if (boletoResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Boleto nao encontrado.',
      });
    }

    const boleto = boletoResult.rows[0];

    await db.query(
      `
        UPDATE boletos
        SET whatsapp_status = $1,
            whatsapp_message = $2,
            updated_at = NOW()
        WHERE id = $3 AND tenant_id = $4
      `,
      [Status, Message || '', BoletoId, TenantId]
    );

    await db.query(
      `
        INSERT INTO cobrancas_whatsapp (
          boleto_id,
          tenant_id,
          cliente_id,
          telefone,
          status,
          message,
          sent_text,
          category,
          policy_type,
          dedupe_key,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
      `,
      [
        BoletoId,
        TenantId,
        boleto.cliente_id,
        boleto.telefone,
        Status,
        Message || '',
        SentText || '',
        Category,
        PolicyType,
        normalizeMessageText(SentText || ''),
        JSON.stringify({
          source: 'UpdateWhatsAppBoletoMessage',
          ...Metadata,
        }),
      ]
    );

    return res.json({
      success: true,
      message: 'Status do WhatsApp registrado com sucesso.',
    });
  } catch (error) {
    return next(error);
  }
});

app.post(`${basePath}/UpdateBoletoDueDate`, async (req, res, next) => {
  let client;
  try {
    const { BoletoId, TenantId } = req.query;
    const {
      RequestedDocument,
      RequestedPhone,
      CurrentDueDate,
      NewDueDate,
      Reason,
      Channel = 'whatsapp',
      RequestedBy = 'cliente',
    } = req.body || {};

    if (
      !BoletoId ||
      !TenantId ||
      !RequestedDocument ||
      !RequestedPhone ||
      !CurrentDueDate ||
      !NewDueDate ||
      !Reason
    ) {
      return res.status(400).json({
        Success: false,
        Message: 'Todos os campos obrigatorios do body e query devem ser informados.',
      });
    }

    client = await db.pool.connect();

    const lookup = await client.query(
      `
        SELECT
          b.id AS boleto_id,
          b.vencimento,
          cr.id AS conta_receber_id,
          cr.cliente_id,
          c.cpf_cnpj
        FROM boletos b
        INNER JOIN contas_receber cr ON cr.id = b.conta_receber_id
        INNER JOIN clientes c ON c.id = cr.cliente_id
        INNER JOIN contatos ct ON ct.cliente_id = c.id
        WHERE b.id = $1
          AND b.tenant_id = $2
          AND c.cpf_cnpj = $3
          AND ct.telefone = $4
        LIMIT 1
      `,
      [BoletoId, TenantId, RequestedDocument, RequestedPhone]
    );

    if (lookup.rowCount === 0) {
      return res.status(404).json({
        Success: false,
        Message: 'Boleto, documento ou telefone nao encontrados.',
      });
    }

    const boleto = lookup.rows[0];
    const persistedCurrent = asDateString(boleto.vencimento);

    if (persistedCurrent !== CurrentDueDate) {
      return res.status(409).json({
        Success: false,
        Message: 'A data atual informada nao confere com o registro persistido.',
      });
    }

    await client.query('BEGIN');

    const updateBoleto = client.query(
      `
        UPDATE boletos
        SET vencimento = $1::date,
            updated_at = NOW()
        WHERE id = $2 AND tenant_id = $3
      `,
      [NewDueDate, BoletoId, TenantId]
    );

    const updateConta = client.query(
      `
        UPDATE contas_receber
        SET data_vencimento = $1::date,
            data_hora_manutencao = NOW()
        WHERE id = $2
      `,
      [NewDueDate, boleto.conta_receber_id]
    );

    await Promise.all([updateBoleto, updateConta]);

    const insertChange = await client.query(
      `
        INSERT INTO alteracoes_vencimento (
          boleto_id,
          tenant_id,
          cliente_id,
          requested_document,
          requested_phone,
          previous_due_date,
          new_due_date,
          reason,
          channel,
          requested_by
        )
        VALUES ($1, $2, $3, $4, $5, $6::date, $7::date, $8, $9, $10)
        RETURNING id
      `,
      [
        BoletoId,
        TenantId,
        boleto.cliente_id,
        RequestedDocument,
        RequestedPhone,
        CurrentDueDate,
        NewDueDate,
        Reason,
        Channel,
        RequestedBy,
      ]
    );

    await client.query(
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
        VALUES ($1, $2, $3, 'assistant', $4, $5, $6, $7::jsonb)
      `,
      [
        boleto.cliente_id,
        RequestedPhone,
        RequestedDocument,
        `Prorrogacao do boleto ${BoletoId} registrada com nova data ${NewDueDate}.`,
        'segunda_via_boleto',
        Channel,
        JSON.stringify({ reason: Reason, requestedBy: RequestedBy }),
      ]
    );

    await client.query('COMMIT');

    return res.json({
      Success: true,
      Message: 'Vencimento alterado com sucesso.',
      ChangeId: Number(insertChange.rows[0].id),
      BoletoId: Number(BoletoId),
      PreviousDueDate: CurrentDueDate,
      NewDueDate,
    });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    return next(error);
  } finally {
    if (client) {
      client.release();
    }
  }
});

app.get(`${basePath}/MvpConfig`, async (_req, res, next) => {
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

app.get(`${basePath}/GetConversationState`, async (req, res, next) => {
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

app.post(`${basePath}/SetConversationState`, async (req, res, next) => {
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

app.post(`${basePath}/ClearConversationState`, async (req, res, next) => {
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

app.post(
  `${basePath}/ExtractDocumentFromWhatsAppImage`,
  async (req, res, next) => {
    try {
      const {
        MediaUrl,
        MimeType = '',
        Caption = '',
        PassThrough = {},
      } = req.body || {};

      if (!MediaUrl) {
        return res.status(400).json({
          Success: false,
          Message: 'MediaUrl e obrigatoria.',
        });
      }

      const docExtractorBaseUrl =
        process.env.DOC_EXTRACTOR_BASE_URL || 'http://doc-extractor:8010';
      const extractorResponse = await fetch(
        `${docExtractorBaseUrl}/extract-document`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            MediaUrl,
            MimeType,
            Caption,
          }),
        }
      );

      if (!extractorResponse.ok) {
        const details = await extractorResponse.text();
        throw new Error(
          `Falha ao consultar doc-extractor: ${extractorResponse.status} ${details}`
        );
      }

      const extraction = await extractorResponse.json();

      return res.json({
        Success: true,
        Found: extraction.Found,
        Document: extraction.Document,
        Confidence: extraction.Confidence,
        Reason: extraction.Reason,
        RawDocument: extraction.RawDocument,
        Model: extraction.Model,
        UsedMediaUrl: extraction.UsedMediaUrl,
        MimeType: extraction.MimeType,
        OcrPreview: extraction.OcrPreview,
        FocusedOcrPreview: extraction.FocusedOcrPreview,
        ...PassThrough,
        document: extraction.Document,
        documentSource: extraction.Found ? 'image_paddle_ocr' : 'image_paddle_ocr_not_found',
        imageExtractionReason: extraction.Reason,
        imageExtractionConfidence: extraction.Confidence,
        imageExtractionFound: extraction.Found,
      });
    } catch (error) {
      return next(error);
    }
  }
);

app.post(`${basePath}/CheckWhatsAppPolicy`, async (req, res, next) => {
  try {
    const {
      Telefone,
      Message,
      PolicyType = 'campaign',
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

app.post(`${basePath}/SetWhatsAppOptOut`, async (req, res, next) => {
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

app.post(`${basePath}/ChatbotLog`, async (req, res, next) => {
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

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({
    success: false,
    message: 'Erro interno no mock do ERP.',
    details: error.message,
  });
});

async function startServer() {
  await ensureRuntimeSchema();
  app.listen(port, () => {
    console.log(`Mock ERP listening on port ${port}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start mock ERP', error);
  process.exit(1);
});
