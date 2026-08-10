# Arquitetura

## Visao geral

O Claro HUB AI centraliza chamados de WhatsApp, site e app em uma API unica. Cada mensagem de entrada passa por:

1. Identificacao ou criacao do cliente.
2. Reuso de chamado ativo no mesmo canal ou criacao de novo protocolo.
3. Persistencia da mensagem original.
4. Triagem de IA para intencao, prioridade, resumo e resposta sugerida.
5. Emissao de evento em tempo real para atualizar o painel dos funcionarios.

## Backend

- `src/routes/auth.ts`: login, sessao atual e cadastro de usuarios por admin/supervisor.
- `src/routes/tickets.ts`: fila, metricas, mensagens, atribuicao, status e sugestoes de IA.
- `src/routes/integrations.ts`: webhook WhatsApp e entrada publica para site/app.
- `src/services/aiService.ts`: provedor de IA e fallback local.
- `src/services/ticketService.ts`: orquestracao de clientes, chamados, mensagens e triagem.
- `src/services/whatsappService.ts`: parser do webhook e envio pela WhatsApp Cloud API.

## Frontend

- Login com JWT salvo localmente.
- Dashboard com volumetria operacional.
- Fila unificada filtravel por status, canal e busca.
- Conversa com historico, sugestao de IA, assumir chamado, mudar status e responder.
- Socket.IO para receber atualizacoes de chamados sem recarregar a tela.

## Banco

Banco local em SQLite via Prisma:

- `User`
- `Customer`
- `Ticket`
- `Message`
- `AiSuggestion`
- `IntegrationEvent`

## Integracoes

### WhatsApp

Webhook configuravel em:

```text
/api/integrations/whatsapp/webhook
```

O envio usa a WhatsApp Cloud API quando `WHATSAPP_ACCESS_TOKEN` e `WHATSAPP_PHONE_NUMBER_ID` estao configurados. Sem essas credenciais, o servidor simula o envio no log.

### Site e App

Entrada publica para clientes digitais:

```text
POST /api/integrations/public/message
```

Payload:

```json
{
  "channel": "SITE",
  "body": "Estou sem internet",
  "customer": {
    "name": "Cliente",
    "phone": "5511999999999"
  }
}
```

## Producao

Antes de ir para producao, recomenda-se trocar SQLite por PostgreSQL, mover segredos para cofre, adicionar auditoria detalhada de SLA, configurar filas para webhooks e aplicar politicas de privacidade/LGPD para dados de atendimento.
