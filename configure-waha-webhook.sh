#!/usr/bin/env sh
set -eu

# Configura a sessao default do WAHA para enviar mensagens recebidas ao n8n.
# Rode quando o WAHA estiver de pe:
#   sh configure-waha-webhook.sh nome-do-projeto

PROJECT_NAME="${1:-${PROJECT_NAME:-mvp}}"
WAHA_CONTAINER="${WAHA_CONTAINER:-${PROJECT_NAME}-waha}"
WAHA_API_KEY="${WAHA_API_KEY:-changeme}"
WAHA_WEBHOOK_URL="${WAHA_WEBHOOK_URL:-http://n8n:5678/webhook/waha-contas-receber-v2}"

docker exec \
  -e WAHA_API_KEY="$WAHA_API_KEY" \
  -e WAHA_WEBHOOK_URL="$WAHA_WEBHOOK_URL" \
  "$WAHA_CONTAINER" \
  node -e "fetch('http://localhost:3000/api/sessions/default',{method:'PUT',headers:{'X-Api-Key':process.env.WAHA_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({name:'default',config:{webhooks:[{url:process.env.WAHA_WEBHOOK_URL,events:['message']}]}})}).then(async r=>{const t=await r.text(); console.log(r.status,t); if(!r.ok) process.exit(1)}).catch(e=>{console.error(e); process.exit(1)})"

docker exec \
  -e WAHA_API_KEY="$WAHA_API_KEY" \
  "$WAHA_CONTAINER" \
  node -e "fetch('http://localhost:3000/api/sessions/default',{headers:{'X-Api-Key':process.env.WAHA_API_KEY}}).then(async r=>console.log(await r.text()))"
