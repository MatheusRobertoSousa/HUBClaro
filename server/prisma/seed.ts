import bcrypt from "bcryptjs";
import { Channel, Priority, SenderType, TicketStatus, UserRole } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";

async function main() {
  const password = process.env.SEED_PASSWORD ?? (process.env.NODE_ENV === "production" ? "" : "Claro@123");
  if (password.length < 8) throw new Error("Configure SEED_PASSWORD com pelo menos 8 caracteres.");
  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@claro.com.br" },
    update: {},
    create: {
      name: "Admin Claro",
      email: "admin@claro.com.br",
      passwordHash,
      role: UserRole.ADMIN
    }
  });

  const agent = await prisma.user.upsert({
    where: { email: "atendente@claro.com.br" },
    update: {},
    create: {
      name: "Atendente N1",
      email: "atendente@claro.com.br",
      passwordHash,
      role: UserRole.AGENT
    }
  });

  const customer = await prisma.customer.upsert({
    where: { phone: "5511999990000" },
    update: {},
    create: {
      name: "Cliente Demonstração",
      phone: "5511999990000",
      email: "cliente.demo@email.com",
      claroId: "CLARO-001"
    }
  });

  const existing = await prisma.ticket.findFirst({
    where: { customerId: customer.id, subject: "Instabilidade no app Minha Claro" }
  });

  if (!existing) {
    const ticket = await prisma.ticket.create({
      data: {
        protocol: `CLARO-${Date.now()}`,
        channel: Channel.APP,
        subject: "Instabilidade no app Minha Claro",
        summary: "Cliente relata falha ao consultar segunda via de fatura.",
        status: TicketStatus.OPEN,
        priority: Priority.HIGH,
        aiConfidence: 0.74,
        tags: JSON.stringify(["fatura", "app", "segunda-via"]),
        customerId: customer.id,
        assignedToId: agent.id
      }
    });

    await prisma.message.createMany({
      data: [
        {
          ticketId: ticket.id,
          senderType: SenderType.CUSTOMER,
          body: "Não consigo abrir a segunda via da minha fatura pelo app."
        },
        {
          ticketId: ticket.id,
          senderType: SenderType.AI,
          body: "Entendi. Vou verificar o acesso ao app e orientar a emissão por canais alternativos enquanto resolvemos."
        },
        {
          ticketId: ticket.id,
          senderType: SenderType.SYSTEM,
          body: `Chamado atribuído para ${agent.name}.`,
          authorUserId: admin.id
        }
      ]
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
