import type { Channel, Metrics, Ticket, TicketStatus, User } from "../types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";
const TOKEN_KEY = "claro_hub_ai_token";

export type Session = {
  token: string;
  user: User;
};

export function getApiUrl() {
  return API_URL;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? "Falha ao comunicar com a API.");
  }

  return response.json() as Promise<T>;
}

export async function login(email: string, password: string) {
  const session = await request<Session>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  setToken(session.token);
  return session;
}

export async function me() {
  return request<{ user: User }>("/api/auth/me");
}

export async function listTickets(filters: { status?: TicketStatus | "ALL"; channel?: Channel | "ALL"; q?: string }) {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== "ALL") params.set("status", filters.status);
  if (filters.channel && filters.channel !== "ALL") params.set("channel", filters.channel);
  if (filters.q) params.set("q", filters.q);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return request<{ tickets: Ticket[] }>(`/api/tickets${suffix}`);
}

export async function getMetrics() {
  return request<Metrics>("/api/tickets/metrics/summary");
}

export async function getTicket(id: string) {
  return request<{ ticket: Ticket }>(`/api/tickets/${id}`);
}

export async function sendMessage(ticketId: string, body: string) {
  return request<{ ticket: Ticket }>(`/api/tickets/${ticketId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body, sendToChannel: true })
  });
}

export async function updateStatus(ticketId: string, status: TicketStatus) {
  return request<{ ticket: Ticket }>(`/api/tickets/${ticketId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
}

export async function assignToMe(ticketId: string, userId: string | null) {
  return request<{ ticket: Ticket }>(`/api/tickets/${ticketId}/assign`, {
    method: "POST",
    body: JSON.stringify({ userId })
  });
}

export async function generateReply(ticketId: string) {
  return request<{ ticket: Ticket }>(`/api/tickets/${ticketId}/ai/reply`, {
    method: "POST"
  });
}

export async function getIntegrationStatus() {
  return request<{
    ai: {
      configured: boolean;
      model: string;
      autoReplyThreshold: number;
    };
    whatsapp: {
      configured: boolean;
      hasAccessToken: boolean;
      hasPhoneNumberId: boolean;
      phoneNumberIdLast4: string | null;
      testPhone: string;
    };
    webhookUrl: string;
  }>("/api/integrations/status");
}

export async function testAi(message: string) {
  return request<{
    provider: string;
    providerError?: string;
    result: {
      intent: string;
      sentiment: string;
      confidence: number;
      priority: string;
      summary: string;
      suggestedReply: string;
      nextBestAction: string;
      tags: string[];
      shouldAutoReply: boolean;
      provider: string;
      providerError?: string;
    };
  }>("/api/integrations/ai/test", {
    method: "POST",
    body: JSON.stringify({ message })
  });
}

export async function testWhatsApp(to: string, message: string) {
  return request<{ ok: boolean; acceptedByMeta: boolean; messageId: string | null; result: unknown; whatsapp: { testPhone: string } }>("/api/integrations/whatsapp/test-send", {
    method: "POST",
    body: JSON.stringify({ to, message })
  });
}

export async function testWhatsAppTemplate(to: string, templateName = "hello_world", languageCode = "en_US") {
  return request<{ ok: boolean; acceptedByMeta: boolean; messageId: string | null; result: unknown; whatsapp: { testPhone: string } }>("/api/integrations/whatsapp/test-template", {
    method: "POST",
    body: JSON.stringify({ to, templateName, languageCode })
  });
}

export async function getWhatsAppEvents() {
  return request<{
    events: Array<{
      id: string;
      source: string;
      eventType: string;
      externalId: string | null;
      payload: string;
      createdAt: string;
      processedAt: string | null;
    }>;
  }>("/api/integrations/whatsapp/events");
}
