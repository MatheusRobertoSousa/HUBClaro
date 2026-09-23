# Operação do HUB Claro no Azure

| Recurso | Nome |
|---|---|
| Assinatura | Azure for Students |
| Grupo compartilhado | rg-avaliatech-students |
| Aplicação exclusiva | clarohub-matheus-156973 |
| Plano compartilhado | plan-avaliatech-students, Linux F1 |
| PostgreSQL compartilhado | avaliatech-pg-156973, versão 16, B1ms |
| Banco e usuário exclusivos | clarohub / clarohub_app |

Painel: https://clarohub-matheus-156973.azurewebsites.net

Health: https://clarohub-matheus-156973.azurewebsites.net/api/health

## Acesso

Login: admin@claro.com.br. A senha gerada para a nuvem está em .azure-local/credentials.json, campo password. Esse diretório é ignorado pelo Git. O seed local usa Claro@123; a nuvem exige SEED_PASSWORD.

server/.env permanece como configuração local. As integrações nele configuradas foram copiadas para o App Service, sem incluir o arquivo no pacote. Alterar o .env posteriormente não altera a nuvem automaticamente.

## Validar e demonstrar

```powershell
./scripts/verify-cloud.ps1
./scripts/demo-azure.ps1 -ApiUrl https://clarohub-matheus-156973.azurewebsites.net
```

Em outro computador, configure DEMO_PASSWORD e passe a URL para verify-cloud.ps1 -ApiUrl. Não inclua senha ou tokens em slides, commits ou capturas.

## Publicar alterações

Pré-requisitos: Node.js, dependências instaladas com npm ci, Python 3 e Azure CLI autenticado. Os recursos e configurações precisam existir.

```powershell
./scripts/deploy-azure.ps1
```

Aguarde o build remoto, consulte o health e rode a verificação. Para acompanhar:

```powershell
az webapp log deployment show -g rg-avaliatech-students -n clarohub-matheus-156973
az webapp log tail -g rg-avaliatech-students -n clarohub-matheus-156973
```

Workflows GitHub exigem secrets/variables no repositório e são alternativa para publicações futuras. A implementação usa Azure CLI; não se presume execução do GitHub Actions. Static Web Apps não faz parte do ambiente atual.

## WhatsApp

Callback: https://clarohub-matheus-156973.azurewebsites.net/api/integrations/whatsapp/webhook

Para receber eventos reais, configure callback, verify token e assinaturas de eventos no painel Meta. A simulação usa o canal SITE e não envia mensagens a terceiros. Credenciais expiradas precisam ser renovadas no provedor.

## Custos e manutenção

A aplicação usa o plano F1 e o PostgreSQL existentes. Não exclua o grupo, plano ou servidor PostgreSQL para remover apenas o HUB Claro: eles também atendem ao AvaliaTech. Uma remoção futura deve ser limitada ao App Service do HUB Claro, banco clarohub e usuário clarohub_app, após preservar os dados.

