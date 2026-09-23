CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'SUPERVISOR', 'AGENT');
CREATE TYPE "Channel" AS ENUM ('WHATSAPP', 'SITE', 'APP');
CREATE TYPE "TicketStatus" AS ENUM ('NEW', 'AI_TRIAGE', 'OPEN', 'PENDING', 'CLOSED');
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "SenderType" AS ENUM ('CUSTOMER', 'AI', 'AGENT', 'SYSTEM');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'AGENT',
  "avatarUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Customer" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "claroId" TEXT,
  "cpfCnpj" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Ticket" (
  "id" TEXT NOT NULL,
  "protocol" TEXT NOT NULL,
  "channel" "Channel" NOT NULL,
  "subject" TEXT NOT NULL,
  "summary" TEXT,
  "status" "TicketStatus" NOT NULL DEFAULT 'NEW',
  "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
  "aiConfidence" DOUBLE PRECISION,
  "tags" TEXT,
  "externalRef" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "customerId" TEXT NOT NULL,
  "assignedToId" TEXT,
  CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Message" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "senderType" "SenderType" NOT NULL,
  "body" TEXT NOT NULL,
  "metadata" TEXT,
  "authorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiSuggestion" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "intent" TEXT NOT NULL,
  "sentiment" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "suggestedReply" TEXT NOT NULL,
  "nextBestAction" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiSuggestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntegrationEvent" (
  "id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "externalId" TEXT,
  "payload" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntegrationEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");
CREATE UNIQUE INDEX "Ticket_protocol_key" ON "Ticket"("protocol");
CREATE INDEX "Ticket_status_channel_idx" ON "Ticket"("status", "channel");
CREATE INDEX "Ticket_lastMessageAt_idx" ON "Ticket"("lastMessageAt");
CREATE INDEX "Message_ticketId_createdAt_idx" ON "Message"("ticketId", "createdAt");
CREATE INDEX "IntegrationEvent_source_eventType_idx" ON "IntegrationEvent"("source", "eventType");

ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiSuggestion" ADD CONSTRAINT "AiSuggestion_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
