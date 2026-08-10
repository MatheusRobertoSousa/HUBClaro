# API

Base local:

```text
http://localhost:3333
```

## Autenticacao

```http
POST /api/auth/login
```

```json
{
  "email": "admin@claro.com.br",
  "password": "Claro@123"
}
```

Use o token retornado como:

```http
Authorization: Bearer TOKEN
```

## Chamados

```http
GET /api/tickets
GET /api/tickets?status=OPEN&channel=WHATSAPP&q=fatura
GET /api/tickets/metrics/summary
GET /api/tickets/:id
POST /api/tickets
POST /api/tickets/:id/messages
POST /api/tickets/:id/assign
PATCH /api/tickets/:id/status
POST /api/tickets/:id/ai/reply
```

Criacao manual/protegida:

```json
{
  "channel": "APP",
  "subject": "Falha no app",
  "body": "Nao consigo abrir minha fatura",
  "customer": {
    "name": "Maria Silva",
    "phone": "5511999999999"
  }
}
```

## Integracoes

Status autenticado:

```http
GET /api/integrations/status
```

Teste autenticado de IA:

```http
POST /api/integrations/ai/test
```

```json
{
  "message": "Estou sem internet desde ontem"
}
```

Teste autenticado de WhatsApp:

```http
POST /api/integrations/whatsapp/test-send
```

```json
{
  "to": "+55 11 97785-4607",
  "message": "Teste do Claro HUB AI"
}
```

WhatsApp:

```http
GET /api/integrations/whatsapp/webhook
POST /api/integrations/whatsapp/webhook
```

Site/App:

```http
POST /api/integrations/public/message
```

```json
{
  "channel": "SITE",
  "body": "Estou sem internet desde ontem",
  "customer": {
    "name": "Cliente Site",
    "phone": "551188887777"
  }
}
```
