import type { Channel, Priority, TicketStatus } from "../types";

export const channelLabel: Record<Channel, string> = {
  WHATSAPP: "WhatsApp",
  SITE: "Site",
  APP: "App"
};

export const statusLabel: Record<TicketStatus, string> = {
  NEW: "Novo",
  AI_TRIAGE: "Triagem IA",
  OPEN: "Aberto",
  PENDING: "Pendente",
  CLOSED: "Fechado"
};

export const priorityLabel: Record<Priority, string> = {
  LOW: "Baixa",
  MEDIUM: "Media",
  HIGH: "Alta",
  URGENT: "Urgente"
};

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.at(0)?.toUpperCase())
    .join("");
}
