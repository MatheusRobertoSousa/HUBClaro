export type UserRole = "ADMIN" | "SUPERVISOR" | "AGENT";
export type Channel = "WHATSAPP" | "SITE" | "APP";
export type TicketStatus = "NEW" | "AI_TRIAGE" | "OPEN" | "PENDING" | "CLOSED";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type SenderType = "CUSTOMER" | "AI" | "AGENT" | "SYSTEM";

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export type Customer = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  claroId?: string | null;
};

export type Message = {
  id: string;
  ticketId: string;
  senderType: SenderType;
  body: string;
  authorUserId?: string | null;
  createdAt: string;
};

export type AiSuggestion = {
  id: string;
  ticketId: string;
  intent: string;
  sentiment: "positive" | "neutral" | "negative";
  confidence: number;
  suggestedReply: string;
  nextBestAction: string;
  createdAt: string;
};

export type Ticket = {
  id: string;
  protocol: string;
  channel: Channel;
  subject: string;
  summary?: string | null;
  status: TicketStatus;
  priority: Priority;
  aiConfidence?: number | null;
  tags?: string[] | null;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  customer: Customer;
  assignedTo?: User | null;
  messages: Message[];
  suggestions: AiSuggestion[];
};

export type Metrics = {
  totalOpen: number;
  aiTriaged: number;
  closed: number;
  urgent: number;
  byChannel: Array<{ channel: Channel; count: number }>;
};
