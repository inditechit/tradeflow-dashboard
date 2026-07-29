import React, { useEffect, useState } from "react";
import { CalendarPlus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  extendUserSubscription,
  fetchUserSubscription,
  type SubscriptionStatus,
} from "@/utils/adminSubscription";
import { MaskedPii } from "@/components/admin/AdminPiiReveal";

const PRESET_DAYS = [7, 30, 90, 180, 365];

type Props = {
  open: boolean;
  onClose: () => void;
  user: { id: number; name?: string; email?: string } | null;
  onSuccess?: () => void;
};

function formatExpiry(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

const ExtendSubscriptionModal: React.FC<Props> = ({ open, onClose, user, onSuccess }) => {
  const { toast } = useToast();
  const [sub, setSub] = useState<SubscriptionStatus | null>(null);
  const [loadingSub, setLoadingSub] = useState(false);
  const [customDays, setCustomDays] = useState("30");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !user?.id) return;
    setLoadingSub(true);
    setSub(null);
    void fetchUserSubscription(Number(user.id))
      .then(setSub)
      .catch((err) => {
        toast({
          title: "Could not load package",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      })
      .finally(() => setLoadingSub(false));
  }, [open, user?.id, toast]);

  const handleExtend = async (days: number) => {
    if (!user?.id || !(days > 0)) return;
    setSaving(true);
    try {
      const result = await extendUserSubscription(Number(user.id), days);
      toast({
        title: "Package extended",
        description: `Active until ${formatExpiry(result.subscription_expires_override)}`,
      });
      const refreshed = await fetchUserSubscription(Number(user.id));
      setSub(refreshed);
      onSuccess?.();
    } catch (err) {
      toast({
        title: "Extend failed",
        description: err instanceof Error ? err.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-indigo-600" />
            Extend package
          </DialogTitle>
          <DialogDescription className="text-left">
            <MaskedPii value={user.name ?? "User"} kind="name" /> —{" "}
            {user.email ? (
              <MaskedPii value={user.email} kind="email" />
            ) : (
              `ID ${user.id}`
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loadingSub ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading subscription…
            </div>
          ) : sub ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-sm">
              <p className="mb-2">
                <span className="font-medium text-slate-600">Status: </span>
                <span
                  className={
                    sub.isActive
                      ? "font-semibold text-emerald-700"
                      : sub.isExpired
                        ? "font-semibold text-amber-800"
                        : "font-semibold text-slate-700"
                  }
                >
                  {sub.isActive ? "Active" : sub.isExpired ? "Expired" : "No package"}
                </span>
              </p>
              {sub.activeSegment?.packageName && (
                <p className="mb-1 text-slate-800">
                  Plan: <span className="font-medium">{sub.activeSegment.packageName}</span>
                </p>
              )}
              <p className="text-slate-700">
                Expires: <span className="font-medium tabular-nums">{formatExpiry(sub.expiresAt)}</span>
              </p>
              {sub.hasAdminOverride && sub.adminOverrideExpiresAt && (
                <p className="mt-2 text-xs text-indigo-800">
                  Admin extension set until {formatExpiry(sub.adminOverrideExpiresAt)}
                </p>
              )}
            </div>
          ) : null}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Add days (stacks from current expiry if still active)
            </p>
            <div className="flex flex-wrap gap-2">
              {PRESET_DAYS.map((d) => (
                <Button
                  key={d}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={saving}
                  onClick={() => void handleExtend(d)}
                >
                  +{d}d
                </Button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              max={3650}
              value={customDays}
              onChange={(e) => setCustomDays(e.target.value)}
              className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              placeholder="Custom days"
            />
            <Button
              type="button"
              disabled={saving || !(Number(customDays) > 0)}
              onClick={() => void handleExtend(Math.floor(Number(customDays)))}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExtendSubscriptionModal;
