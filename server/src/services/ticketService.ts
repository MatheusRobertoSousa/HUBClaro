import { Channel, SenderType, TicketStatus, type Customer, type Ticket } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { emitHubEvent } from "../lib/realtime.js";
import { generateAiSuggestion } from "./aiService.js";
import { sendWhatsAppMessage } from "./whatsappService.js";

type CustomerInput = {
  name?: string;
  phone?: string;
  email?: string;
  claroId?: string;
};

type InboundInput = {
  channel: Channel;
  body: string;
  customer: CustomerInput;
  externalRef?: string;
  subject?: string;
};

export async function handleInboundMessage(input: InboundInput) {
  const customer = await upsertCustomer(input.customer);
  const ticket = await findOrCreateActiveTicket(customer, input);

  const message = await prisma.message.create({
    data: {
      ticketId: ticket.id,
      senderType: SenderType.CUSTOMER,
      body: input.body,
      metadata: JSON.stringify({
        externalRef: input.externalRef,
        sourceChannel: input.channel
      })
    }
  });

  const updatedTicket = await prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      status: ticket.status === TicketStatus.NEW ? TicketStatus.AI_TRIAGE : ticket.status,
      lastMessageAt: message.createdAt
    },
    include: ticketInclude
  });

  const messages = await prisma.message.findMany({
    where: { ticketId: ticket.id },
    orderBy: { createdAt: "asc" }
  });

  const ai = await generateAiSuggestion({
    ticket: updatedTicket,
    messages,
    latestMessage: input.body
  });

  await prisma.aiSuggestion.create({
    data: {
      ticketId: ticket.id,
      intent: ai.intent,
      sentiment: ai.sentiment,
      confidence: ai.confidence,
      suggestedReply: ai.suggestedReply,
      nextBestAction: ai.nextBestAction
    }
  });

  const ticketAfterAi = await prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      subject: input.subject ?? titleFromIntent(ai.intent),
      summary: ai.summary,
      priority: ai.priority,
      aiConfidence: ai.confidence,
      tags: JSON.stringify(ai.tags),
      status: ai.shouldAutoReply ? TicketStatus.PENDING : TicketStatus.OPEN
    },
    include: ticketInclude
  });

  if (ai.shouldAutoReply) {
    await prisma.message.create({
      data: {
        ticketId: ticket.id,
        senderType: SenderType.AI,
        body: ai.suggestedReply,
        metadata: JSON.stringify({ autoReply: true })
      }
    });

    if (input.channel === Channel.WHATSAPP && customer.phone) {
      await sendWhatsAppMessage(customer.phone, ai.suggestedReply);
    }
  }

  const hydrated = await getTicketById(ticket.id);
  emitHubEvent("ticket:updated", hydrated);

  return {
    ticket: hydrated ?? ticketAfterAi,
    suggestion: ai
  };
}

export const ticketInclude = {
  customer: true,
  assignedTo: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true
    }
  },
  messages: {
    orderBy: { createdAt: "asc" as const }
  },
  suggestions: {
    orderBy: { createdAt: "desc" as const },
    take: 1
  }
};

export async function getTicketById(id: string) {
  return prisma.ticket.findUnique({
    where: { id },
    include: ticketInclude
  });
}

async function upsertCustomer(input: CustomerInput): Promise<Customer> {
  const name = input.name?.trim() || "Cliente Claro";

  if (input.phone) {
    return prisma.customer.upsert({
      where: { phone: input.phone },
      update: {
        name,
        email: input.email,
        claroId: input.claroId
      },
      create: {
        name,
        phone: input.phone,
        email: input.email,
        claroId: input.claroId
      }
    });
  }

  return prisma.customer.create({
    data: {
      name,
      email: input.email,
      claroId: input.claroId
    }
  });
}

async function findOrCreateActiveTicket(customer: Customer, input: InboundInput): Promise<Ticket> {
  const active = await prisma.ticket.findFirst({
    where: {
      customerId: customer.id,
      channel: input.channel,
      status: { not: TicketStatus.CLOSED }
    },
    orderBy: { lastMessageAt: "desc" }
  });

  if (active) {
    return active;
  }

  return prisma.ticket.create({
    data: {
      protocol: `CLARO-${Date.now().toString(36).toUpperCase()}`,
      channel: input.channel,
      subject: input.subject ?? "Novo atendimento",
      externalRef: input.externalRef,
      customerId: customer.id
    }
  });
}

function titleFromIntent(intent: string) {
  const titles: Record<string, string> = {
    suporte_conectividade: "Suporte de conectividade",
    fatura_pagamento: "Fatura e pagamento",
    retencao_ou_reclamacao: "Retenção ou reclamação",
    atendimento_geral: "Atendimento geral"
  };

  return titles[intent] ?? intent.replaceAll("_", " ");
}
