import { Phone, PhoneOff, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  ADMIN_CALL_ALERT_LABELS,
  ADMIN_CALL_SOUNDS,
  saveAdminCallPrefs,
  type AdminCallAlertType,
  type AdminCallNotificationPrefs,
  type AdminCallSoundId,
} from "@/utils/adminCallRingtones";

type AdminCallSoundSettingsProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefs: AdminCallNotificationPrefs;
  onPrefsChange: (prefs: AdminCallNotificationPrefs) => void;
  onPreview: (soundId: AdminCallSoundId) => void;
};

export function AdminCallSoundSettings({
  open,
  onOpenChange,
  prefs,
  onPrefsChange,
  onPreview,
}: AdminCallSoundSettingsProps) {
  const commit = (next: AdminCallNotificationPrefs) => {
    onPrefsChange(next);
    saveAdminCallPrefs(next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5 text-emerald-600" />
            Call alert sounds
          </DialogTitle>
          <DialogDescription>
            New admin events ring like an incoming phone call (loops until you answer or decline).
            Pick your ringtone and which events should trigger it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <span className="text-sm font-medium text-slate-800">Enable call alerts</span>
            <input
              type="checkbox"
              checked={prefs.enabled}
              onChange={(e) => commit({ ...prefs, enabled: e.target.checked })}
              className="h-4 w-4"
            />
          </label>

          <div>
            <Label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
              Ringtone (5 options)
            </Label>
            <div className="space-y-2">
              {ADMIN_CALL_SOUNDS.map((s) => {
                const active = prefs.soundId === s.id;
                return (
                  <div
                    key={s.id}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5",
                      active ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white",
                    )}
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => commit({ ...prefs, soundId: s.id })}
                    >
                      <div className="text-sm font-semibold text-slate-900">{s.label}</div>
                      <div className="text-xs text-slate-500">{s.description}</div>
                    </button>
                    <Button type="button" size="sm" variant="outline" onClick={() => onPreview(s.id)}>
                      Preview
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <Label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
              Volume
            </Label>
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.05}
              value={prefs.volume}
              onChange={(e) => commit({ ...prefs, volume: Number(e.target.value) })}
              className="w-full"
            />
          </div>

          <div>
            <Label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
              Ring for these events
            </Label>
            <div className="space-y-2">
              {(Object.keys(ADMIN_CALL_ALERT_LABELS) as AdminCallAlertType[]).map((type) => (
                <label
                  key={type}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2"
                >
                  <span className="text-sm text-slate-700">{ADMIN_CALL_ALERT_LABELS[type]}</span>
                  <input
                    type="checkbox"
                    checked={prefs.types[type]}
                    onChange={(e) =>
                      commit({
                        ...prefs,
                        types: { ...prefs.types, [type]: e.target.checked },
                      })
                    }
                    className="h-4 w-4"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AdminCallSettingsButton({
  onClick,
  ringing,
}: {
  onClick: () => void;
  ringing?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("relative shrink-0", ringing && "animate-pulse")}
      aria-label="Call alert sound settings"
      title="Call alert sounds"
      onClick={onClick}
    >
      <Volume2 className="h-5 w-5 text-slate-700" />
      {ringing ? (
        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
      ) : null}
    </Button>
  );
}

type IncomingCallOverlayProps = {
  title: string;
  subtitle: string;
  onAnswer: () => void;
  onDecline: () => void;
};

export function IncomingCallOverlay({ title, subtitle, onAnswer, onDecline }: IncomingCallOverlayProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-b from-emerald-600 to-emerald-800 p-6 text-white shadow-2xl">
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="relative mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/15 ring-4 ring-white/20">
            <Phone className="h-9 w-9 animate-pulse" />
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold">
              !
            </span>
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-100">
            Incoming call
          </p>
          <h2 className="mt-1 text-xl font-bold">{title}</h2>
          <p className="mt-1 text-sm text-emerald-100">{subtitle}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-12 gap-2 border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            onClick={onDecline}
          >
            <PhoneOff className="h-5 w-5" />
            Decline
          </Button>
          <Button
            type="button"
            className="h-12 gap-2 bg-white text-emerald-800 hover:bg-emerald-50"
            onClick={onAnswer}
          >
            <Phone className="h-5 w-5" />
            Answer
          </Button>
        </div>
      </div>
    </div>
  );
}
