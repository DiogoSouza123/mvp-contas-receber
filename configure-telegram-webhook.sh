#!/usr/bin/env sh
set -eu

# Configura o bot do Telegram para enviar mensagens via webhook ao n8n
# (em vez do polling getUpdates). Rode quando o n8n estiver de pe e
# acessivel publicamente via HTTPS:
#   TELEGRAM_WEBHOOK_URL=https://seu-dominio.com/webhook/telegram-contas-receber-v2 \
#     sh configure-telegram-webhook.sh nome-do-projeto

PROJECT_NAME="${1:-${PROJECT_NAME:-mvp}}"
N8N_CONTAINER="${N8N_CONTAINER:-${PROJECT_NAME}-n8n}"
TELEGRAM_WEBHOOK_URL="${TELEGRAM_WEBHOOK_URL:?Defina TELEGRAM_WEBHOOK_URL com a URL publica HTTPS do n8n, ex: https://seu-dominio.com/webhook/telegram-contas-receber-v2}"

docker exec \
  -e TELEGRAM_WEBHOOK_URL="$TELEGRAM_WEBHOOK_URL" \
  "$N8N_CONTAINER" \
  node -e "fetch('https://api.telegram.org/bot'+process.env.TELEGRAM_BOT_TOKEN+'/setWebhook',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:process.env.TELEGRAM_WEBHOOK_URL})}).then(async r=>{const t=await r.text(); console.log(r.status,t); if(!r.ok) process.exit(1)}).catch(e=>{console.error(e); process.exit(1)})"

docker exec \
  "$N8N_CONTAINER" \
  node -e "fetch('https://api.telegram.org/bot'+process.env.TELEGRAM_BOT_TOKEN+'/getWebhookInfo').then(async r=>console.log(await r.text()))"
