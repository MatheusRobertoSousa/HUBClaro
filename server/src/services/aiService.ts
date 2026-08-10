import type { Message, Ticket } from "@prisma/client";
import { env } from "../lib/env.js";

export type AiContext = {
  ticket: Ticket;
  messages: Message[];
  latestMessage: string;
};

export type AiResult = {
  intent: string;
  sentiment: "positive" | "neutral" | "negative";
  confidence: number;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  summary: string;
  suggestedReply: string;
  nextBestAction: string;
  tags: string[];
  shouldAutoReply: boolean;
  provider: "openai" | "local-fallback";
  providerError?: string;
};

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    intent: { type: "string" },
    sentiment: { enum: ["positive", "neutral", "negative"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    priority: { enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] },
    summary: { type: "string" },
    suggestedReply: { type: "string" },
    nextBestAction: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
    shouldAutoReply: { type: "boolean" }
  },
  required: [
    "intent",
    "sentiment",
    "confidence",
    "priority",
    "summary",
    "suggestedReply",
    "nextBestAction",
    "tags",
    "shouldAutoReply"
  ]
};

export async function generateAiSuggestion(context: AiContext): Promise<AiResult> {
  if (env.openAiApiKey) {
    try {
      const result = await generateWithOpenAi(context);
      return { ...result, provider: "openai" };
    } catch (error) {
      console.error("Falha ao chamar provedor de IA. Usando fallback local.", error);
      const fallback = generateLocalSuggestion(context.latestMessage);
      return {
        ...fallback,
        provider: "local-fallback",
        providerError: getSafeProviderError(error)
      };
    }
  }

  return generateLocalSuggestion(context.latestMessage);
}

export function getAiConfiguration() {
  return {
    configured: Boolean(env.openAiApiKey),
    model: env.openAiModel,
    autoReplyThreshold: env.aiAutoReplyThreshold
  };
}

async function generateWithOpenAi(context: AiContext): Promise<AiResult> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openAiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: env.openAiModel,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "Voce e a IA operacional da Claro para triagem de chamados. " +
                "Classifique a solicitacao, resuma o problema, proponha uma resposta curta em portugues do Brasil, " +
                "indique a proxima acao para o atendente e seja conservador quando houver dados sensiveis, cancelamento, contestacao financeira ou risco de churn."
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                protocol: context.ticket.protocol,
                channel: context.ticket.channel,
                currentStatus: context.ticket.status,
                latestMessage: context.latestMessage,
                recentMessages: context.messages.slice(-8).map((message) => ({
                  senderType: message.senderType,
                  body: message.body,
                  createdAt: message.createdAt
                }))
              })
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "claro_ticket_triage",
          strict: true,
          schema
        }
      }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI ${response.status}: ${body}`);
  }

  const data = (await response.json()) as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
  const rawText = data.output_text ?? data.output?.flatMap((item) => item.content ?? []).map((content) => content.text ?? "").join("") ?? "";
  const parsed = JSON.parse(rawText) as AiResult;

  return {
    ...parsed,
    shouldAutoReply: parsed.shouldAutoReply && parsed.confidence >= env.aiAutoReplyThreshold
  };
}

function generateLocalSuggestion(message: string): AiResult {
  const normalized = message.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

  const has = (...terms: string[]) => terms.some((term) => normalized.includes(term));

  if (has("sem internet", "internet caiu", "wifi", "fibra", "sinal")) {
    return buildFallback({
      intent: "suporte_conectividade",
      priority: has("empresa", "trabalho", "urgente") ? "HIGH" : "MEDIUM",
      summary: "Cliente relata indisponibilidade ou instabilidade de internet.",
      suggestedReply:
        "Sinto muito pela instabilidade. Vou verificar o status da rede na sua região e, se necessário, direcionar para suporte técnico.",
      nextBestAction: "Verificar diagnóstico de rede, contrato e disponibilidade local antes de acionar suporte técnico.",
      tags: ["internet", "suporte", "rede"]
    });
  }

  if (has("fatura", "boleto", "segunda via", "2 via", "cobranca", "pagar")) {
    return buildFallback({
      intent: "fatura_pagamento",
      priority: has("negativado", "corte", "bloqueado") ? "HIGH" : "MEDIUM",
      summary: "Cliente precisa de apoio com fatura, boleto ou cobrança.",
      suggestedReply:
        "Posso ajudar com a fatura. Vou localizar seu contrato e validar a melhor opção para segunda via, pagamento ou contestação.",
      nextBestAction: "Consultar cadastro, status financeiro e elegibilidade para emissão de segunda via.",
      tags: ["fatura", "financeiro"]
    });
  }

  if (has("cancelar", "portabilidade", "reclamar", "procon", "anatel")) {
    return buildFallback({
      intent: "retencao_ou_reclamacao",
      priority: "URGENT",
      summary: "Cliente indica cancelamento, portabilidade ou escalonamento regulatório.",
      suggestedReply:
        "Entendi a sua solicitação. Vou priorizar seu atendimento e encaminhar para um especialista analisar o caso com cuidado.",
      nextBestAction: "Escalar para fila de retenção ou supervisor antes de responder conclusivamente.",
      tags: ["retencao", "reclamacao", "prioridade"]
    });
  }

  return buildFallback({
    intent: "atendimento_geral",
    priority: "MEDIUM",
    summary: "Cliente abriu uma solicitação geral que precisa de validação do atendente.",
    suggestedReply:
      "Recebi sua solicitação. Vou analisar as informações e seguir com o atendimento pelo melhor caminho.",
    nextBestAction: "Revisar histórico do cliente, classificar motivo principal e responder no canal de origem.",
    tags: ["geral"]
  });
}

function buildFallback(input: Omit<AiResult, "sentiment" | "confidence" | "shouldAutoReply" | "provider" | "providerError">): AiResult {
  return {
    ...input,
    sentiment: input.priority === "URGENT" ? "negative" : "neutral",
    confidence: input.priority === "URGENT" ? 0.68 : 0.72,
    shouldAutoReply: false,
    provider: "local-fallback"
  };
}

function getSafeProviderError(error: unknown) {
  if (!(error instanceof Error)) {
    return "Falha desconhecida no provedor de IA.";
  }

  if (error.message.includes("credit_balance_exhausted") || error.message.includes("insufficient_quota")) {
    return "A chave OpenAI respondeu, mas a conta está sem créditos disponíveis.";
  }

  return error.message.replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]");
}
