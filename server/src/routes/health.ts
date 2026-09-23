import { Router } from "express";
import { env } from "../lib/env.js";
import { prisma } from "../lib/prisma.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      ok: true,
      service: "claro-hub-ai",
      environment: env.nodeEnv,
      database: env.databaseProvider,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

healthRouter.get("/architecture", (_req, res) => {
  res.json({
    frontend: "React + Vite + TypeScript / arquivos estaticos no Azure App Service",
    backend: "Node.js + Express + TypeScript + Prisma / Azure App Service",
    database: `${env.databaseProvider} / Prisma ORM`,
    realtime: "Socket.IO sobre WebSocket",
    flow: ["Browser", "REST/HTTPS ou WebSocket", "Express API", "Prisma ORM", "Banco relacional"]
  });
});
