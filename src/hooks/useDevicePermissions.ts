import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Tracks the browser permission status for microphone + geolocation
 * and provides helpers to actively trigger the prompts.
 *
 * Returned status values:
 *   - "granted"  → ready, nothing to do
 *   - "prompt"   → the user has not been asked yet; calling the
 *                  corresponding requestX() will pop the browser dialog
 *   - "denied"   → user clicked Block.  The browser will NOT pop the
 *                  prompt again — they must reset it from the site
 *                  settings (lock icon in URL bar).
 *   - "unknown"  → we couldn't read the Permissions API, treat as prompt
 *   - "unsupported" → no microphone / no geolocation in this browser
 */
export type PermissionState = "granted" | "prompt" | "denied" | "unknown" | "unsupported";

export interface DevicePermissionsResult {
  mic: PermissionState;
  geo: PermissionState;
  bothGranted: boolean;
  checking: boolean;
  recheck: () => Promise<void>;
  requestMic: () => Promise<PermissionState>;
  requestGeo: () => Promise<PermissionState>;
}

/**
 * Reads navigator.permissions for a given name and normalises the
 * result.  Some browsers reject {name: "microphone"} so we fall back
 * to "unknown" silently — the UI will still let the user click Grant.
 */
async function readState(name: PermissionName): Promise<PermissionState> {
  try {
    if (!navigator.permissions || !navigator.permissions.query) return "unknown";
    const status = await navigator.permissions.query({ name } as any);
    if (status.state === "granted") return "granted";
    if (status.state === "denied") return "denied";
    return "prompt";
  } catch {
    return "unknown";
  }
}

export function useDevicePermissions(): DevicePermissionsResult {
  const [mic, setMic] = useState<PermissionState>("unknown");
  const [geo, setGeo] = useState<PermissionState>("unknown");
  const [checking, setChecking] = useState(true);

  // Hold status objects so we can attach onchange listeners.
  const micStatusRef = useRef<PermissionStatus | null>(null);
  const geoStatusRef = useRef<PermissionStatus | null>(null);

  const recheck = useCallback(async () => {
    setChecking(true);
    const hasMicApi = !!navigator.mediaDevices?.getUserMedia;
    const hasGeoApi = !!navigator.geolocation;

    if (!hasMicApi) setMic("unsupported");
    else setMic(await readState("microphone" as PermissionName));

    if (!hasGeoApi) setGeo("unsupported");
    else setGeo(await readState("geolocation" as PermissionName));

    setChecking(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const wire = async () => {
      try {
        if (navigator.permissions?.query) {
          try {
            const m = await navigator.permissions.query({ name: "microphone" as PermissionName });
            if (cancelled) return;
            micStatusRef.current = m;
            m.onchange = () => recheck();
          } catch { /* unsupported in this browser */ }
          try {
            const g = await navigator.permissions.query({ name: "geolocation" as PermissionName });
            if (cancelled) return;
            geoStatusRef.current = g;
            g.onchange = () => recheck();
          } catch { /* ignore */ }
        }
      } finally {
        if (!cancelled) await recheck();
      }
    };

    wire();
    return () => {
      cancelled = true;
      if (micStatusRef.current) micStatusRef.current.onchange = null;
      if (geoStatusRef.current) geoStatusRef.current.onchange = null;
    };
  }, [recheck]);

  const requestMic = useCallback(async (): Promise<PermissionState> => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMic("unsupported");
      return "unsupported";
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // We only need to know it works — close the tracks right away so
      // the browser tab indicator doesn't stay on.
      stream.getTracks().forEach((t) => t.stop());
      setMic("granted");
      return "granted";
    } catch (err: any) {
      const name = String(err?.name || "");
      if (name === "NotAllowedError" || name === "SecurityError") {
        setMic("denied");
        return "denied";
      }
      setMic("unknown");
      return "unknown";
    }
  }, []);

  const requestGeo = useCallback(async (): Promise<PermissionState> => {
    if (!navigator.geolocation) {
      setGeo("unsupported");
      return "unsupported";
    }
    return new Promise<PermissionState>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => {
          setGeo("granted");
          resolve("granted");
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            setGeo("denied");
            resolve("denied");
          } else {
            // POSITION_UNAVAILABLE or TIMEOUT — permission may still be
            // granted, just couldn't get coords.  Re-check from the
            // Permissions API as the source of truth.
            readState("geolocation" as PermissionName).then((s) => {
              setGeo(s);
              resolve(s);
            });
          }
        },
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
      );
    });
  }, []);

  return {
    mic,
    geo,
    bothGranted: mic === "granted" && geo === "granted",
    checking,
    recheck,
    requestMic,
    requestGeo,
  };
}
