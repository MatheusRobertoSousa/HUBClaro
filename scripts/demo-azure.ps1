[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateScript({ $_ -match '^https://' -or $_ -match '^http://localhost(?::\d+)?$' })]
  [string]$ApiUrl,
  [string]$Email = 'admin@claro.com.br',
  [string]$Password = $env:DEMO_PASSWORD
)

$ErrorActionPreference = 'Stop'
$ApiUrl = $ApiUrl.TrimEnd('/')
if (-not $Password) {
  $credentialsPath = Join-Path $PSScriptRoot '../.azure-local/credentials.json'
  if (Test-Path $credentialsPath) {
    $credentials = Get-Content $credentialsPath -Raw | ConvertFrom-Json
    if ($credentials.appUrl -eq $ApiUrl) { $Password = $credentials.password }
  }
}
if (-not $Password) { throw 'Configure DEMO_PASSWORD ou informe -Password.' }
$runId = Get-Date -Format 'yyyyMMdd-HHmmss'
$phone = "55119$((Get-Random -Minimum 10000000 -Maximum 99999999))"

Write-Host '1/5 - Health check e prova do banco em nuvem'
$health = Invoke-RestMethod "$ApiUrl/api/health"
$health | ConvertTo-Json
if (-not $health.ok) { throw 'Health check falhou.' }
if ($health.database -notmatch 'postgres') { throw 'O banco conectado nao e PostgreSQL. Esta demonstracao exige banco em nuvem.' }

Write-Host '2/5 - POST publico: gravacao de cliente, chamado, mensagem e triagem'
$newTicketBody = @{
  channel = 'SITE'
  subject = "Demonstracao Azure $runId"
  body = "Minha internet Claro esta lenta e preciso de suporte. Demo $runId"
  customer = @{
    name = "Cliente Demo $runId"
    phone = $phone
    email = "cliente.$runId@example.com"
  }
} | ConvertTo-Json -Depth 4
$created = Invoke-RestMethod `
  -Method Post `
  -Uri "$ApiUrl/api/integrations/public/message" `
  -ContentType 'application/json' `
  -Body $newTicketBody
$created | ConvertTo-Json
if (-not $created.protocol) { throw 'A API nao retornou o protocolo gravado.' }

Write-Host '3/5 - Login e obtencao do JWT'
$loginBody = @{ email = $Email; password = $Password } | ConvertTo-Json
$session = Invoke-RestMethod `
  -Method Post `
  -Uri "$ApiUrl/api/auth/login" `
  -ContentType 'application/json' `
  -Body $loginBody
$headers = @{ Authorization = "Bearer $($session.token)" }

Write-Host '4/5 - GET autenticado: leitura do mesmo registro no banco configurado'
$encodedProtocol = [Uri]::EscapeDataString($created.protocol)
$result = Invoke-RestMethod `
  -Uri "$ApiUrl/api/tickets?q=$encodedProtocol" `
  -Headers $headers
$persisted = $result.tickets | Where-Object protocol -eq $created.protocol
if (-not $persisted) { throw "Protocolo $($created.protocol) nao foi encontrado apos a gravacao." }
$persisted | Select-Object protocol, subject, status, priority, channel, createdAt | ConvertTo-Json

Write-Host '5/5 - GET de metricas agregadas'
$metrics = Invoke-RestMethod -Uri "$ApiUrl/api/tickets/metrics/summary" -Headers $headers
$metrics | ConvertTo-Json -Depth 4

Write-Host "SUCESSO: o protocolo $($created.protocol) foi gravado e relido da nuvem."
