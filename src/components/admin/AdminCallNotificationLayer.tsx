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

  return (
    <AdminCallContext.Provider
      value={{ openSettings: () => setSettingsOpen(true), ringing: Boolean(incoming) }}
    >
      {children}

      {!audioReady && prefs.enabled ? (
        <button
          type="button"
          onClick={() => void unlockAudio()}
          className="fixed bottom-4 right-4 z-[90] rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-900 shadow-lg hover:bg-emerald-100"
        >
          Tap to enable call sounds
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
