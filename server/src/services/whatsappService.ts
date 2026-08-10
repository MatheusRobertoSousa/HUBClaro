import { env } from "../lib/env.js";

export type WhatsAppMessagePayload = {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      value?: {
        contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
        messages?: Array<{
          id: string;
          from: string;
          timestamp?: string;
          type: string;
          text?: { body?: string };
        }>;
      };
    }>;
  }>;
};

export function extractWhatsAppTextMessages(payload: WhatsAppMessagePayload) {
  const items: Array<{ id: string; from: string; name?: string; body: string }> = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const contactsByPhone = new Map((value?.contacts ?? []).map((contact) => [contact.wa_id, contact.profile?.name]));

      for (const message of value?.messages ?? []) {
        if (message.type !== "text" || !message.text?.body) {
          continue;
        }

        items.push({
          id: message.id,
          from: message.from,
          name: contactsByPhone.get(message.from),
          body: message.text.body
        });
      }
    }
  }

  return items;
}

export async function sendWhatsAppMessage(to: string, text: string) {
  const normalizedTo = normalizeBrazilianPhone(to);

  if (!env.whatsappAccessToken || !env.whatsappPhoneNumberId) {
    console.info(`[WhatsApp simulado] Para ${normalizedTo}: ${text}`);
    return { simulated: true, to: normalizedTo };
  }

  const response = await fetch(
    `https://graph.facebook.com/${env.whatsappApiVersion}/${env.whatsappPhoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.whatsappAccessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: normalizedTo,
        type: "text",
        text: {
          preview_url: false,
          body: text
        }
      })
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Falha ao enviar WhatsApp ${response.status}: ${body}`);
  }

  return response.json();
}

export async function sendWhatsAppTemplate(to: string, templateName = "hello_world", languageCode = "en_US") {
  const normalizedTo = normalizeBrazilianPhone(to);

  if (!env.whatsappAccessToken || !env.whatsappPhoneNumberId) {
    console.info(`[WhatsApp template simulado] Para ${normalizedTo}: ${templateName}/${languageCode}`);
    return { simulated: true, to: normalizedTo, templateName, languageCode };
  }

  const response = await fetch(
    `https://graph.facebook.com/${env.whatsappApiVersion}/${env.whatsappPhoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.whatsappAccessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: normalizedTo,
        type: "template",
        template: {
          name: templateName,
          language: {
            code: languageCode
          }
        }
      })
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Falha ao enviar template WhatsApp ${response.status}: ${body}`);
  }

  return response.json();
}

export function getWhatsAppConfiguration() {
  return {
    configured: Boolean(env.whatsappAccessToken && env.whatsappPhoneNumberId),
    hasAccessToken: Boolean(env.whatsappAccessToken),
    hasPhoneNumberId: Boolean(env.whatsappPhoneNumberId),
    phoneNumberIdLast4: env.whatsappPhoneNumberId ? env.whatsappPhoneNumberId.slice(-4) : null,
    testPhone: normalizeBrazilianPhone(env.whatsappTestPhone)
  };
}

export function normalizeBrazilianPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55")) {
    return digits;
  }
  if (digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}
