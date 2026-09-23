[CmdletBinding(SupportsShouldProcess)]
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[a-z0-9-]{3,18}$')]
  [string]$Suffix,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^https://')]
  [string]$FrontendUrl,

  [string]$Location = 'brazilsouth',
  [string]$ResourceGroup = 'rg-clarohub-students',
  [string]$DatabaseAdmin = 'hubadmin',
  [string]$AppServiceSku = 'F1',
  [string]$SeedPassword = $env:SEED_PASSWORD
)

$ErrorActionPreference = 'Stop'

function Invoke-Azure {
  & az @args
  if ($LASTEXITCODE -ne 0) { throw 'Comando Azure falhou. Provisionamento interrompido.' }
}

if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
  throw 'Azure CLI nao encontrado. Execute este arquivo no Azure Cloud Shell ou instale o Azure CLI.'
}

Invoke-Azure account show --output none

$postgresServer = "pg-clarohub-$Suffix"
$databaseName = 'clarohub'
$appPlan = "plan-clarohub-$Suffix"
$webApp = "api-clarohub-$Suffix"
$databasePasswordPointer = [IntPtr]::Zero

try {
  if ($PSCmdlet.ShouldProcess($ResourceGroup, 'Criar recursos do Claro HUB AI no Azure')) {
    if ($SeedPassword.Length -lt 8) {
      throw 'Configure SEED_PASSWORD com pelo menos 8 caracteres para os usuarios iniciais.'
    }
    $databasePasswordSecure = Read-Host 'Senha do administrador PostgreSQL' -AsSecureString
    $databasePasswordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($databasePasswordSecure)
    $databasePassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($databasePasswordPointer)
    $escapedPassword = [Uri]::EscapeDataString($databasePassword)
    $databaseUrl = "postgresql://${DatabaseAdmin}:${escapedPassword}@${postgresServer}.postgres.database.azure.com:5432/${databaseName}?sslmode=require"
    $jwtSecretBytes = New-Object byte[] 48
    $random = [Security.Cryptography.RandomNumberGenerator]::Create()
    $random.GetBytes($jwtSecretBytes)
    $random.Dispose()
    $jwtSecret = [Convert]::ToBase64String($jwtSecretBytes)

    Invoke-Azure group create --name $ResourceGroup --location $Location --output none

    Invoke-Azure postgres flexible-server create `
      --resource-group $ResourceGroup `
      --name $postgresServer `
      --location $Location `
      --admin-user $DatabaseAdmin `
      --admin-password $databasePassword `
      --tier Burstable `
      --sku-name Standard_B1ms `
      --storage-size 32 `
      --version 16 `
      --public-access 0.0.0.0 `
      --yes `
      --output none

    Invoke-Azure postgres flexible-server db create `
      --resource-group $ResourceGroup `
      --server-name $postgresServer `
      --name $databaseName `
      --output none

    Invoke-Azure appservice plan create `
      --resource-group $ResourceGroup `
      --name $appPlan `
      --location $Location `
      --is-linux `
      --sku $AppServiceSku `
      --output none

    Invoke-Azure webapp create `
      --resource-group $ResourceGroup `
      --plan $appPlan `
      --name $webApp `
      --runtime 'NODE:24-lts' `
      --output none

    Invoke-Azure webapp config set `
      --resource-group $ResourceGroup `
      --name $webApp `
      --startup-file 'npm run start:azure' `
      --ftps-state Disabled `
      --min-tls-version 1.2 `
      --output none

    Invoke-Azure resource update `
      --resource-group $ResourceGroup `
      --namespace Microsoft.Web `
      --resource-type basicPublishingCredentialsPolicies `
      --parent "sites/$webApp" `
      --name scm `
      --set properties.allow=true `
      --output none

    Invoke-Azure webapp config appsettings set `
      --resource-group $ResourceGroup `
      --name $webApp `
      --settings `
        NODE_ENV=production `
        DATABASE_PROVIDER='Azure Database for PostgreSQL' `
        DATABASE_URL=$databaseUrl `
        CLIENT_URL=$FrontendUrl `
        JWT_SECRET=$jwtSecret `
        JWT_EXPIRES_IN=8h `
        SEED_PASSWORD=$SeedPassword `
        AI_AUTO_REPLY_THRESHOLD=0.82 `
        SCM_DO_BUILD_DURING_DEPLOYMENT=true `
      --output none

    Invoke-Azure webapp update `
      --resource-group $ResourceGroup `
      --name $webApp `
      --https-only true `
      --output none

    Write-Host "API criada: https://${webApp}.azurewebsites.net"
    Write-Host "Banco criado: ${postgresServer}.postgres.database.azure.com/${databaseName}"
    Write-Host "Configure no GitHub: variable AZURE_WEBAPP_NAME=$webApp"
    Write-Warning 'Restrinja a regra de firewall do PostgreSQL depois da demonstracao. 0.0.0.0 permite conexoes de servicos Azure.'
  }
}
finally {
  if ($databasePasswordPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($databasePasswordPointer)
  }
  Remove-Variable databasePassword, databaseUrl, jwtSecret -ErrorAction SilentlyContinue
}
