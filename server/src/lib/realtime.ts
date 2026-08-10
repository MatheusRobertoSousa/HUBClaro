import type { Server } from "socket.io";

let io: Server | null = null;

export function attachRealtime(server: Server) {
  io = server;
}

export function emitHubEvent(event: string, payload: unknown) {
  io?.emit(event, payload);
}
