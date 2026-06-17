# MVP de Cobranca e Chatbot

Projeto local em Docker para validar um MVP de contas a receber com API fake, PostgreSQL, n8n, WAHA e servicos auxiliares de IA.

## Componentes

- `api`: mock do ERP e endpoints auxiliares do MVP em Node.js.
- `frontend`: painel web gerencial (Next.js) com indicadores, tabela consolidada e chat com LLM.
- `postgres`: banco local com schema, seed e dados persistidos em `postgres_data`.
- `n8n`: orquestracao dos fluxos, persistido em `n8n_data`.
- `waha`: integracao local com WhatsApp, persistida em `waha_sessions`.
- `knowledge-base`: base local de conhecimento/RAG simples.

## Estrutura

- `docker-compose.yml`: sobe todos os servicos.
- `.env`: variaveis reais do ambiente local.
- `.env.example`: modelo de variaveis.
- `configure-waha-webhook.sh`: configura o WAHA para enviar eventos de mensagem ao n8n.
- `api/`: aplicacao Node.js.
- `frontend/`: aplicacao Next.js para dashboard de inadimplencia e cobrancas.
- `db/init/`: schema e seed inicial do PostgreSQL.
- `n8n-workflows/`: workflows exportados para referencia/importacao.
- `n8n_data/`, `postgres_data/`, `waha_sessions/`: dados locais persistidos.

## Requisitos

- Docker Desktop instalado e rodando.
- PowerShell para os comandos principais.
- Git Bash ou WSL para rodar scripts `.sh`.

No Windows, se `sh` nao existir no PowerShell, instale o Git for Windows e use o Git Bash.

## Como Subir Tudo

Abra o PowerShell na pasta do projeto:

```powershell
cd "C:\Users\diogo\Documents\New project 4"
docker compose up -d --build
```

Verifique se os containers subiram:

```powershell
docker ps
```

URLs esperadas:

- API: `http://localhost:3000`
- Frontend: `http://localhost:3002`
- WAHA: `http://localhost:3001`
- n8n: `http://localhost:5678`
- knowledge-base: `http://localhost:8011`
- Postgres: `localhost:5432`

## Frontend Gerencial

O frontend foi criado em `frontend/` com Next.js e tema vermelho/preto.

Principais pontos:

- Consulta o PostgreSQL diretamente (sem criar novos endpoints na API).
- Mostra indicadores basicos de inadimplencia e cobranca.
- Exibe tabela consolidada com dados de `contas_receber`, `clientes`, `boletos` e `cobrancas_whatsapp`.
- Inclui chat gerencial com LLM para perguntas em linguagem natural; a LLM gera SQL de leitura e devolve resposta textual.
- Placeholder de logo em `frontend/public/nippon-logo-placeholder.png`.

Variaveis usadas no frontend via `docker-compose.yml`:

- `DATABASE_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `APP_TENANT_ID`

## WAHA e n8n

Depois de subir os containers, abra o dashboard do WAHA:

```text
http://localhost:3001/dashboard
```

Faca login com as credenciais do `.env`, inicie a sessao `default` e escaneie o QR Code.

Quando a sessao estiver como `WORKING`, rode o script abaixo na raiz do projeto:

```powershell
sh configure-waha-webhook.sh mvp
```

Esse passo e obrigatorio quando a sessao do WAHA estiver sem webhook. Sem ele, o WAHA recebe as mensagens, mas o n8n nao processa.

O script configura:

```text
Sessao: default
Evento: message
Webhook: http://n8n:5678/webhook/waha-contas-receber-v2
```

Para conferir se ficou configurado:

```powershell
Invoke-RestMethod -Uri 'http://localhost:3001/api/sessions/default' -Headers @{ 'X-Api-Key'='changeme' } | ConvertTo-Json -Depth 20
```

O retorno deve conter algo como:

```json
"config": {
  "webhooks": [
    {
      "url": "http://n8n:5678/webhook/waha-contas-receber-v2",
      "events": ["message"]
    }
  ]
}
```

## Workflow do n8n

O webhook esperado pelo WAHA e:

```text
POST /webhook/waha-contas-receber-v2
```

Se as mensagens chegam no WAHA mas nao disparam o fluxo:

1. Confirme que a sessao WAHA esta `WORKING`.
2. Confirme que `config.webhooks` nao esta `null`.
3. Rode `sh configure-waha-webhook.sh mvp`.
4. Confirme se o workflow do n8n com webhook `waha-contas-receber-v2` esta ativo.

Teste rapido do webhook do n8n:

```powershell
$payload = @{ event='message'; session='default'; payload=@{ fromMe=$false; from='5511999999999@c.us'; body='teste interno webhook' } } | ConvertTo-Json -Depth 10
Invoke-WebRequest -UseBasicParsing -Method Post -Uri 'http://localhost:5678/webhook/waha-contas-receber-v2' -ContentType 'application/json' -Body $payload
```

O esperado e:

```text
200 OK
Workflow was started
```

## Variaveis de IA

As variaveis ficam no `.env`.

Para usar OpenAI no n8n e na base de conhecimento, use:

```env
OPENAI_API_KEY=seu_token_aqui
OPENAI_MODEL=gpt-4o-mini
```

E garanta que o `docker-compose.yml` passe essas variaveis para os servicos `n8n` e `knowledge-base`.

Os workflows atuais e o RAG usam OpenAI por HTTP. Depois de alterar o `.env`, recrie os containers afetados para eles receberem as novas variaveis.

## Comandos Uteis

Subir/recriar tudo:

```powershell
docker compose up -d --build
```

Parar tudo:

```powershell
docker compose down
```

Ver logs do WAHA:

```powershell
docker logs mvp-waha --tail 100
```

Ver logs do n8n:

```powershell
docker logs mvp-n8n --tail 100
```

Ver logs da API:

```powershell
docker logs mvp-api --tail 100
```

Ver logs do Frontend:

```powershell
docker logs mvp-frontend --tail 100
```

Ver status da sessao WAHA:

```powershell
Invoke-RestMethod -Uri 'http://localhost:3001/api/sessions/default' -Headers @{ 'X-Api-Key'='changeme' } | ConvertTo-Json -Depth 20
```

## Endpoints da API

Base path:

```text
/Liftflex_API/rest/v2
```

Endpoints principais:

- `GET /GetContasReceberByVencimento`
- `GET /GetContasReceberById`
- `GET /GetContatoCliente`
- `GET /GetBoletoById`
- `GET /GetBoletoByCprf`
- `GET /ValidarCprfTelefone`
- `POST /UpdateWhatsAppBoletoMessage`
- `GET /MvpConfig`
- `GET /GetConversationState`
- `POST /SetConversationState`
- `POST /ClearConversationState`
- `POST /KnowledgeBaseAnswer`
- `POST /ChatbotLog`
- `POST /CheckWhatsAppPolicy`
- `POST /SetWhatsAppOptOut`

## Exemplos Rapidos

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


## Troubleshooting

### WAHA recebe mensagem, mas n8n nao processa

Verifique a sessao:

```powershell
Invoke-RestMethod -Uri 'http://localhost:3001/api/sessions/default' -Headers @{ 'X-Api-Key'='changeme' } | ConvertTo-Json -Depth 20
```

Se aparecer:

```json
"config": null
```

rode:

```powershell
sh configure-waha-webhook.sh mvp
```

### WAHA esta em FAILED

No dashboard do WAHA:

```text
Stop -> Logout -> Start
```

Depois escaneie o QR novamente e rode:

```powershell
sh configure-waha-webhook.sh mvp
```

### Porta ocupada

Confira containers em execucao:

```powershell
docker ps
```

As portas usadas por este projeto sao:

```text
3000, 3001, 3002, 5432, 5678, 8010, 8011
```

### n8n nao abre

Veja os logs:

```powershell
docker logs mvp-n8n --tail 100
```

### API nao conecta no banco

Veja se o Postgres terminou de subir:

```powershell
docker logs mvp-postgres --tail 100
```

Depois recrie a API:

```powershell
docker compose up -d --force-recreate api
```
