# Workflows n8n do MVP

Arquivos disponiveis:

- `cobranca-diaria.json`
- `chatbot-contas-receber-refatorado.json`
- `chatbot-contas-receber-telegram.json`

## Importacao

1. Abra o n8n em `http://localhost:5678`.
2. Importe cada arquivo JSON manualmente.
3. Revise os nodes HTTP e confirme:
   - `http://api:3000` para chamadas do mock
   - `http://waha:3000` para chamadas do WAHA
4. Defina as variaveis/credenciais usadas nos nodes:
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL` opcional
   - `WAHA_API_KEY`
   - `TELEGRAM_BOT_TOKEN` para o clone com Telegram

## Importante

O workflow do chatbot usa o path:

`/webhook/waha-contas-receber-v2`

O clone multicanal com Telegram usa polling pela API do Telegram, entao nao precisa de dominio publico para testes locais.

Como o WAHA esta na mesma rede Docker do n8n, configure a sessao `default` do WAHA para apontar para o workflow refatorado:

`http://n8n:5678/webhook/waha-contas-receber-v2`

Com evento:

- `message`

## Configuracao do Telegram

No clone `chatbot-contas-receber-telegram.json`, o node `Telegram Poll Every Minute` dispara a busca de mensagens e o node `Poll Telegram Updates` usa `TELEGRAM_BOT_TOKEN` para consultar o Telegram.

Passos recomendados:

1. Importe o workflow `chatbot-contas-receber-telegram.json`.
2. Confirme que `TELEGRAM_BOT_TOKEN` esta no `.env`.
3. Recrie o container do n8n para carregar a variavel.
4. Salve e ative o workflow.
5. Envie uma mensagem para o bot no Telegram e aguarde ate 1 minuto.

Com polling, o n8n consulta novas mensagens periodicamente com `getUpdates`; por isso nao precisa de URL publica HTTPS.

## Exemplo de configuracao do webhook do WAHA

```bash
curl -X PUT "http://localhost:3001/api/sessions/default" \
  -H "X-Api-Key: changeme" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"default\",\"config\":{\"webhooks\":[{\"url\":\"http://n8n:5678/webhook/waha-contas-receber-v2\",\"events\":[\"message\"]}]}}"
```

## Observacoes

- O workflow de cobranca usa horario fixado em `08:00` no trigger do n8n. Se quiser, altere o node `Cron 08h`.
- A classificacao de intencao usa OpenAI por HTTP e espera `OPENAI_API_KEY` disponivel no n8n.
- O chatbot responde imediatamente ao WAHA com `200 OK` e processa a mensagem em seguida.
- O workflow de cobranca consulta a politica do mock antes de cada envio, para respeitar opt-out, janela horaria, cooldown, limite diario e deduplicacao.
- Se o cliente enviar comandos como `parar` ou `stop`, o chatbot registra opt-out para bloquear novas cobrancas automaticas no WhatsApp.
