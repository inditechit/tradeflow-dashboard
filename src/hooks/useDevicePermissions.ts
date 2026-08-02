import { useCallback, useEffect, useRef, useState } from "react";
import {
  type PermissionState,
  readPermissionState,
  rememberPermissionDenied,
  rememberPermissionGranted,
  resolvePermissionState,
} from "@/utils/devicePermissions";

export type { PermissionState };

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
export interface DevicePermissionsResult {
  mic: PermissionState;
  geo: PermissionState;
  bothGranted: boolean;
  checking: boolean;
  recheck: () => Promise<void>;
  requestMic: () => Promise<PermissionState>;
  requestGeo: () => Promise<PermissionState>;
}

export function useDevicePermissions(): DevicePermissionsResult {
  const [mic, setMic] = useState<PermissionState>("unknown");
  const [geo, setGeo] = useState<PermissionState>("unknown");
  const [checking, setChecking] = useState(true);

  const micStatusRef = useRef<PermissionStatus | null>(null);
  const geoStatusRef = useRef<PermissionStatus | null>(null);

  const recheck = useCallback(async () => {
    setChecking(true);
    const hasMicApi = !!navigator.mediaDevices?.getUserMedia;
    const hasGeoApi = !!navigator.geolocation;

    if (!hasMicApi) setMic("unsupported");
    else setMic(await resolvePermissionState("microphone", "mic"));

    if (!hasGeoApi) setGeo("unsupported");
    else setGeo(await resolvePermissionState("geolocation", "geo"));

    setChecking(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const wire = async () => {
      try {
        if (navigator.permissions?.query) {
          try {
            const m = await navigator.permissions.query({
              name: "microphone" as PermissionName,
            });
            if (cancelled) return;
            micStatusRef.current = m;
            m.onchange = () => {
              void recheck();
            };
          } catch {
            /* unsupported in this browser */
          }
          try {
            const g = await navigator.permissions.query({
              name: "geolocation" as PermissionName,
            });
            if (cancelled) return;
            geoStatusRef.current = g;
            g.onchange = () => {
              void recheck();
            };
          } catch {
            /* ignore */
          }
        }
      } finally {
        if (!cancelled) await recheck();
      }
    };

    void wire();
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

    // Already granted — do not re-prompt; just confirm.
    const existing = await resolvePermissionState("microphone", "mic");
    if (existing === "granted") {
      setMic("granted");
      return "granted";
    }
    if (existing === "denied") {
      setMic("denied");
      return "denied";
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      rememberPermissionGranted("mic");
      setMic("granted");
      return "granted";
    } catch (err: unknown) {
      const name = String((err as { name?: string })?.name || "");
      if (name === "NotAllowedError" || name === "SecurityError") {
        rememberPermissionDenied("mic");
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

    const existing = await resolvePermissionState("geolocation", "geo");
    if (existing === "denied") {
      setGeo("denied");
      return "denied";
    }

    // If already granted, still read coords (no dialog) using a cached age.
    return new Promise<PermissionState>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => {
          rememberPermissionGranted("geo");
          setGeo("granted");
          resolve("granted");
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            rememberPermissionDenied("geo");
            setGeo("denied");
            resolve("denied");
          } else {
            // Position unavailable/timeout — permission may still be OK.
            void readPermissionState("geolocation").then((s) => {
              if (s === "granted" || existing === "granted") {
                rememberPermissionGranted("geo");
                setGeo("granted");
                resolve("granted");
                return;
              }
              setGeo(s);
              resolve(s);
            });
          }
        },
        {
          enableHighAccuracy: false,
          timeout: existing === "granted" ? 5_000 : 10_000,
          maximumAge: existing === "granted" ? 600_000 : 60_000,
        },
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
