# 💼 MVP Contas a Receber — Cobrança Inteligente com IA

> Automação de cobrança via WhatsApp/Telegram, reconciliação de pagamentos por ausência e um portal gerencial com chat em linguagem natural — tudo rodando local em Docker, sem depender de um ERP real.

![Status](https://img.shields.io/badge/status-MVP-blueviolet)
![Stack](https://img.shields.io/badge/stack-Next.js%20%7C%20Node.js%20%7C%20n8n%20%7C%20PostgreSQL-informational)
![IA](https://img.shields.io/badge/IA-OpenAI%20%2B%20MCP-success)
![Licença](https://img.shields.io/badge/uso-interno%2Fdemo-lightgrey)

---

## 📌 Em uma frase

Um cliente atrasa o boleto → o sistema identifica, cobra automaticamente por WhatsApp, conversa com o cliente quando ele responde, e reconcilia o pagamento sozinho — enquanto o gestor acompanha tudo em um painel web e pode simplesmente **perguntar** o que quiser sobre a carteira.

---

## ✨ Destaques

| | |
|---|---|
| 🤖 **Cobrança 100% automática** | n8n dispara diariamente, busca inadimplentes, aplica política anti-spam e envia WhatsApp |
| 💬 **Chatbot bidirecional** | WhatsApp (WAHA) + Telegram, com estado de conversa e fallback por base de conhecimento (RAG) |
| 🔁 **Reconciliação de pagamentos** | Infere baixa por ausência quando o título some da janela de cobrança — sem integração com ERP |
| 📊 **Portal gerencial (Ant Design)** | Dashboard, Clientes, Cobranças, Configurações e Relatório de Efetividade |
| 🧠 **Chat Gerencial com LLM** | Pergunte em português, a IA gera SQL, executa via um servidor **MCP somente leitura** e responde estruturado |
| 🛡️ **Guardrails de segurança** | Role read-only dedicada para o agente de IA, escopo por tenant, limite de linhas, anti-spam com cooldown/dedupe/opt-out |
| ⚙️ **Tudo configurável sem deploy** | Parâmetros operacionais e templates de mensagem editáveis direto na tela de Configurações |

---

## 🗺️ Arquitetura (visão rápida)

Quatro fluxos independentes, todos convergindo no mesmo PostgreSQL.

**1) Cobrança automática — disparada por cron, sem interação do usuário**

```
n8n: Cobrança Diária (08h)        n8n: Reconciliação de Pagamentos (08h30)
         │                                       │
         ├──► WAHA ──► WhatsApp                  │   (só lê/atualiza o banco,
         │     (envia a cobrança)                │    não envia mensagem)
         └───────────────────┬─────────────────────────────────┘
                              ▼
                    API Node.js (mvp-api)
                    ├─ mock do ERP (Liftflex)
                    └─ regras internas do MVP
                              │
                              ▼
                    PostgreSQL 16 (schema app)
```

**2) Chatbot — disparado por mensagem do cliente**

```
WhatsApp ──► WAHA ──┐
                     ├──► n8n: Chatbot ──► Knowledge Base
Telegram ────────────┘    (WhatsApp + Telegram)   (RAG, respostas de FAQ)
        ▲                       │
      ngrok                     ▼
(webhook público)      API Node.js (mvp-api)
                                 │
                                 ▼
                        PostgreSQL 16 (schema app)
```

**3) Portal web — telas operacionais**

```
Navegador ──► Portal Web (Next.js) ──► PostgreSQL 16
              Dashboard · Clientes · Cobranças
              Configurações · Relatórios
```

**4) Chat Gerencial — pergunta em linguagem natural**

```
Navegador ──► Portal Web ──► OpenAI (GPT)
                  │             │ gera SQL de leitura
                  ▼             ▼
            Servidor MCP ──► PostgreSQL 16
         (role somente leitura,        (mesmo banco dos fluxos 1, 2 e 3,
          escopada por tenant)          mas acessado só por SELECT)
```

> 🔒 O Chat Gerencial nunca toca o banco direto com a role normal da aplicação: ele passa por um **servidor MCP** com role Postgres exclusiva, somente leitura, escopada por tenant. É o único dos três fluxos com essa restrição extra.

---

## 🧩 Componentes

| Serviço | Papel |
|---|---|
| `api` | Mock do ERP (`/Liftflex_API/rest/v2`) + regras internas do MVP (`/internal/v1`): política anti-spam, templates, acompanhamento de cobrança, reconciliação |
| `frontend` | Portal web em Next.js + Ant Design — Dashboard, Clientes, Cobranças, Configurações, Relatórios |
| `mcp-postgres` | Servidor MCP somente leitura usado exclusivamente pelo Chat Gerencial (LLM) |
| `postgres` | PostgreSQL 16 — schema `app` (dados de negócio) + schema `n8n` (motor de workflows) |
| `n8n` | Orquestra 3 workflows: chatbot, cobrança diária e reconciliação de pagamentos |
| `waha` | API HTTP self-hosted para WhatsApp (sessão `default`) |
| `knowledge-base` | Serviço Python de RAG/embeddings — respostas de FAQ para o chatbot |
| `ngrok` | Túnel HTTPS público apenas para o n8n receber webhooks do WhatsApp/Telegram |

---

## 🖥️ Portal Web

| Tela | O que mostra |
|---|---|
| **Dashboard** | KPIs de inadimplência, envios de WhatsApp, tabela consolidada de títulos + Chat Gerencial flutuante |
| **Clientes** | Cadastro e contatos |
| **Cobranças** | Histórico de envios WhatsApp e atendimentos do chatbot, com filtro de período/status |
| **Configurações** | Parâmetros operacionais (janela de envio, limites anti-spam, limite de histórico do chat) e templates de mensagem — tudo editável sem redeploy |
| **Relatórios** | Efetividade de cobrança: funil de envio, taxa de conversão, valor recuperado, tendência diária (`@ant-design/charts`) |

### 💬 Chat Gerencial

- Pergunta em português → a LLM (OpenAI) planeja uma consulta SQL somente leitura.
- A consulta roda via **MCP** (`describe_schema` + `run_query`), nunca direto no banco.
- A resposta volta estruturada (resumo, métricas, tabela, alertas, próxima ação) via Structured Outputs (Zod).
- Mantém contexto da conversa **só no navegador** (zera ao atualizar a página); limite de mensagens configurável em Configurações.

---

## 🔐 Segurança

- Role Postgres dedicada e somente leitura (`mcp_agent_ro`) para o agente de IA — escopo por `tenant_id`, lista de tabelas permitidas, limite de linhas e `statement_timeout`.
- Política anti-spam de WhatsApp: janela de horário, cooldown, limite diário por telefone, dedupe de mensagem repetida e opt-out.
- Tentativas bloqueadas pela política também são registradas (não somem dos indicadores).
- Dados de teste usam telefones com formato inválido de propósito, para garantir que nenhuma mensagem real seja enviada durante testes da automação.

---

## 🚀 Subindo o projeto

**Requisitos:** Docker Desktop, PowerShell, Git Bash/WSL (para os scripts `.sh`).

```powershell
cd "<pasta-do-projeto>"
cp .env.example .env   # preencha com suas chaves/senhas reais
docker compose up -d --build
docker ps
```

| Serviço | URL |
|---|---|
| Portal Web | http://localhost:3002 |
| API | http://localhost:3000 |
| WAHA | http://localhost:3001 |
| n8n | http://localhost:5678 |
| Knowledge Base | http://localhost:8011 |
| Postgres | localhost:5432 |

### Conectar o WhatsApp

1. Abra `http://localhost:3001/dashboard`, inicie a sessão `default` e escaneie o QR Code.
2. Quando a sessão estiver `WORKING`, rode:
   ```powershell
   sh configure-waha-webhook.sh mvp
   ```
3. Confirme:
   ```powershell
   Invoke-RestMethod -Uri 'http://localhost:3001/api/sessions/default' -Headers @{ 'X-Api-Key'='changeme' } | ConvertTo-Json -Depth 20
   ```

### Conectar o Telegram

```powershell
$env:TELEGRAM_WEBHOOK_URL = "https://<seu-dominio-ngrok>/webhook/telegram-contas-receber-v2"
sh configure-telegram-webhook.sh mvp
```

---

## 🧪 Resetando o ambiente de teste

Para repetir um ciclo de cobrança diária + reconciliação sem reconstruir o banco:

```powershell
docker cp db/reset-teste-cobranca.sql mvp-postgres:/tmp/reset-teste-cobranca.sql
docker exec mvp-postgres psql -U postgres -d mvp_recebiveis -f /tmp/reset-teste-cobranca.sql
```

Isso restaura os títulos de teste para `EmAberto`, limpa o histórico de envios/acompanhamento e dribla o anti-spam — sem afetar a conta de demonstração real.

---

## 📡 Endpoints da API

### Mock do contrato Liftflex — `/Liftflex_API/rest/v2`
Replica o contrato em [liftflexSwagger.json](liftflexSwagger.json) · [api/src/routes/liftflex.js](api/src/routes/liftflex.js)

`GetContasReceberByVencimento` · `GetContasReceberById` · `GetContatoCliente` · `GetBoletoById` · `GetBoletoByCprf` · `ValidarCprfTelefone` · `UpdateWhatsAppBoletoMessage`

### Regras internas do MVP — `/internal/v1`
[api/src/routes/internal.js](api/src/routes/internal.js)

`MvpConfig` · `GetConversationState` · `SetConversationState` · `ClearConversationState` · `KnowledgeBaseAnswer` · `CheckWhatsAppPolicy` · `SetWhatsAppOptOut` · `Templates` · `RenderizarTemplate` · `CriarTemplate` · `AtualizarTemplate` · `RegistrarAcompanhamentoCobranca` · `ReconciliarPagamentos` · `ChatbotLog`

---

## 🛟 Troubleshooting

<details>
<summary><strong>WAHA recebe mensagem, mas o n8n não processa</strong></summary>

```powershell
Invoke-RestMethod -Uri 'http://localhost:3001/api/sessions/default' -Headers @{ 'X-Api-Key'='changeme' } | ConvertTo-Json -Depth 20
```

Se `config` vier `null`, rode `sh configure-waha-webhook.sh mvp`.
</details>

<details>
<summary><strong>WAHA caiu em FAILED</strong></summary>

No dashboard do WAHA: `Stop → Logout → Start`, escaneie o QR de novo e rode `sh configure-waha-webhook.sh mvp`.
</details>

<details>
<summary><strong>Indicadores não batem entre as telas</strong></summary>

Confirme se o filtro de data é o mesmo nas três telas (Dashboard, Cobranças, Relatórios) e se o ambiente foi resetado com `db/reset-teste-cobranca.sql` entre ciclos de teste.
</details>

<details>
<summary><strong>Porta ocupada</strong></summary>

```powershell
docker ps
```
Portas usadas: `3000, 3001, 3002, 5432, 5678, 8011`.
</details>

<details>
<summary><strong>API não conecta no banco</strong></summary>

```powershell
docker logs mvp-postgres --tail 100
docker compose up -d --force-recreate api
```
</details>

---

<p align="center">
  <sub>MVP interno — Nippon Elevadores · não usar credenciais de exemplo (<code>changeme</code>) em produção.</sub>
</p>
