import { Bell, X, ArrowRight, Volume2 } from "lucide-react";
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
            <Volume2 className="h-5 w-5 text-amber-600" />
            Alert sounds
          </DialogTitle>
          <DialogDescription>
            New admin events show a notification with a short alert sound.
            Pick your sound and which events should trigger it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <span className="text-sm font-medium text-slate-800">Enable alert sounds</span>
            <input
              type="checkbox"
              checked={prefs.enabled}
              onChange={(e) => commit({ ...prefs, enabled: e.target.checked })}
              className="h-4 w-4"
            />
          </label>

          <div>
            <Label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
              Alert sound (5 options)
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
              Alert me for these events
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
      aria-label="Alert sound settings"
      title="Alert sounds"
      onClick={onClick}
    >
      <Volume2 className="h-5 w-5 text-slate-700" />
      {ringing ? (
        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white" />
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

/** Top-right alert notification (not a full-screen call). */
export function IncomingCallOverlay({ title, subtitle, onAnswer, onDecline }: IncomingCallOverlayProps) {
  return (
    <div className="fixed right-4 top-4 z-[100] w-[calc(100%-2rem)] max-w-sm sm:w-full">
      <div className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-2xl ring-1 ring-black/5">
        <div className="flex items-start gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <Bell className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
              New alert
            </p>
            <h2 className="mt-0.5 truncate text-sm font-bold text-slate-900">{title}</h2>
            <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{subtitle}</p>
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            onClick={onDecline}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-4 py-2.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-slate-600 hover:bg-slate-100"
            onClick={onDecline}
          >
            Dismiss
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5 bg-amber-500 text-white hover:bg-amber-600"
            onClick={onAnswer}
          >
            View
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
