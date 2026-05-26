# MVP de Cobranca e Chatbot

Projeto local em Docker para validar um MVP de contas a receber com API fake, PostgreSQL, n8n, WAHA e servicos auxiliares de IA/OCR.

## Componentes

- `api`: mock do ERP e endpoints auxiliares do MVP em Node.js.
- `postgres`: banco local com schema, seed e dados persistidos em `postgres_data`.
- `n8n`: orquestracao dos fluxos, persistido em `n8n_data`.
- `waha`: integracao local com WhatsApp, persistida em `waha_sessions`.
- `doc-extractor`: extracao de documento a partir de imagem de boleto.
- `knowledge-base`: base local de conhecimento/RAG simples.

## Estrutura

- `docker-compose.yml`: sobe todos os servicos.
- `.env`: variaveis reais do ambiente local.
- `.env.example`: modelo de variaveis.
- `configure-waha-webhook.sh`: configura o WAHA para enviar eventos de mensagem ao n8n.
- `api/`: aplicacao Node.js.
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
- WAHA: `http://localhost:3001`
- n8n: `http://localhost:5678`
- doc-extractor: `http://localhost:8010`
- knowledge-base: `http://localhost:8011`
- Postgres: `localhost:5432`

## WAHA e n8n

Depois de subir os containers, abra o dashboard do WAHA:

```text
http://localhost:3001/dashboard
```

Faça login com as credenciais do `.env`, inicie a sessao `default` e escaneie o QR Code.

Quando a sessao estiver como `WORKING`, rode o script abaixo na raiz do projeto:

```powershell
sh configure-waha-webhook.sh mvp
```

Esse passo e obrigatorio quando a sessao do WAHA estiver sem webhook. Sem ele, o WAHA recebe as mensagens, mas o n8n nao processa.

O script configura:

```text
Sessao: default
Evento: message
Webhook: http://n8n:5678/webhook/waha-contas-receber
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
      "url": "http://n8n:5678/webhook/waha-contas-receber",
      "events": ["message"]
    }
  ]
}
```

## Workflow do n8n

O webhook esperado pelo WAHA e:

```text
POST /webhook/waha-contas-receber
```

Se as mensagens chegam no WAHA mas nao disparam o fluxo:

1. Confirme que a sessao WAHA esta `WORKING`.
2. Confirme que `config.webhooks` nao esta `null`.
3. Rode `sh configure-waha-webhook.sh mvp`.
4. Confirme se o workflow do n8n com webhook `waha-contas-receber` esta ativo.

Teste rapido do webhook do n8n:

```powershell
$payload = @{ event='message'; session='default'; payload=@{ fromMe=$true; from='5511999999999@c.us'; body='teste interno webhook'; hasMedia=$false } } | ConvertTo-Json -Depth 10
Invoke-WebRequest -UseBasicParsing -Method Post -Uri 'http://localhost:5678/webhook/waha-contas-receber' -ContentType 'application/json' -Body $payload
```

O esperado e:

```text
200 OK
Workflow was started
```

## Variaveis de IA

As variaveis ficam no `.env`.

Se usar OpenAI no n8n, use:

```env
OPENAI_API_KEY=seu_token_aqui
OPENAI_MODEL=gpt-4o-mini
```

E garanta que o `docker-compose.yml` passe essas variaveis para o servico `n8n`.

Os workflows atuais usam OpenAI por HTTP. Depois de alterar o `.env`, recrie o container do n8n para ele receber as novas variaveis.

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
- `POST /UpdateBoletoDueDate`
- `GET /MvpConfig`
- `GET /GetConversationState`
- `POST /SetConversationState`
- `POST /ClearConversationState`
- `POST /ExtractDocumentFromWhatsAppImage`
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

Prorrogar vencimento:

```bash
curl -X POST "http://localhost:3000/Liftflex_API/rest/v2/UpdateBoletoDueDate?BoletoId=3001&TenantId=1" \
  -H "Content-Type: application/json" \
  -d "{\"RequestedDocument\":\"12345678000199\",\"RequestedPhone\":\"5511999990001\",\"CurrentDueDate\":\"2026-03-10\",\"NewDueDate\":\"2026-03-13\",\"Reason\":\"Perda ou esquecimento de boleto\",\"Channel\":\"whatsapp\",\"RequestedBy\":\"cliente\"}"
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
3000, 3001, 5432, 5678, 8010, 8011
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
