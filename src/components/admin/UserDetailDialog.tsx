import React, { useEffect, useRef, useState } from "react";
import { CalendarPlus, History, MapPin, Mic, Pencil, User, Wallet, X, Tag, Plus, Loader2, UserCog, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  formatAdminDate,
  kycBadgeStyles,
  lastSeenLabel,
  parseCoord,
  renderRiskBadges,
  userHasMapLink,
} from "@/utils/adminUserDisplay";
import {
  parseUserLabels,
  saveUserLabels,
  tagColorClass,
  type UserLabelEntry,
} from "@/utils/adminUserLabels";
import UserLabelsDisplay from "./UserLabelsDisplay";
import { useEmployeeAccess } from "@/hooks/useEmployeeAccess";
import { useApp } from "@/context/AppContext";
import { API_BASE } from "@/config/api";
import { EmployeeAccessModal } from "@/components/admin/EmployeeAccessModal";

type UserDetailDialogProps = {
  user: Record<string, unknown> | null;
  open: boolean;
  onClose: () => void;
  isVoiceAdmin: boolean;
  adminListenerId: number;
  onProfile: (user: Record<string, unknown>) => void;
  onWallet: (user: Record<string, unknown>) => void;
  onEdit: (user: Record<string, unknown>) => void;
  onVoice: (user: Record<string, unknown>) => void;
  onRechargeHistory: (userId: number) => void;
  onOpenMap: (user: Record<string, unknown>) => void;
  onLabelsUpdated?: () => void;
  onExtendPackage?: (user: Record<string, unknown>) => void;
  onConvertedToEmployee?: () => void;
  onTradingReopened?: () => void;
};

const UserDetailDialog: React.FC<UserDetailDialogProps> = ({
  user,
  open,
  onClose,
  isVoiceAdmin,
  adminListenerId,
  onProfile,
  onWallet,
  onEdit,
  onVoice,
  onRechargeHistory,
  onOpenMap,
  onLabelsUpdated,
  onExtendPackage,
  onConvertedToEmployee,
  onTradingReopened,
}) => {
  const { toast } = useToast();
  const { can, isAdmin } = useEmployeeAccess();
  const { currentUser } = useApp();
  const adminId = Number(currentUser?.userId);
  const [converting, setConverting] = useState(false);
  const [employeeAccessOpen, setEmployeeAccessOpen] = useState(false);
  const [employeePerms, setEmployeePerms] = useState<string[]>([]);
  const [employeeAccessName, setEmployeeAccessName] = useState("");
  const [convertUserId, setConvertUserId] = useState<number | null>(null);
  const [savingEmployeeAccess, setSavingEmployeeAccess] = useState(false);
  const [labels, setLabels] = useState<UserLabelEntry>({ label: "", tags: [] });
  const [newTag, setNewTag] = useState("");
  const [savingLabels, setSavingLabels] = useState(false);
  const [manualStopCount, setManualStopCount] = useState(0);
  const [reopeningTrades, setReopeningTrades] = useState(false);
  const labelDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    setLabels(parseUserLabels(user));
    setNewTag("");
  }, [user, open]);

  useEffect(() => {
    if (!open || !user?.id || !isAdmin) {
      setManualStopCount(0);
      return;
    }
    const uid = Number(user.id);
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/users/${uid}/manual-stop-settlements`);
        const data = await res.json();
        if (!cancelled && data.success) {
          setManualStopCount(Number(data.count ?? 0));
        }
      } catch {
        if (!cancelled) setManualStopCount(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, user?.id, isAdmin]);

  if (!user && !employeeAccessOpen) return null;

  const userId = user ? Number(user.id) : convertUserId ?? 0;
  const isOnline = user ? Number(user.is_online) === 1 : false;
  const showVoice =
    isVoiceAdmin && Number.isFinite(adminListenerId) && userId !== adminListenerId;

  const handleConvertToEmployee = async () => {
    if (!adminId || !userId || !user) return;
    const label = String(user.name || user.email || `User #${userId}`);
    if (
      !window.confirm(
        `Convert "${label}" to an employee?\n\nThey will keep their login and get limited admin panel access.`,
      )
    ) {
      return;
    }
    setConverting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/employees/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          createdByUserId: adminId,
          permissions: [],
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Convert failed");
      toast({ title: "Converted to employee", description: "Set their panel access." });
      setEmployeePerms([]);
      setEmployeeAccessName(label);
      setConvertUserId(userId);
      setEmployeeAccessOpen(true);
      onConvertedToEmployee?.();
    } catch (err) {
      toast({
        title: "Could not convert",
        description: err instanceof Error ? err.message : "Convert failed",
        variant: "destructive",
      });
    } finally {
      setConverting(false);
    }
  };

  const handleReopenManualStopTrades = async () => {
    if (!userId || !user) return;
    const label = String(user.name || `User #${userId}`);
    if (
      !window.confirm(
        `Reopen trades for "${label}" that were settled when they hit Stop?\n\n` +
          `• Master still open → trade becomes live again at their pool %\n` +
          `• Master already closed → they are settled at final master P/L × pool %\n` +
          `• Early stop wallet credit is reversed first\n\n` +
          (manualStopCount > 0
            ? `${manualStopCount} allocation(s) will be processed.`
            : "No manual-stop settlements were found — run anyway?"),
      )
    ) {
      return;
    }
    setReopeningTrades(true);
    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}/reopen-manual-stop-trades`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeTrading: true }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Reopen failed");
      toast({
        title: "Trades reopened",
        description: String(data.message || "Manual-stop settlements were reversed."),
      });
      setManualStopCount(0);
      onTradingReopened?.();
    } catch (err) {
      toast({
        title: "Could not reopen trades",
        description: err instanceof Error ? err.message : "Reopen failed",
        variant: "destructive",
      });
    } finally {
      setReopeningTrades(false);
    }
  };

  const saveEmployeeAccess = async (permissions: string[]) => {
    if (!adminId || !userId) return;
    setSavingEmployeeAccess(true);
    try {
      const res = await fetch(`${API_BASE}/admin/employees/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions, updatedByUserId: adminId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Save failed");
      toast({ title: "Employee access saved" });
      setEmployeeAccessOpen(false);
      onClose();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Save failed",
        variant: "destructive",
      });
    } finally {
      setSavingEmployeeAccess(false);
    }
  };

  const persistLabels = async (next: UserLabelEntry) => {
    setLabels(next);
    setSavingLabels(true);
    try {
      const saved = await saveUserLabels(userId, next);
      setLabels(saved);
      onLabelsUpdated?.();
    } catch (err) {
      toast({
        title: "Could not save label",
        description: err instanceof Error ? err.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setSavingLabels(false);
    }
  };

  const updateLabelDraft = (label: string) => {
    const next = { ...labels, label };
    setLabels(next);
    if (labelDebounceRef.current) clearTimeout(labelDebounceRef.current);
    labelDebounceRef.current = setTimeout(() => {
      void persistLabels(next);
    }, 600);
  };

  const addTag = () => {
    const tag = newTag.trim();
    if (!tag || labels.tags.includes(tag)) return;
    void persistLabels({ ...labels, tags: [...labels.tags, tag] });
    setNewTag("");
  };

  const removeTag = (tag: string) => {
    void persistLabels({ ...labels, tags: labels.tags.filter((t) => t !== tag) });
  };

  return (
    <>
    {user && (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-left">{String(user.name ?? "User")}</DialogTitle>
          <DialogDescription className="text-left break-all">
            {String(user.email ?? "")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Labels & tags */}
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Tag className="h-4 w-4 text-indigo-600" />
                Label &amp; tags
              </div>
              {savingLabels && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
            </div>

            <div className="border-b border-slate-100 bg-slate-50/40 px-4 py-3">
              <UserLabelsDisplay
                user={{
                  admin_label: labels.label,
                  admin_tags: labels.tags,
                }}
              />
            </div>

            <Tabs defaultValue="label" className="p-4">
              <TabsList className="grid h-10 w-full grid-cols-2 rounded-xl bg-slate-100 p-1">
                <TabsTrigger
                  value="label"
                  className="rounded-lg text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm"
                >
                  Custom label
                </TabsTrigger>
                <TabsTrigger
                  value="tags"
                  className="rounded-lg text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm"
                >
                  Tags {labels.tags.length > 0 && `(${labels.tags.length})`}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="label" className="mt-4 space-y-2">
                <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Assign a note for this user
                </label>
                <input
                  type="text"
                  value={labels.label ?? ""}
                  onChange={(e) => updateLabelDraft(e.target.value)}
                  onBlur={() => {
                    if (labelDebounceRef.current) {
                      clearTimeout(labelDebounceRef.current);
                      labelDebounceRef.current = null;
                    }
                    void persistLabels(labels);
                  }}
                  placeholder="e.g. VIP client, needs follow-up, high value…"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
                <p className="text-[11px] text-slate-400">Saved automatically after you stop typing.</p>
              </TabsContent>

              <TabsContent value="tags" className="mt-4 space-y-3">
                <div className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50/60 p-2">
                  {labels.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {labels.tags.map((tag) => (
                        <span
                          key={tag}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold uppercase tracking-wide shadow-sm",
                            tagColorClass(tag),
                          )}
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="rounded-md p-0.5 hover:bg-black/10"
                            aria-label={`Remove tag ${tag}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="px-1 py-2 text-xs text-slate-400">No tags yet — add one below.</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                    placeholder="Type tag name…"
                    className="flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1 rounded-xl border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100"
                    onClick={addTag}
                  >
                    <Plus className="h-4 w-4" />
                    Add tag
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </section>

          {/* Actions */}
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  onProfile(user);
                  onClose();
                }}
              >
                <User className="h-4 w-4" />
                Profile
              </Button>
              {can("action:users:wallet") && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 border-yellow-200 bg-[#FFF9E6] text-neutral-800 hover:bg-yellow-50"
                onClick={() => {
                  onWallet(user);
                  onClose();
                }}
              >
                <Wallet className="h-4 w-4" />
                Wallet
              </Button>
              )}
              {can("action:users:edit") && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"
                onClick={() => {
                  onEdit(user);
                  onClose();
                }}
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
              )}
              {showVoice && can("action:users:voice") && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "gap-1.5 font-semibold",
                    isOnline
                      ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                  )}
                  onClick={() => {
                    onVoice(user);
                    onClose();
                  }}
                >
                  <Mic className="h-4 w-4" />
                  {isOnline ? "Voice (online)" : "Voice (offline)"}
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={() => onRechargeHistory(userId)}
              >
                <History className="h-4 w-4" />
                Recharge history
              </Button>
              {onExtendPackage && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-violet-200 bg-violet-50 text-violet-900 hover:bg-violet-100"
                  onClick={() => {
                    onExtendPackage(user);
                    onClose();
                  }}
                >
                  <CalendarPlus className="h-4 w-4" />
                  Extend package
                </Button>
              )}
              {isAdmin && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={reopeningTrades}
                  className="gap-1.5 border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100"
                  onClick={() => void handleReopenManualStopTrades()}
                  title="Undo mistaken Stop trade — reopen at original pool share"
                >
                  {reopeningTrades ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                  Reopen stopped trades
                  {manualStopCount > 0 ? ` (${manualStopCount})` : ""}
                </Button>
              )}
              {isAdmin && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={converting}
                  className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                  onClick={() => void handleConvertToEmployee()}
                >
                  {converting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserCog className="h-4 w-4" />
                  )}
                  Convert to employee
                </Button>
              )}
            </div>
          </section>

          {/* Details grid */}
          <section className="grid gap-4 sm:grid-cols-2">
            <DetailBlock title="Status">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-block h-2.5 w-2.5 rounded-full",
                    isOnline ? "bg-emerald-500 ring-2 ring-emerald-200" : "bg-slate-300",
                  )}
                />
                <span className={cn("text-sm font-medium", isOnline ? "text-emerald-700" : "text-slate-500")}>
                  {lastSeenLabel(user.last_seen_at, user.is_online)}
                </span>
              </div>
            </DetailBlock>

            <DetailBlock title="Contact">
              <p className="text-sm text-slate-800">{String(user.mobile ?? "—")}</p>
              <p className="text-xs text-neutral-800">@{String(user.telegram ?? "—")}</p>
            </DetailBlock>

            <DetailBlock title="Wallet">
              <p className="text-sm font-semibold tabular-nums text-slate-900">
                {String(user.wallet_currency ?? "USD")}{" "}
                {Number(user.wallet_balance ?? 0).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              {Number(user.has_wallet) === 0 && (
                <span className="text-xs text-slate-400">No wallet</span>
              )}
            </DetailBlock>

            <DetailBlock title="Recharges">
              <p className="text-sm font-semibold tabular-nums">
                {Number(user.recharge_success_count ?? 0)}× success
              </p>
              <p className="text-xs tabular-nums text-slate-600">
                USD{" "}
                {Number(user.recharge_total_usd ?? 0).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                total
              </p>
            </DetailBlock>

            <DetailBlock title="Created">{formatAdminDate(String(user.created_at ?? ""))}</DetailBlock>

            <DetailBlock title="KYC">
              <span
                className={cn(
                  "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize",
                  user.kyc_status === "verified"
                    ? "border-green-200 bg-green-100 text-green-700"
                    : kycBadgeStyles(String(user.kyc_status)),
                )}
              >
                {String(user.kyc_status ?? "pending")}
              </span>
            </DetailBlock>

            <DetailBlock title="Profit %">
              {user.profit_percentage != null && user.profit_percentage !== ""
                ? `${user.profit_percentage}%`
                : "—"}
            </DetailBlock>

            <DetailBlock title="Fee per lot">
              {user.dollar_amount ? `$${user.dollar_amount}` : "—"}
            </DetailBlock>

            <DetailBlock title="Risk profile" className="sm:col-span-2">
              {renderRiskBadges(user.risk)}
            </DetailBlock>

            <DetailBlock title="Location" className="sm:col-span-2">
              {userHasMapLink(user) ? (
                <button
                  type="button"
                  onClick={() => onOpenMap(user)}
                  className="group flex w-full max-w-md gap-2 rounded-lg border border-yellow-300 bg-white px-3 py-2 text-left shadow-sm transition hover:border-yellow-400 hover:bg-yellow-50/60"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neutral-900" />
                  <div className="min-w-0 flex-1">
                    {user.address ? (
                      <div className="text-xs leading-snug text-slate-800">{String(user.address)}</div>
                    ) : (
                      <div className="font-mono text-[11px] text-slate-600">
                        {parseCoord(user.latitude)?.toFixed(5)}, {parseCoord(user.longitude)?.toFixed(5)}
                      </div>
                    )}
                    <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wide text-neutral-900">
                      Open map
                    </span>
                  </div>
                </button>
              ) : (
                <span className="text-sm text-slate-400">No location</span>
              )}
            </DetailBlock>
          </section>
        </div>
      </DialogContent>
    </Dialog>
    )}

    <EmployeeAccessModal
      open={employeeAccessOpen}
      onClose={() => {
        setEmployeeAccessOpen(false);
        setConvertUserId(null);
      }}
      employeeName={employeeAccessName || (user ? String(user.name || user.email || `User #${userId}`) : "Employee")}
      initialPermissions={employeePerms}
      onSave={saveEmployeeAccess}
      saving={savingEmployeeAccess}
    />
    </>
  );
};

function DetailBlock({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-slate-100 bg-white p-3", className)}>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{title}</p>
      {children}
    </div>
  );
}

export default UserDetailDialog;
