import { API_BASE } from "@/config/api";

/** API origin without trailing /api — used for /uploads static files. */
export function uploadsOrigin(): string {
  return API_BASE.replace(/\/api\/?$/, "");
}

export function isStoredUserImagePath(raw: string): boolean {
  const s = raw.trim();
  return (
    s.startsWith("user-images/") ||
    s.startsWith("/uploads/user-images/") ||
    s.startsWith("uploads/user-images/")
  );
}

/** True when profile has a live/doc image (file path or legacy inline base64). */
export function hasUserImageData(raw: unknown): boolean {
  if (raw == null) return false;
  const s = String(raw).trim();
  if (!s || s === "permissions_granted") return false;
  if (isStoredUserImagePath(s)) return true;
  if (s.startsWith("data:image")) return true;
  if (s.startsWith("http://") || s.startsWith("https://")) return true;
  return s.length >= 40;
}

/** Resolve DB value (path or legacy base64) to a browser img src. */
export function proofImageSrc(raw: string | null | undefined): string | null {
  if (!raw || raw === "permissions_granted") return null;
  const s = String(raw).trim();
  if (!s) return null;

  if (s.startsWith("data:")) return s;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;

  if (s.startsWith("/uploads/")) return `${uploadsOrigin()}${s}`;
  if (s.startsWith("uploads/")) return `${uploadsOrigin()}/${s}`;
  if (s.startsWith("user-images/")) return `${uploadsOrigin()}/uploads/${s}`;

  if (s.length < 40) return null;
  return `data:image/jpeg;base64,${s}`;
}
