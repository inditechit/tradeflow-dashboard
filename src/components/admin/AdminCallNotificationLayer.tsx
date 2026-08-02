import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminCallAlerts } from "@/hooks/useAdminCallAlerts";
import {
  AdminCallSettingsButton,
  AdminCallSoundSettings,
  IncomingCallOverlay,
} from "@/components/admin/AdminCallSoundSettings";
import type { AdminCallSoundId } from "@/utils/adminCallRingtones";

type AdminCallContextValue = {
  openSettings: () => void;
  ringing: boolean;
};

const AdminCallContext = createContext<AdminCallContextValue>({
  openSettings: () => {},
  ringing: false,
});

export function useAdminCallContext() {
  return useContext(AdminCallContext);
}

export function AdminCallNotificationProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const {
    prefs,
    setPrefs,
    incoming,
    dismissCall,
    stopRing,
    previewSound,
    audioReady,
    unlockAudio,
  } = useAdminCallAlerts();

  useEffect(() => {
    const unlock = () => void unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [unlockAudio]);

  const handlePreview = (soundId: AdminCallSoundId) => {
    void unlockAudio();
    void previewSound(soundId);
  };

  const answer = () => {
    if (!incoming) return;
    const link = incoming.link;
    stopRing();
    dismissCall();
    navigate(link);
  };

  // Auto-dismiss the alert after a short while (toast-like), instead of ringing forever.
  useEffect(() => {
    if (!incoming) return;
    const id = window.setTimeout(() => dismissCall(), 12_000);
    return () => window.clearTimeout(id);
  }, [incoming, dismissCall]);

  return (
    <AdminCallContext.Provider
      value={{ openSettings: () => setSettingsOpen(true), ringing: Boolean(incoming) }}
    >
      {children}

      {!audioReady && prefs.enabled ? (
        <button
          type="button"
          onClick={() => void unlockAudio()}
          className="fixed bottom-16 left-1/2 z-[90] -translate-x-1/2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-900 shadow-lg hover:bg-amber-100 md:bottom-4 md:left-auto md:right-4 md:translate-x-0 md:px-4 md:py-2 md:text-xs"
        >
          Tap to enable alert sounds
        </button>
      ) : null}

      {incoming ? (
        <IncomingCallOverlay
          title={incoming.title}
          subtitle={incoming.subtitle}
          onAnswer={answer}
          onDecline={dismissCall}
        />
      ) : null}

      <AdminCallSoundSettings
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        prefs={prefs}
        onPrefsChange={setPrefs}
        onPreview={handlePreview}
      />
    </AdminCallContext.Provider>
  );
}

export { AdminCallSettingsButton };
