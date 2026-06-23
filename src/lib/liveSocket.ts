import { io, type Socket } from "socket.io-client";
import { LIVE_SOCKET_URL } from "@/config/api";

let socket: Socket | null = null;

/** Shared Socket.IO client — connects to your API backend, not the external MT5 feed. */
export function getLiveSocket(): Socket {
  if (!socket) {
    socket = io(LIVE_SOCKET_URL, {
      // Polling first — required when nginx/Cloudflare proxy Socket.IO
      transports: ["polling", "websocket"],
      path: "/socket.io",
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
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

/** Subscribe to backend live P/L ticks (returns unsubscribe). */
export function onLiveTick(handler: (payload: LiveTickPayload) => void): () => void {
  const s = getLiveSocket();
  const wrapped = (payload: LiveTickPayload) => handler(payload);
  s.on("live:tick", wrapped);
  return () => {
    s.off("live:tick", wrapped);
  };
}

export function onLiveTrade(handler: (trade: Record<string, unknown>) => void): () => void {
  const s = getLiveSocket();
  const wrapped = (trade: Record<string, unknown>) => handler(trade);
  s.on("live:trade", wrapped);
  return () => {
    s.off("live:trade", wrapped);
  };
}

export function onLiveMetrics(handler: (metrics: LiveMetricsPayload) => void): () => void {
  const s = getLiveSocket();
  const wrapped = (metrics: LiveMetricsPayload) => handler(metrics);
  s.on("live:metrics", wrapped);
  return () => {
    s.off("live:metrics", wrapped);
  };
}

export function onLiveSocketConnect(handler: () => void): () => void {
  const s = getLiveSocket();
  s.on("connect", handler);
  return () => {
    s.off("connect", handler);
  };
}

export function onLiveSocketDisconnect(handler: () => void): () => void {
  const s = getLiveSocket();
  s.on("disconnect", handler);
  return () => {
    s.off("disconnect", handler);
  };
}
