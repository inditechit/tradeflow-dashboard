const apiBase = import.meta.env.VITE_API_BASE_URL;
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export const API_BASE = apiBase || "https://api.copytradeengine.org/api";

/** Backend Socket.IO URL for live P/L (defaults to API host without /api). */
export const LIVE_SOCKET_URL =
  import.meta.env.VITE_LIVE_SOCKET_URL ||
  API_BASE.replace(/\/api\/?$/, "");

export const GOOGLE_CLIENT_ID = googleClientId || "";
