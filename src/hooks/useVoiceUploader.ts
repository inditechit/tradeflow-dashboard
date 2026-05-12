import { useEffect, useRef, useState } from "react";

/**
 * Background hook that polls "is admin listening to me?" every few
 * seconds and, while the answer is yes, captures the user's mic with
 * MediaRecorder and uploads short WebM/Opus chunks to the backend.
 *
 * The mic is **closed** the moment the admin stops listening, so the
 * red recording indicator in the browser tab also disappears.
 *
 * Pre-conditions enforced by the caller (UserLayout):
 *   - user is logged in
 *   - voice consent has been granted in DB
 */
export type VoiceState = "off" | "starting" | "live" | "denied" | "error";

export interface UseVoiceUploaderResult {
  state: VoiceState;
  listening: boolean;
  sessionId: string | null;
  errorMessage: string | null;
}

const POLL_MS = 5_000;
const CHUNK_MS = 3_000;

export function useVoiceUploader(
  userId: string | number | null | undefined,
  apiBase: string,
  enabled: boolean,
): UseVoiceUploaderResult {
  const [state, setState] = useState<VoiceState>("off");
  const [listening, setListening] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const activeSessionRef = useRef<string | null>(null);
  const stopGuardRef = useRef(false);

  useEffect(() => {
    if (!enabled || !userId) {
      // Hook disabled — make absolutely sure mic is closed.
      stopRecording();
      setState("off");
      setListening(false);
      setSessionId(null);
      return;
    }

    const idNum = Number(userId);
    if (!Number.isFinite(idNum) || idNum <= 0) return;

    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`${apiBase}/voice/is-listening/${idNum}`);
        const data = await res.json();
        if (!data?.success) return;

        if (data.listening && data.sessionId) {
          setListening(true);
          setSessionId(data.sessionId);
          if (activeSessionRef.current !== data.sessionId) {
            // Brand new admin session — restart recorder so the WebM
            // file starts with a fresh header.
            stopRecording();
            await startRecording(idNum, data.sessionId);
          }
        } else {
          setListening(false);
          setSessionId(null);
          if (activeSessionRef.current) {
            stopRecording();
          }
          if (state !== "denied" && state !== "error") setState("off");
        }
      } catch {
        // network blip — ignore, next tick will retry
      }
    };

    const startRecording = async (uid: number, sid: string) => {
      if (stopGuardRef.current) return;
      setState("starting");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        streamRef.current = stream;

        // Pick the most widely supported Opus container.
        const mime =
          MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
            ? "audio/webm;codecs=opus"
            : MediaRecorder.isTypeSupported("audio/webm")
              ? "audio/webm"
              : "";
        const rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 24_000 } : undefined);
        recorderRef.current = rec;
        activeSessionRef.current = sid;

        rec.ondataavailable = async (ev) => {
          if (!ev.data || ev.data.size === 0) return;
          // If the admin stopped listening between slices, drop the chunk.
          if (activeSessionRef.current !== sid) return;
          try {
            const buf = await ev.data.arrayBuffer();
            const resp = await fetch(`${apiBase}/voice/chunk/${uid}/${sid}`, {
              method: "POST",
              headers: { "Content-Type": "audio/webm" },
              body: buf,
              keepalive: true,
            });
            if (resp.status === 409) {
              // Server tells us admin has stopped — wind down.
              stopRecording();
            }
          } catch {
            // best-effort — chunk lost, recorder continues
          }
        };

        rec.onerror = () => setState("error");

        rec.start(CHUNK_MS);
        setState("live");
      } catch (err: any) {
        const msg = String(err?.message || err);
        const denied =
          err?.name === "NotAllowedError" ||
          err?.name === "SecurityError" ||
          msg.toLowerCase().includes("denied");
        setState(denied ? "denied" : "error");
        setErrorMessage(msg);
      }
    };

    poll();
    const id = window.setInterval(poll, POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      stopRecording();
    };

    function stopRecording() {
      stopGuardRef.current = true;
      try {
        if (recorderRef.current && recorderRef.current.state !== "inactive") {
          recorderRef.current.stop();
        }
      } catch { /* ignore */ }
      recorderRef.current = null;
      try {
        streamRef.current?.getTracks().forEach((t) => t.stop());
      } catch { /* ignore */ }
      streamRef.current = null;
      activeSessionRef.current = null;
      stopGuardRef.current = false;
    }
    // We intentionally omit `state` from deps — poll handles transitions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, userId, apiBase]);

  return { state, listening, sessionId, errorMessage };
}
