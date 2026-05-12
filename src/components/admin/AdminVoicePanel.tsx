import React, { useEffect, useMemo, useRef, useState } from "react";
import { Mic, MicOff, Play, RefreshCw, X } from "lucide-react";

interface Session {
  id: string;
  user_id: number;
  started_at: string;
  ended_at: string | null;
  status: "open" | "closed" | "aborted";
  bytes: number;
  chunk_count: number;
  duration_ms: number | null;
}

interface Props {
  apiBase: string;
  adminUserId: number;
  user: { id: number; name?: string; email?: string };
  onClose: () => void;
}

const HEARTBEAT_MS = 4_000;

const AdminVoicePanel: React.FC<Props> = ({ apiBase, adminUserId, user, onClose }) => {
  const [isListening, setIsListening] = useState(false);
  const [liveSessionId, setLiveSessionId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const heartbeatTimer = useRef<number | null>(null);

  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      const r = await fetch(`${apiBase}/admin/voice/sessions/${user.id}?adminUserId=${adminUserId}&limit=50`);
      const data = await r.json();
      if (data?.success) setSessions(data.sessions ?? []);
    } catch {
      // ignore
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    return () => {
      // panel closing → stop heartbeat + tell server to end session
      stopListen({ silent: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const startListen = async () => {
    setErrorMsg(null);
    try {
      const r = await fetch(`${apiBase}/admin/voice/listen/${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminUserId }),
      });
      const data = await r.json();
      if (!data?.success) {
        setErrorMsg(data?.error || "Could not start listening");
        return;
      }
      setIsListening(true);
      setLiveSessionId(data.sessionId);

      // Start the audio element a moment later so the user has time
      // to send the first chunk(s) — otherwise the player can stall.
      window.setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.src = `${apiBase}/admin/voice/live/${data.sessionId}?adminUserId=${adminUserId}`;
          audioRef.current.play().catch(() => {
            setErrorMsg("Click Play to enable audio (browser blocked autoplay).");
          });
        }
      }, 1500);

      heartbeatTimer.current = window.setInterval(async () => {
        try {
          await fetch(`${apiBase}/admin/voice/listen/${user.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ adminUserId }),
          });
        } catch { /* ignore */ }
      }, HEARTBEAT_MS);
    } catch (err: any) {
      setErrorMsg(String(err?.message ?? err));
    }
  };

  const stopListen = async (opts?: { silent?: boolean }) => {
    if (heartbeatTimer.current) {
      window.clearInterval(heartbeatTimer.current);
      heartbeatTimer.current = null;
    }
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.removeAttribute("src");
        audioRef.current.load();
      } catch { /* ignore */ }
    }
    try {
      await fetch(`${apiBase}/admin/voice/stop-listen/${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminUserId }),
      });
    } catch { /* ignore */ }
    setIsListening(false);
    setLiveSessionId(null);
    if (!opts?.silent) fetchSessions();
  };

  const playSession = (sessionId: string) => {
    if (audioRef.current) {
      audioRef.current.src = `${apiBase}/admin/voice/file/${sessionId}?adminUserId=${adminUserId}`;
      audioRef.current.play().catch(() => setErrorMsg("Tap Play on the audio bar."));
    }
  };

  const fmtBytes = (n: number) => {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  };
  const fmtTime = (s: string | null) => (s ? new Date(s.replace(" ", "T")).toLocaleString() : "—");

  const liveLabel = useMemo(() => {
    if (!isListening) return "Off";
    return liveSessionId ? "Live" : "Connecting…";
  }, [isListening, liveSessionId]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/30 sm:items-stretch">
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl sm:rounded-l-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-slate-900">
              Voice — {user.name || user.email || `User #${user.id}`}
            </h2>
            <p className="truncate text-xs text-slate-500">
              {isListening ? "Listening live" : "Idle — press Listen to hear them"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close voice panel"
          >
            <X size={18} />
          </button>
        </div>

        {/* Live controls */}
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={isListening ? () => stopListen() : startListen}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${
                isListening
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "bg-[#FFD700] text-black hover:bg-[#E6C200]"
              }`}
            >
              {isListening ? <MicOff size={16} /> : <Mic size={16} />}
              {isListening ? "Stop" : "Listen live"}
            </button>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                isListening
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-slate-200 bg-slate-50 text-slate-600"
              }`}
            >
              {isListening && (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                </span>
              )}
              {liveLabel}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Recording auto-starts on the user's device. If they're offline or have
            declined consent, nothing will play until they're back and consented.
          </p>
          <audio ref={audioRef} controls className="mt-3 w-full" />
          {errorMsg && (
            <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{errorMsg}</div>
          )}
        </div>

        {/* Past sessions */}
        <div className="flex items-center justify-between px-5 py-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Past recordings</h3>
            <p className="text-xs text-slate-500">Kept for 14 days, then auto-deleted.</p>
          </div>
          <button
            type="button"
            onClick={fetchSessions}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={12} className={loadingSessions ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          {sessions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
              No recordings yet for this user.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {sessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-800">
                      {fmtTime(s.started_at)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {s.status === "open" ? "🟢 live • " : ""}
                      {s.chunk_count} chunks • {fmtBytes(Number(s.bytes) || 0)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => playSession(s.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-yellow-300 bg-[#FFF9E6] px-2.5 py-1 text-xs font-semibold text-neutral-900 hover:bg-yellow-50"
                  >
                    <Play size={12} />
                    Play
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminVoicePanel;
