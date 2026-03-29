# Scripts auxiliares

## `recover-waha-service.ps1`

Sobe novamente o servico do WAHA via Docker Compose, testa a API e mostra os logs finais.

Uso:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\recover-waha-service.ps1
```

## `reset-waha-qr.ps1`

Reseta a sessao `default`, reaplica o webhook do chatbot e inicia uma nova geracao de QR code.

Uso:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\reset-waha-qr.ps1
```

Se precisar mudar algum valor:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\reset-waha-qr.ps1 `
  -ApiKey "changeme" `
  -SessionName "default" `
  -WebhookUrl "http://n8n:5678/webhook/waha-contas-receber"
```
