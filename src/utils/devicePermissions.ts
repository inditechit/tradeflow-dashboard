/**
 * Browser permission helpers: read status first, only prompt when needed.
 */

export type PermissionState =
  | "granted"
  | "prompt"
  | "denied"
  | "unknown"
  | "unsupported";

const STORAGE_MIC = "tf_perm_mic";
const STORAGE_GEO = "tf_perm_geo";
const STORAGE_CAMERA = "tf_perm_camera";

type StoredKind = "mic" | "geo" | "camera";

function storageKey(kind: StoredKind): string {
  if (kind === "mic") return STORAGE_MIC;
  if (kind === "geo") return STORAGE_GEO;
  return STORAGE_CAMERA;
}

export function rememberPermissionGranted(kind: StoredKind): void {
  try {
    localStorage.setItem(storageKey(kind), "granted");
  } catch {
    /* ignore */
  }
}

export function rememberPermissionDenied(kind: StoredKind): void {
  try {
    localStorage.setItem(storageKey(kind), "denied");
  } catch {
    /* ignore */
  }
}

export function clearRememberedPermission(kind: StoredKind): void {
  try {
    localStorage.removeItem(storageKey(kind));
  } catch {
    /* ignore */
  }
}

export function getRememberedPermission(kind: StoredKind): PermissionState | null {
  try {
    const v = localStorage.getItem(storageKey(kind));
    if (v === "granted") return "granted";
    if (v === "denied") return "denied";
  } catch {
    /* ignore */
  }
  return null;
}

/** Query Permissions API without prompting the user. */
export async function readPermissionState(
  name: "geolocation" | "microphone" | "camera",
): Promise<PermissionState> {
  try {
    if (!navigator.permissions?.query) return "unknown";
    const status = await navigator.permissions.query({ name } as PermissionName);
    if (status.state === "granted") return "granted";
    if (status.state === "denied") return "denied";
    return "prompt";
  } catch {
    return "unknown";
  }
}

/**
 * Effective status: live Permissions API wins; if the API is unavailable
 * ("unknown"), fall back to what we remembered from a prior successful grant.
 */
export async function resolvePermissionState(
  name: "geolocation" | "microphone" | "camera",
  kind: StoredKind,
): Promise<PermissionState> {
  const live = await readPermissionState(name);
  if (live === "granted") {
    rememberPermissionGranted(kind);
    return "granted";
  }
  if (live === "denied") {
    rememberPermissionDenied(kind);
    return "denied";
  }
  if (live === "prompt") return "prompt";

  const remembered = getRememberedPermission(kind);
  if (remembered === "granted") return "granted";
  if (remembered === "denied") return "denied";
  return "unknown";
}

export type GeoPositionResult =
  | { ok: true; lat: number; lng: number }
  | { ok: false; reason: "unsupported" | "denied" | "unavailable" };

/**
 * Reads location only when permission is already granted, or when
 * `allowPrompt` is true and the user has not decided yet.
 * Never prompts if permission is denied or already remembered as granted
 * without needing a fresh browser dialog (uses cached coords when possible).
 */
export function getGeolocationIfAllowed(opts?: {
  /** When false (default), skip if status is still "prompt" / "unknown". */
  allowPrompt?: boolean;
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}): Promise<GeoPositionResult> {
  const allowPrompt = opts?.allowPrompt === true;
  const enableHighAccuracy = opts?.enableHighAccuracy ?? false;
  const timeout = opts?.timeout ?? 10_000;
  const maximumAge = opts?.maximumAge ?? 300_000;

  return (async () => {
    if (!navigator.geolocation) {
      return { ok: false, reason: "unsupported" };
    }

    const state = await resolvePermissionState("geolocation", "geo");
    if (state === "denied") {
      return { ok: false, reason: "denied" };
    }
    if ((state === "prompt" || state === "unknown") && !allowPrompt) {
      return { ok: false, reason: "unavailable" };
    }

    return new Promise<GeoPositionResult>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          rememberPermissionGranted("geo");
          resolve({
            ok: true,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            rememberPermissionDenied("geo");
            resolve({ ok: false, reason: "denied" });
          } else {
            resolve({ ok: false, reason: "unavailable" });
          }
        },
        { enableHighAccuracy, timeout, maximumAge },
      );
    });
  })();
}
