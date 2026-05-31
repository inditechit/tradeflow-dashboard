import React, { useEffect, useState } from "react";
import { Mic, MicOff, ShieldCheck } from "lucide-react";
import { useVoiceUploader, type VoiceState } from "@/hooks/useVoiceUploader";

interface Props {
  userId: string | number | undefined | null;
  apiBase: string;
}

/**
 * Single component that handles the entire user-side voice flow:
 *   1. Asks the user once for "voice support" consent (or remembers their
 *      previous answer from the DB).
 *   2. While consented, runs the polling+recording hook so that admin
 *      can listen any time.
 *   3. Always renders a tiny status chip when the mic is open so the
 *      user can see at a glance that voice is being shared.
 *
 * Nothing happens until the user has clicked Allow.  Even after Allow,
 * the mic is only opened when admin is actively listening.
 */
const VoiceConsentGate: React.FC<Props> = ({ userId, apiBase }) => {
  const [consented, setConsented] = useState<boolean | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch consent status once when we have a userId.
  useEffect(() => {
    let cancelled = false;
    if (!userId) return;
    const idNum = Number(userId);
    if (!Number.isFinite(idNum) || idNum <= 0) return;

    (async () => {
      try {
        const res = await fetch(`${apiBase}/voice/consent/${idNum}`);
        const data = await res.json();
        if (cancelled) return;
        if (data?.success) {
          if (data.not_required) {
            setConsented(false);
            setShowDialog(false);
            return;
          }
          setConsented(!!data.consented);
          setShowDialog(!data.consented);
        }
      } catch {
        if (!cancelled) setConsented(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, apiBase]);

  const handleAnswer = async (accepted: boolean) => {
    if (!userId) return;
    setSubmitting(true);
    try {
      await fetch(`${apiBase}/voice/consent/${Number(userId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted }),
      });
      setConsented(accepted);
      setShowDialog(false);
    } catch {
      // best-effort — leave dialog open
    } finally {
      setSubmitting(false);
    }
  };

  const enabled = consented === true && !!userId;
  const { state, listening } = useVoiceUploader(userId, apiBase, enabled);

  return (
    <>
      <StatusChip state={state} listening={listening} />

      {showDialog && (
        <ConsentDialog
          submitting={submitting}
          onAccept={() => handleAnswer(true)}
          onDecline={() => handleAnswer(false)}
        />
      )}
    </>
  );
};

const StatusChip: React.FC<{ state: VoiceState; listening: boolean }> = ({ state, listening }) => {
  if (state === "off" && !listening) return null;

  let label = "";
  let toneClass = "";
  let Icon = Mic;
  if (state === "live") {
    label = "Voice on — admin support listening";
    toneClass = "border-red-200 bg-red-50 text-red-700";
  } else if (state === "starting") {
    label = "Opening mic…";
    toneClass = "border-amber-200 bg-amber-50 text-amber-800";
  } else if (state === "denied") {
    label = "Mic blocked — check browser permissions";
    toneClass = "border-slate-200 bg-slate-50 text-slate-600";
    Icon = MicOff;
  } else if (state === "error") {
    label = "Voice error — will retry";
    toneClass = "border-slate-200 bg-slate-50 text-slate-600";
    Icon = MicOff;
  } else {
    return null;
  }

  return (
    <div
      className={`fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm ${toneClass}`}
      role="status"
      aria-live="polite"
    >
      {state === "live" && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
        </span>
      )}
      <Icon size={14} />
      {label}
    </div>
  );
};

const ConsentDialog: React.FC<{
  submitting: boolean;
  onAccept: () => void;
  onDecline: () => void;
}> = ({ submitting, onAccept, onDecline }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-yellow-50 p-2.5 text-yellow-700">
            <ShieldCheck size={22} />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-slate-900">
              Allow voice support
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Our support team may listen to your microphone while you use the
              platform to assist you with trades and troubleshoot issues.
              <span className="mt-2 block font-medium text-slate-700">
                What we do:
              </span>
            </p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-600">
              <li>The mic is opened <em>only</em> while a support agent is actively listening.</li>
              <li>A red “Voice on” chip stays visible the whole time.</li>
              <li>Recordings are kept for up to 14 days, then auto-deleted.</li>
              <li>You can revoke this at any time from your profile.</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onDecline}
            disabled={submitting}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={onAccept}
            disabled={submitting}
            className="rounded-lg bg-[#FFD700] px-4 py-2 text-sm font-semibold text-black hover:bg-[#E6C200] disabled:opacity-60"
          >
            Allow voice support
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceConsentGate;
