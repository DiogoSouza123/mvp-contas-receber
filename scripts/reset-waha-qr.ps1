param(
    [string]$ApiBase = "http://localhost:3001",
    [string]$ApiKey = "changeme",
    [string]$SessionName = "default",
    [string]$WebhookUrl = "http://n8n:5678/webhook/waha-contas-receber"
)

$headers = @{
    "X-Api-Key"    = $ApiKey
    "Content-Type" = "application/json"
}

Write-Host "Parando sessao '$SessionName' se estiver ativa..."
try {
    Invoke-RestMethod -Uri "$ApiBase/api/sessions/$SessionName/stop" -Method Post -Headers $headers | Out-Null
} catch {
    Write-Host "Sessao nao precisou ser parada ou ja estava indisponivel."
}

Write-Host "Reaplicando webhook da sessao '$SessionName'..."
$body = @{
    name   = $SessionName
    config = @{
        webhooks = @(
            @{
                url    = $WebhookUrl
                events = @("message")
            }
        )
    }
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri "$ApiBase/api/sessions/$SessionName" -Method Put -Headers $headers -Body $body | Out-Null

Write-Host "Iniciando sessao '$SessionName'..."
Invoke-RestMethod -Uri "$ApiBase/api/sessions/$SessionName/start" -Method Post -Headers $headers | Out-Null

Start-Sleep -Seconds 2
$status = Invoke-RestMethod -Uri "$ApiBase/api/sessions/$SessionName" -Method Get -Headers @{ "X-Api-Key" = $ApiKey }

Write-Host "Status atual: $($status.status)"
if ($status.status -eq "SCAN_QR_CODE") {
    Write-Host "QR code pronto para leitura no dashboard do WAHA."
} else {
    Write-Host "Sessao retornou um status diferente de SCAN_QR_CODE. Confira o dashboard/logs se necessario."
}
