import { Channel, SenderType, TicketStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { env } from "../lib/env.js";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { generateAiSuggestion, getAiConfiguration } from "../services/aiService.js";
import { handleInboundMessage } from "../services/ticketService.js";
import { extractWhatsAppTextMessages, getWhatsAppConfiguration, sendWhatsAppMessage, sendWhatsAppTemplate } from "../services/whatsappService.js";

export const integrationsRouter = Router();

integrationsRouter.get("/status", authenticate, (_req, res) => {
  res.json({
    ai: getAiConfiguration(),
    whatsapp: getWhatsAppConfiguration(),
    webhookUrl: "/api/integrations/whatsapp/webhook"
  });
});

const aiTestSchema = z.object({
  message: z.string().min(3).default("Estou sem internet e preciso de ajuda urgente.")
});

integrationsRouter.post("/ai/test", authenticate, async (req, res, next) => {
  try {
    const input = aiTestSchema.parse(req.body);
    const now = new Date();
    const result = await generateAiSuggestion({
      latestMessage: input.message,
      ticket: {
        id: "test-ticket",
        protocol: "CLARO-TESTE-IA",
        channel: Channel.SITE,
        subject: "Teste de IA",
        summary: null,
        status: TicketStatus.NEW,
        priority: "MEDIUM",
        aiConfidence: null,
        tags: null,
        externalRef: null,
        createdAt: now,
        updatedAt: now,
        lastMessageAt: now,
        customerId: "test-customer",
        assignedToId: null
      },
      messages: [
        {
          id: "test-message",
          ticketId: "test-ticket",
          senderType: SenderType.CUSTOMER,
          body: input.message,
          metadata: null,
          authorUserId: null,
          createdAt: now
        }
      ]
    });

    res.json({ result, provider: result.provider, providerError: result.providerError });
  } catch (error) {
    next(error);
  }
});

const whatsappTestSchema = z.object({
  to: z.string().min(8).optional(),
  message: z.string().min(1).default("Teste do Claro HUB AI: WhatsApp integrado com sucesso.")
});

integrationsRouter.post("/whatsapp/test-send", authenticate, async (req, res, next) => {
  try {
    const input = whatsappTestSchema.parse(req.body);
    const target = input.to ?? env.whatsappTestPhone;
    const result = await sendWhatsAppMessage(target, input.message);
    const messageId = extractOutboundMessageId(result);

    await prisma.integrationEvent.create({
      data: {
        source: "WHATSAPP",
        eventType: "OUTBOUND_TEXT_ACCEPTED",
        externalId: messageId,
        payload: JSON.stringify({ to: target, result })
      }
    });

    res.json({
      ok: true,
      acceptedByMeta: true,
      messageId,
      result,
      whatsapp: getWhatsAppConfiguration()
    });
  } catch (error) {
    next(error);
  }
});

const whatsappTemplateSchema = z.object({
  to: z.string().min(8).optional(),
  templateName: z.string().min(1).default("hello_world"),
  languageCode: z.string().min(2).default("en_US")
});

integrationsRouter.post("/whatsapp/test-template", authenticate, async (req, res, next) => {
  try {
    const input = whatsappTemplateSchema.parse(req.body);
    const target = input.to ?? env.whatsappTestPhone;
    const result = await sendWhatsAppTemplate(target, input.templateName, input.languageCode);
    const messageId = extractOutboundMessageId(result);

    await prisma.integrationEvent.create({
      data: {
        source: "WHATSAPP",
        eventType: "OUTBOUND_TEMPLATE_ACCEPTED",
        externalId: messageId,
        payload: JSON.stringify({ to: target, templateName: input.templateName, languageCode: input.languageCode, result })
      }
    });

    res.json({
      ok: true,
      acceptedByMeta: true,
      messageId,
      result,
      whatsapp: getWhatsAppConfiguration()
    });
  } catch (error) {
    next(error);
  }
});

integrationsRouter.get("/whatsapp/events", authenticate, async (_req, res, next) => {
  try {
    const events = await prisma.integrationEvent.findMany({
      where: { source: "WHATSAPP" },
      orderBy: { createdAt: "desc" },
      take: 20
    });

    res.json({ events });
  } catch (error) {
    next(error);
  }
});

integrationsRouter.get("/whatsapp/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === env.whatsappVerifyToken && typeof challenge === "string") {
    res.status(200).send(challenge);
    return;
  }

  res.sendStatus(403);
});

integrationsRouter.post("/whatsapp/webhook", async (req, res, next) => {
  try {
    await prisma.integrationEvent.create({
      data: {
        source: "WHATSAPP",
        eventType: "WEBHOOK_RECEIVED",
        payload: JSON.stringify(req.body)
      }
    });

    for (const status of extractWhatsAppStatuses(req.body)) {
      await prisma.integrationEvent.create({
        data: {
          source: "WHATSAPP",
          eventType: `STATUS_${status.status.toUpperCase()}`,
          externalId: status.id,
          payload: JSON.stringify(status),
          processedAt: new Date()
        }
      });
    }

    const messages = extractWhatsAppTextMessages(req.body);
    for (const message of messages) {
      await handleInboundMessage({
        channel: Channel.WHATSAPP,
        body: message.body,
        externalRef: message.id,
        customer: {
          name: message.name,
          phone: message.from
        }
      });
    }

    res.sendStatus(200);
  } catch (error) {
    next(error);
  }
});

function extractOutboundMessageId(result: unknown) {
  if (!result || typeof result !== "object") {
    return null;
  }

  const messages = (result as { messages?: Array<{ id?: string }> }).messages;
  return messages?.[0]?.id ?? null;
}

function extractWhatsAppStatuses(payload: unknown) {
  const statuses: Array<{ id: string; status: string; timestamp?: string; recipientId?: string; errors?: unknown }> = [];
  const entries = (payload as { entry?: Array<{ changes?: Array<{ value?: { statuses?: Array<Record<string, unknown>> } }> }> }).entry ?? [];

  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      for (const status of change.value?.statuses ?? []) {
        if (typeof status.id === "string" && typeof status.status === "string") {
          statuses.push({
            id: status.id,
            status: status.status,
            timestamp: typeof status.timestamp === "string" ? status.timestamp : undefined,
            recipientId: typeof status.recipient_id === "string" ? status.recipient_id : undefined,
            errors: status.errors
          });
        }
      }
    }
  }

  return statuses;
}

const publicMessageSchema = z.object({
  channel: z.enum(["SITE", "APP"]),
  body: z.string().min(1),
  subject: z.string().optional(),
  customer: z.object({
    name: z.string().min(2).optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    claroId: z.string().optional()
  })
});

integrationsRouter.post("/public/message", async (req, res, next) => {
  try {
    const input = publicMessageSchema.parse(req.body);
    const result = await handleInboundMessage({
      ...input,
      channel: input.channel === "APP" ? Channel.APP : Channel.SITE
    });

    res.status(201).json({
      protocol: result.ticket.protocol,
      suggestion: result.suggestion.shouldAutoReply ? result.suggestion.suggestedReply : undefined
    });
  } catch (error) {
    next(error);
  }
});
