# Claro HUB AI

## Ambiente Azure

- [Abrir HUB Claro](https://clarohub-matheus-156973.azurewebsites.net)
- Login: `admin@claro.com.br`; senha da nuvem em `.azure-local/credentials.json`, campo `password` (arquivo ignorado pelo Git).
- Demonstracao completa: `./scripts/verify-cloud.ps1`.
- [Arquitetura e implementacao tecnica](docs/azure-implementation.md), [operacao e deploy](docs/azure-deployment.md), [roteiro da apresentacao](docs/roteiro-apresentacao.md).

Frontend e API usam o mesmo App Service; os dados ficam no banco PostgreSQL `clarohub`. O `.env` abaixo configura o desenvolvimento local.

HUB de convergencia de interfaces conversacionais para centralizar chamados vindos de WhatsApp, site e app, com triagem por IA e atendimento humano em um painel unico.

## Stack

- Backend: Node.js, Express, TypeScript, Prisma, SQLite, JWT.
- Frontend: React, Vite, TypeScript, Socket.IO e CSS responsivo.
- Integracoes: webhook WhatsApp Cloud API, endpoint publico para site/app e automacao de IA com fallback local.

## Primeiros passos

```bash
npm install
Copy-Item server/.env.example server/.env
Copy-Item web/.env.example web/.env
npm run prisma:migrate
npm run seed
npm run dev
```

URLs padrao:

- API: `http://localhost:3333`
- Web: `http://localhost:5173`

Credenciais seed:

- Admin: `admin@claro.com.br` / `Claro@123`
- Atendente: `atendente@claro.com.br` / `Claro@123`

## WhatsApp

Configure no `server/.env`:

```env
WHATSAPP_VERIFY_TOKEN=um_token_de_verificacao
WHATSAPP_ACCESS_TOKEN=token_da_meta
WHATSAPP_PHONE_NUMBER_ID=id_do_numero
WHATSAPP_TEST_PHONE=5511977854607
```

Webhook de verificacao/recebimento:

```text
GET/POST http://SEU_DOMINIO/api/integrations/whatsapp/webhook
```

Sem token da Meta, o backend registra a mensagem e simula o envio no log.

No painel web, abra a aba `Canais` para ver o status da integração e enviar uma mensagem de teste para o número configurado.

Importante: a resposta `accepted` da Meta significa que a requisição foi aceita, não que o celular recebeu. Para iniciar conversa fora da janela de 24h, use template aprovado, por exemplo `hello_world`. Para receber status real de entrega, leitura ou falha, o webhook precisa estar em uma URL HTTPS pública configurada no painel da Meta; `localhost` não recebe callbacks externos.

Para abrir uma URL publica temporaria para o webhook local:

```bash
npm run tunnel:webhook
```

Veja tambem [WhatsApp Troubleshooting](docs/whatsapp-troubleshooting.md).

## IA

Configure:

```env
OPENAI_API_KEY=sua_chave
OPENAI_MODEL=gpt-4.1-mini
AI_AUTO_REPLY_THRESHOLD=0.82
```

Sem chave, o sistema usa triagem local por palavras-chave para continuar operando em desenvolvimento.

No painel web, abra a aba `IA` para testar a chave OpenAI. Se a conta estiver sem créditos, a tela mostra o aviso e usa fallback local.

## Documentacao

- [Arquitetura](docs/architecture.md)
- [API](docs/api.md)
- [Implementacao tecnica no Azure](docs/azure-implementation.md)
- [Deploy no Azure for Students](docs/azure-deployment.md)
- [Roteiro da apresentacao tecnica](docs/roteiro-apresentacao.md)

## Marca

O logo Claro usado no painel fica em `web/public/assets/claro-logo.svg`, obtido do Wikimedia Commons como SVG baseado no logo oficial da Claro.
