const express = require('express');
const db = require('../db');

const router = express.Router();

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
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
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

router.get('/GetContasReceberByVencimento', async (req, res, next) => {
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
          AND cr.situacao = 'EmAberto'
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

router.get('/GetContasReceberById', async (req, res, next) => {
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

router.get('/GetContatoCliente', async (req, res, next) => {
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

router.get('/GetBoletoById', async (req, res, next) => {
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

router.get('/GetBoletoByCprf', async (req, res, next) => {
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

router.get('/ValidarCprfTelefone', async (req, res, next) => {
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

router.post('/UpdateWhatsAppBoletoMessage', async (req, res, next) => {
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

module.exports = router;
