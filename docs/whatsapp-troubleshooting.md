# WhatsApp Troubleshooting

## Meta aceitou, mas nao chegou no celular

Quando a Cloud API retorna `200` com `messages[0].id`, a mensagem foi aceita pela Meta. Isso ainda nao confirma entrega no telefone.

Para confirmar entrega real, configure um webhook HTTPS publico e assine o campo `messages` no painel da Meta. O HUB grava os eventos recebidos em `IntegrationEvent` e mostra na aba `Canais`.

## URL publica temporaria

Com a API rodando localmente:

```bash
npm run tunnel:webhook
```

Use a URL gerada como base do callback:

```text
https://SUA-URL.loca.lt/api/integrations/whatsapp/webhook
```

No campo verify token da Meta, use o valor de `WHATSAPP_VERIFY_TOKEN` no `server/.env`.

## Texto livre vs template

- `Texto livre`: so deve entregar dentro da janela de atendimento de 24h aberta quando o cliente manda uma mensagem para a empresa.
- `Template`: use para iniciar conversa fora da janela de 24h. No app de teste da Meta, o template padrao costuma ser `hello_world` com idioma `en_US`.

## Checklist rapido

- O numero destino precisa estar verificado/adicionado em `To` no painel da Meta.
- O celular precisa estar usando esse numero no WhatsApp.
- Para receber mensagens/status no HUB, o webhook precisa ser HTTPS publico, nao `localhost`.
- Se o evento `STATUS_FAILED` chegar na aba `Canais`, abra o payload no banco para ver o motivo retornado pela Meta.
