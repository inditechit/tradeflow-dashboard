const apiBase = import.meta.env.VITE_API_BASE_URL;
const socketBase = import.meta.env.VITE_SOCKET_URL;
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export const API_BASE = apiBase || "https://api.copytradeengine.org/api";
export const SOCKET_URL = socketBase || "https://astroapi.inditechit.com";
export const GOOGLE_CLIENT_ID = googleClientId || "";
