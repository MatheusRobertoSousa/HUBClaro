import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { env } from "./lib/env.js";
import { authRouter } from "./routes/auth.js";
import { healthRouter } from "./routes/health.js";
import { integrationsRouter } from "./routes/integrations.js";
import { ticketsRouter } from "./routes/tickets.js";
import { errorHandler } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        const normalizedOrigin = origin?.replace(/\/$/, "");
        callback(null, !normalizedOrigin || env.clientUrls.includes(normalizedOrigin));
      },
      credentials: true
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(morgan("dev"));

  app.use("/api/health", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/tickets", ticketsRouter);
  app.use("/api/integrations", integrationsRouter);

  const webRoot = fileURLToPath(new URL("../../../web/dist/", import.meta.url));
  if (existsSync(path.join(webRoot, "index.html"))) {
    app.use(express.static(webRoot));
    app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
      res.sendFile(path.join(webRoot, "index.html"));
    });
  }

  app.get("/", (_req, res) => {
    res.json({
      service: "Claro HUB AI API",
      health: "/api/health",
      documentation: "/api/health/architecture"
    });
  });

  app.use(errorHandler);

  return app;
}
