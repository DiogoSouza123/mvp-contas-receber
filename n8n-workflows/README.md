# Workflows n8n do MVP

Arquivos disponiveis:

- `cobranca-diaria.json`
- `chatbot-contas-receber.json`

## Importacao

1. Abra o n8n em `http://localhost:5678`.
2. Importe cada arquivo JSON manualmente.
3. Revise os nodes HTTP e confirme:
   - `http://api:3000` para chamadas do mock
   - `http://waha:3000` para chamadas do WAHA
4. Defina as variaveis/credenciais usadas nos nodes:
   - `PERPLEXITY_API_KEY`
   - `PERPLEXITY_MODEL` opcional
   - `WAHA_API_KEY`

## Importante

O webhook do chatbot usa o path:

`/webhook/waha-contas-receber`

Como o WAHA esta na mesma rede Docker do n8n, configure a sessao `default` do WAHA para apontar para:

`http://n8n:5678/webhook/waha-contas-receber`

Com evento:

- `message`

## Exemplo de configuracao do webhook do WAHA

```bash
curl -X PUT "http://localhost:3001/api/sessions/default" \
  -H "X-Api-Key: changeme" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"default\",\"config\":{\"webhooks\":[{\"url\":\"http://n8n:5678/webhook/waha-contas-receber\",\"events\":[\"message\"]}]}}"
```

## Observacoes

- O workflow de cobranca usa horario fixado em `08:00` no trigger do n8n. Se quiser, altere o node `Cron 08h`.
- A classificacao de intencao usa Perplexity por HTTP e espera `PERPLEXITY_API_KEY` disponivel no n8n.
- O chatbot responde imediatamente ao WAHA com `200 OK` e processa a mensagem em seguida.
- O workflow de cobranca consulta a politica do mock antes de cada envio, para respeitar opt-out, janela horaria, cooldown, limite diario e deduplicacao.
- Se o cliente enviar comandos como `parar` ou `stop`, o chatbot registra opt-out para bloquear novas cobrancas automaticas no WhatsApp.
