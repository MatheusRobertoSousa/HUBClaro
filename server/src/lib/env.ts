import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT ?? 3333),
  clientUrls: (process.env.CLIENT_URL ?? "http://localhost:5173")
    .split(",")
    .map((url) => url.trim().replace(/\/$/, ""))
    .filter(Boolean),
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseProvider: process.env.DATABASE_PROVIDER ?? "sqlite",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
  aiAutoReplyThreshold: Number(process.env.AI_AUTO_REPLY_THRESHOLD ?? 0.82),
  whatsappApiVersion: process.env.WHATSAPP_API_VERSION ?? "v22.0",
  whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? "claro_hub_verify",
  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? "",
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
  whatsappTestPhone: process.env.WHATSAPP_TEST_PHONE ?? "5511977854607",
  claroBrandName: process.env.CLARO_BRAND_NAME ?? "Claro"
};
