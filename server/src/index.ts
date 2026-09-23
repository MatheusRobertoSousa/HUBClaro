import http from "node:http";
import { Server } from "socket.io";
import { createApp } from "./app.js";
import { env } from "./lib/env.js";
import { attachRealtime } from "./lib/realtime.js";
import jwt from "jsonwebtoken";
import { prisma } from "./lib/prisma.js";

const app = createApp();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: env.clientUrls,
    credentials: true
  }
});

attachRealtime(io);

io.use(async (socket, next) => {
  try {
    const payload = jwt.verify(socket.handshake.auth.token, env.jwtSecret);
    if (typeof payload === "string" || !payload.sub) throw new Error("Invalid token");
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true } });
    if (!user) throw new Error("Invalid user");
    next();
  } catch {
    next(new Error("Sessao invalida."));
  }
});

io.on("connection", (socket) => {
  socket.emit("hub:connected", { socketId: socket.id });
});

server.listen(env.port, () => {
  console.log(`Claro HUB AI API em http://localhost:${env.port}`);
});
