import http from "node:http";
import { Server } from "socket.io";
import { createApp } from "./app.js";
import { env } from "./lib/env.js";
import { attachRealtime } from "./lib/realtime.js";

const app = createApp();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: env.clientUrl,
    credentials: true
  }
});

attachRealtime(io);

io.on("connection", (socket) => {
  socket.emit("hub:connected", { socketId: socket.id });
});

server.listen(env.port, () => {
  console.log(`Claro HUB AI API em http://localhost:${env.port}`);
});
