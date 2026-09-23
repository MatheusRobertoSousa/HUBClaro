[CmdletBinding()]
param(
  [string]$ResourceGroup = 'rg-avaliatech-students',
  [string]$AppName = 'clarohub-matheus-156973'
)
$ErrorActionPreference = 'Stop'
function Check-Exit([string]$Step) { if ($LASTEXITCODE -ne 0) { throw "Falha: $Step" } }
$root = Split-Path $PSScriptRoot -Parent
$previousApi = $env:VITE_API_URL
Push-Location $root
try {
  $hostname = az webapp show -g $ResourceGroup -n $AppName --query defaultHostName -o tsv
  Check-Exit 'Consultar App Service'
  $env:VITE_API_URL = "https://$hostname"
  npm run lint
  Check-Exit 'TypeScript'
  npm run build
  Check-Exit 'Build'
  $release = Join-Path $root ".azure-local/release-$(Get-Date -Format yyyyMMddHHmmss)"
  node scripts/package-azure.mjs $release
  Check-Exit 'Preparar pacote'
  $zip = "$release.zip"
  python scripts/zip-azure.py $release $zip
  Check-Exit 'ZIP portavel para Linux'
  az webapp deploy -g $ResourceGroup -n $AppName --src-path $zip --type zip --async true --track-status false --output none
  Check-Exit 'Publicar'
  Write-Host "Pacote enviado. Aguarde o build remoto e verifique https://$hostname/api/health"
} finally {
  $env:VITE_API_URL = $previousApi
  Pop-Location
}
