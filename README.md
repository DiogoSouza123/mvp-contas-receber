# MVP de Cobranca e Chatbot

Projeto local em Docker para validar um MVP com:

- API fake em Node.js
- PostgreSQL com schema simples e dados seed
- n8n
- WAHA

## Componentes

- `api`: mock do ERP e endpoints auxiliares do MVP
- `postgres`: base local com tabelas e seed
- `n8n`: orquestracao dos fluxos
- `waha`: integracao local com WhatsApp

## Fluxos cobertos

- Cobranca inicial diaria de inadimplentes
- Consulta de boletos por id ou documento
- Consulta de contatos do cliente
- Registro de envio WhatsApp
- Alteracao parametrizavel de vencimento
- Registro de atendimentos do chatbot
- Protecoes leves contra repeticao de mensagens e opt-out

## Estrutura

- `docker-compose.yml`: sobe todos os servicos
- `api/`: aplicacao Node.js
- `db/init/`: schema e seed do PostgreSQL

## Como subir

1. Ajuste as variaveis em `api/.env.example` se necessario.
2. Execute `docker compose up --build`.
3. A API ficara disponivel em `http://localhost:3000`.
4. O n8n ficara disponivel em `http://localhost:5678`.
5. O WAHA ficara disponivel em `http://localhost:3001`.

## Endpoints principais

Base path do mock:

`/Liftflex_API/rest/v2`

Endpoints implementados:

- `GET /GetContasReceberByVencimento`
- `GET /GetContasReceberById`
- `GET /GetContatoCliente`
- `GET /GetBoletoById`
- `GET /GetBoletoByCprf`
- `GET /ValidarCprfTelefone`
- `POST /UpdateWhatsAppBoletoMessage`
- `POST /UpdateBoletoDueDate`
- `GET /MvpConfig`
- `POST /ChatbotLog`
- `POST /CheckWhatsAppPolicy`
- `POST /SetWhatsAppOptOut`

## Observacoes

- O Swagger original possui parametros com nomes inconsistentes, como `TenantId` e `TenandId`. O mock preserva isso.
- O boleto e salvo no banco como representacao estruturada simples do retorno.
- A classificacao por LLM ficou preparada para ser parametrizada no n8n usando OpenAI por padrao.
- A API aplica evolucoes leves de schema na inicializacao para nao exigir reset do volume do PostgreSQL em ajustes do MVP.

## Exemplos rapidos

Buscar contas a receber por vencimento:

```bash
curl "http://localhost:3000/Liftflex_API/rest/v2/GetContasReceberByVencimento?Key=demo&DataInicial=2026-03-01&DataFinal=2026-03-31"
```

Buscar contatos do cliente:

```bash
curl "http://localhost:3000/Liftflex_API/rest/v2/GetContatoCliente?Key=demo&ClienteId=1001"
```

Buscar boleto por id:

```bash
curl "http://localhost:3000/Liftflex_API/rest/v2/GetBoletoById?Id=3001&TenandId=1"
```

Validar documento e telefone:

```bash
curl "http://localhost:3000/Liftflex_API/rest/v2/ValidarCprfTelefone?TenantId=1&Cprf=12345678000199&Telefone=5511999990001"
```

Registrar envio de WhatsApp:

```bash
curl -X POST "http://localhost:3000/Liftflex_API/rest/v2/UpdateWhatsAppBoletoMessage?BoletoId=3001&TenantId=1" \
  -H "Content-Type: application/json" \
  -d "{\"Status\":true,\"Message\":\"Mensagem enviada com sucesso\"}"
```

Prorrogar vencimento:

```bash
curl -X POST "http://localhost:3000/Liftflex_API/rest/v2/UpdateBoletoDueDate?BoletoId=3001&TenantId=1" \
  -H "Content-Type: application/json" \
  -d "{\"RequestedDocument\":\"12345678000199\",\"RequestedPhone\":\"5511999990001\",\"CurrentDueDate\":\"2026-03-10\",\"NewDueDate\":\"2026-03-13\",\"Reason\":\"Perda ou esquecimento de boleto\",\"Channel\":\"whatsapp\",\"RequestedBy\":\"cliente\"}"
```
