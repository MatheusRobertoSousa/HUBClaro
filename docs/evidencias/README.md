# Evidências da implementação — 17/09/2026

Ambiente: https://clarohub-matheus-156973.azurewebsites.net

| Verificação | Resultado | Evidência |
|---|---|---|
| Gravação e leitura na API | Protocolo CLARO-MU5BGP6O criado, consultado, atribuído, respondido e encerrado | [Requests e respostas](azure-1789636666037.json) |
| Autenticação e validação | 401 sem sessão, 400 para JSON inválido, WebSocket anônimo rejeitado | Mesmo JSON da API |
| Tempo real | Eventos autenticados recebidos, incluindo encerramento | Mesmo JSON da API |
| PostgreSQL direto | Banco clarohub, usuário clarohub_app, protocolo CLOSED com 3 mensagens e migração aplicada | [Consulta SQL](postgresql-azure.json) |
| Criptografia da conexão SQL | TLS 1.3 | Mesmo JSON do PostgreSQL |
| Navegador | Login, busca, histórico e navegação validados em Microsoft Edge | [Verificação do navegador](navegador-azure.json) |
| Painel | Histórico do protocolo visível na aplicação publicada | [Captura](painel-azure.png) |
| Webhook WhatsApp | Challenge correto: 200; token inválido: 403 | [Integrações](integracoes-azure.json) |

## Dependências externas pendentes

- IA externa: a API retornou `local-fallback`, com indicação de conta OpenAI sem créditos. A triagem local e a persistência da sugestão funcionaram; não foi comprovada geração pelo provedor externo.
- WhatsApp: a consulta de leitura à Meta retornou HTTP 401, código 190, subcódigo 463. A credencial atual foi recusada e precisa ser renovada. Nenhuma mensagem foi enviada e a entrega ao telefone não foi comprovada.
- O callback publicado deve ser configurado no painel Meta para receber eventos reais. Essa configuração externa não foi alterada.

## Repetir a demonstração

Na raiz do HUBClaro, execute `./scripts/verify-cloud.ps1`. Uma nova execução gera outro JSON com dados sintéticos e protocolo próprio. A senha local fica em `.azure-local/credentials.json`, ignorado pelo Git.

Build e validação TypeScript passaram. A publicação foi realizada com Azure CLI e teve build remoto concluído. A infraestrutura usa um App Service e um banco próprios, sobre plano e servidor PostgreSQL compartilhados com o AvaliaTech.
