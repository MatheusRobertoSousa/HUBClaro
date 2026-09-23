import { useEffect } from "react";
import { io } from "socket.io-client";
import { getApiUrl, getToken } from "../lib/api";
import type { Ticket } from "../types";

export function useHubSocket(onTicketUpdated: (ticket: Ticket) => void) {
  useEffect(() => {
    const socket = io(getApiUrl(), {
      transports: ["websocket", "polling"],
      auth: { token: getToken() }
    });

    socket.on("ticket:updated", onTicketUpdated);

    return () => {
      socket.disconnect();
    };
  }, [onTicketUpdated]);
}
