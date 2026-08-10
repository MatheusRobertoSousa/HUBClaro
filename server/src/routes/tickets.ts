import { Channel, SenderType, TicketStatus, UserRole } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { emitHubEvent } from "../lib/realtime.js";
import { prisma } from "../lib/prisma.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { generateAiSuggestion } from "../services/aiService.js";
import { getTicketById, handleInboundMessage, ticketInclude } from "../services/ticketService.js";
import { sendWhatsAppMessage } from "../services/whatsappService.js";
import { HttpError } from "../lib/httpError.js";

export const ticketsRouter = Router();

ticketsRouter.use(authenticate);

const listSchema = z.object({
  status: z.nativeEnum(TicketStatus).optional(),
  channel: z.nativeEnum(Channel).optional(),
  assignedTo: z.enum(["me", "unassigned"]).optional(),
  q: z.string().optional()
});

ticketsRouter.get("/users/agents", requireRole([UserRole.ADMIN, UserRole.SUPERVISOR]), async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" }
    });
    res.json({ users });
  } catch (error) {
    next(error);
  }
});

ticketsRouter.get("/", async (req, res, next) => {
  try {
    const filters = listSchema.parse(req.query);
    const tickets = await prisma.ticket.findMany({
      where: {
        status: filters.status,
        channel: filters.channel,
        assignedToId: filters.assignedTo === "me" ? req.user?.id : filters.assignedTo === "unassigned" ? null : undefined,
        OR: filters.q
          ? [
              { protocol: { contains: filters.q } },
              { subject: { contains: filters.q } },
              { summary: { contains: filters.q } },
              { customer: { name: { contains: filters.q } } },
              { customer: { phone: { contains: filters.q } } }
            ]
          : undefined
      },
      include: ticketInclude,
      orderBy: { lastMessageAt: "desc" }
    });

    res.json({ tickets });
  } catch (error) {
    next(error);
  }
});

ticketsRouter.get("/metrics/summary", async (_req, res, next) => {
  try {
    const [totalOpen, aiTriaged, closed, byChannel, urgent] = await Promise.all([
      prisma.ticket.count({ where: { status: { in: [TicketStatus.NEW, TicketStatus.AI_TRIAGE, TicketStatus.OPEN, TicketStatus.PENDING] } } }),
      prisma.ticket.count({ where: { status: TicketStatus.AI_TRIAGE } }),
      prisma.ticket.count({ where: { status: TicketStatus.CLOSED } }),
      prisma.ticket.groupBy({ by: ["channel"], _count: true }),
      prisma.ticket.count({ where: { priority: "URGENT", status: { not: TicketStatus.CLOSED } } })
    ]);

    res.json({
      totalOpen,
      aiTriaged,
      closed,
      urgent,
      byChannel: byChannel.map((item) => ({ channel: item.channel, count: item._count }))
    });
  } catch (error) {
    next(error);
  }
});

const createSchema = z.object({
  channel: z.nativeEnum(Channel),
  body: z.string().min(1),
  subject: z.string().optional(),
  customer: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    claroId: z.string().optional()
  })
});

ticketsRouter.post("/", async (req, res, next) => {
  try {
    const input = createSchema.parse(req.body);
    const result = await handleInboundMessage(input);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

ticketsRouter.get("/:id", async (req, res, next) => {
  try {
    const ticket = await getTicketById(req.params.id);
    if (!ticket) {
      throw new HttpError(404, "Chamado não encontrado.");
    }
    res.json({ ticket });
  } catch (error) {
    next(error);
  }
});

const messageSchema = z.object({
  body: z.string().min(1),
  sendToChannel: z.boolean().default(true)
});

ticketsRouter.post("/:id/messages", async (req, res, next) => {
  try {
    const input = messageSchema.parse(req.body);
    const ticket = await getTicketById(req.params.id);

    if (!ticket) {
      throw new HttpError(404, "Chamado não encontrado.");
    }

    const message = await prisma.message.create({
      data: {
        ticketId: ticket.id,
        senderType: SenderType.AGENT,
        authorUserId: req.user?.id,
        body: input.body,
        metadata: JSON.stringify({
          sentToChannel: input.sendToChannel
        })
      }
    });

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: TicketStatus.OPEN,
        lastMessageAt: message.createdAt
      }
    });

    if (input.sendToChannel && ticket.channel === Channel.WHATSAPP && ticket.customer.phone) {
      await sendWhatsAppMessage(ticket.customer.phone, input.body);
    }

    const hydrated = await getTicketById(ticket.id);
    emitHubEvent("ticket:updated", hydrated);
    res.status(201).json({ message, ticket: hydrated });
  } catch (error) {
    next(error);
  }
});

const assignSchema = z.object({
  userId: z.string().nullable()
});

ticketsRouter.post("/:id/assign", async (req, res, next) => {
  try {
    const input = assignSchema.parse(req.body);
    const updated = await prisma.ticket.update({
      where: { id: req.params.id },
      data: {
        assignedToId: input.userId,
        status: TicketStatus.OPEN
      },
      include: ticketInclude
    });

    await prisma.message.create({
      data: {
        ticketId: updated.id,
        senderType: SenderType.SYSTEM,
        authorUserId: req.user?.id,
        body: input.userId ? "Chamado atribuído." : "Chamado voltou para a fila."
      }
    });

    const hydrated = await getTicketById(updated.id);
    emitHubEvent("ticket:updated", hydrated);
    res.json({ ticket: hydrated });
  } catch (error) {
    next(error);
  }
});

const statusSchema = z.object({
  status: z.nativeEnum(TicketStatus)
});

ticketsRouter.patch("/:id/status", async (req, res, next) => {
  try {
    const input = statusSchema.parse(req.body);
    const ticket = await prisma.ticket.update({
      where: { id: req.params.id },
      data: { status: input.status },
      include: ticketInclude
    });
    emitHubEvent("ticket:updated", ticket);
    res.json({ ticket });
  } catch (error) {
    next(error);
  }
});

ticketsRouter.post("/:id/ai/reply", async (req, res, next) => {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: req.params.id },
      include: {
        messages: { orderBy: { createdAt: "asc" } }
      }
    });

    if (!ticket) {
      throw new HttpError(404, "Chamado não encontrado.");
    }

    const latestMessage = ticket.messages.at(-1)?.body ?? ticket.summary ?? "";
    const ai = await generateAiSuggestion({ ticket, messages: ticket.messages, latestMessage });

    const suggestion = await prisma.aiSuggestion.create({
      data: {
        ticketId: ticket.id,
        intent: ai.intent,
        sentiment: ai.sentiment,
        confidence: ai.confidence,
        suggestedReply: ai.suggestedReply,
        nextBestAction: ai.nextBestAction
      }
    });

    const hydrated = await getTicketById(ticket.id);
    emitHubEvent("ticket:updated", hydrated);
    res.status(201).json({ suggestion, ticket: hydrated });
  } catch (error) {
    next(error);
  }
});
