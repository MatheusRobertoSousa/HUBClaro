# Roteiro — Implementação Técnica (15 pontos)

Abra o painel publicado, Portal Azure, docs/azure-implementation.md, requests/azure-demo.http e um terminal na raiz do HUBClaro. Reserve 8 a 10 minutos.

## 1. Solução e tecnologias — 2 minutos

Apresente o HUB como central de atendimento Claro. Mostre a tabela e o diagrama: React/TypeScript/Vite na interface, Node/Express no backend, Prisma/PostgreSQL na persistência e Socket.IO no tempo real. Computação e armazenamento são fornecidos pelo Azure.

## 2. Arquitetura executada — 2 minutos

Mostre o App Service clarohub-matheus-156973 e o PostgreSQL no Portal. React e API estão no mesmo domínio HTTPS; apenas o backend acessa o banco. O banco clarohub é separado do AvaliaTech, embora o servidor seja compartilhado. Mostre o modelo Prisma e as relações cliente → chamado → mensagens/sugestões.

## 3. Requests — 2 minutos

No REST Client, configure a senha localmente e execute login, POST público e GET pelo protocolo. Mostre 201 Created na gravação e 200 OK na leitura. Aponte o mesmo protocolo, mensagem original, cliente e sugestão. Use dados fictícios. Não exiba o JWT do login na apresentação.

## 4. Simulação funcional — 2 minutos

Deixe o painel autenticado aberto e execute:

```powershell
./scripts/verify-cloud.ps1
```

O teste cria, consulta, atribui, responde e encerra um atendimento, além de verificar autenticação, validação, métricas e WebSocket. Mostre SUCESSO e o JSON indicado. Pesquise o protocolo no painel, incluindo chamados fechados, e abra o histórico.

## 5. Limites comprovados — 1 minuto

Identifique se a triagem utilizou openai ou local-fallback. Não apresente fallback como chamada real à IA externa. O webhook publicado depende do painel Meta para recebimento real; o teste não envia WhatsApp. A publicação foi feita por Azure CLI; workflows disponíveis não comprovam execução do GitHub Actions.

## Evidências para entrega

- Diagrama e tabela: docs/azure-implementation.md.
- Requests: requests/azure-demo.http.
- JSON da execução: docs/evidencias/.
- Captura do painel e dos recursos Azure, ocultando segredos.
- Mesmo protocolo no POST, GET e histórico do painel.

