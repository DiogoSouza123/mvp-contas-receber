const express = require('express');
const db = require('./db');
const liftflexRouter = require('./routes/liftflex');
const internalRouter = require('./routes/internal');

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json());

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

app.get('/health', async (_req, res, next) => {
  try {
    await db.query('SELECT 1');
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.use('/Liftflex_API/rest/v2', liftflexRouter);
app.use('/internal/v1', internalRouter);

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
