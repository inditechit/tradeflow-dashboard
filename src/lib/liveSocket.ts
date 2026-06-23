import { io, type Socket } from "socket.io-client";
import { LIVE_SOCKET_URL } from "@/config/api";

let socket: Socket | null = null;

/** Shared Socket.IO client — connects to your API backend, not the external MT5 feed. */
export function getLiveSocket(): Socket {
  if (!socket) {
    socket = io(LIVE_SOCKET_URL, {
      transports: ["websocket"],
      path: "/socket.io",
      autoConnect: true,
    });
  }
  return socket;
}

export type LiveTickPayload = {
  ticket?: string | number;
  profit?: number;
};

export type LiveMetricsPayload = {
  balance?: number;
  equity?: number;
  margin?: number;
  free_margin?: number;
  margin_level?: number;
  updated_at?: string;
};
