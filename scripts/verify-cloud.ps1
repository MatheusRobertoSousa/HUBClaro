[CmdletBinding()]
param([string]$ApiUrl, [string]$Email, [string]$Password)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$previous = @{ DEMO_API_URL = $env:DEMO_API_URL; DEMO_EMAIL = $env:DEMO_EMAIL; DEMO_PASSWORD = $env:DEMO_PASSWORD }
try {
  $file = Join-Path $root '.azure-local/credentials.json'
  if (Test-Path $file) {
    $credentials = Get-Content $file -Raw | ConvertFrom-Json
    if (-not $ApiUrl) { $ApiUrl = $credentials.appUrl }
    if ($ApiUrl -eq $credentials.appUrl) {
      if (-not $Email) { $Email = $credentials.email }
      if (-not $Password) { $Password = $credentials.password }
    }
  }
  if ($ApiUrl) { $env:DEMO_API_URL = $ApiUrl }
  if ($Email) { $env:DEMO_EMAIL = $Email }
  if ($Password) { $env:DEMO_PASSWORD = $Password }
  Push-Location $root
  try {
    node scripts/verify-cloud.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Verificacao em nuvem falhou.' }
  } finally { Pop-Location }
} finally {
  foreach ($key in $previous.Keys) { [Environment]::SetEnvironmentVariable($key, $previous[$key], 'Process') }
}
