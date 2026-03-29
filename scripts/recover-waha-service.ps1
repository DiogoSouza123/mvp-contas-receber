param(
    [string]$ComposeProjectPath = "C:\Users\diogo\Documents\New project 4",
    [string]$ContainerName = "mvp-waha",
    [string]$ApiBase = "http://localhost:3001",
    [string]$ApiKey = "changeme"
)

Set-Location $ComposeProjectPath

Write-Host "Subindo o servico WAHA pelo Docker Compose..."
docker compose up -d waha

Start-Sleep -Seconds 3

Write-Host "Containers ativos:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

Write-Host ""
Write-Host "Testando a API do WAHA..."
try {
    $status = Invoke-RestMethod -Uri "$ApiBase/api/server/status" -Method Get -Headers @{ "X-Api-Key" = $ApiKey }
    Write-Host "WAHA respondeu com sucesso."
    $status | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Falha ao consultar a API do WAHA."
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.ReadToEnd()
    } else {
        Write-Host $_.Exception.Message
    }
}

Write-Host ""
Write-Host "Ultimas linhas do log do container:"
docker logs $ContainerName --tail 40
