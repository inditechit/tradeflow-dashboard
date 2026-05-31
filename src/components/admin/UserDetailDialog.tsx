import React, { useEffect, useState } from "react";
import { History, MapPin, Mic, Pencil, User, Wallet, X, Tag, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatAdminDate,
  kycBadgeStyles,
  lastSeenLabel,
  parseCoord,
  renderRiskBadges,
  userHasMapLink,
} from "@/utils/adminUserDisplay";
import {
  getUserLabels,
  setUserLabels,
  tagColorClass,
  type UserLabelEntry,
} from "@/utils/adminUserLabels";

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
}) => {
  const [labels, setLabels] = useState<UserLabelEntry>({ label: "", tags: [] });
  const [newTag, setNewTag] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    setLabels(getUserLabels(user.id as number));
    setNewTag("");
  }, [user?.id, open]);

  if (!user) return null;

  const userId = Number(user.id);
  const isOnline = Number(user.is_online) === 1;
  const showVoice =
    isVoiceAdmin && Number.isFinite(adminListenerId) && userId !== adminListenerId;

  const saveLabels = (next: UserLabelEntry) => {
    setLabels(next);
    setUserLabels(userId, next);
    onLabelsUpdated?.();
  };

  const addTag = () => {
    const tag = newTag.trim();
    if (!tag || labels.tags.includes(tag)) return;
    saveLabels({ ...labels, tags: [...labels.tags, tag] });
    setNewTag("");
  };

  const removeTag = (tag: string) => {
    saveLabels({ ...labels, tags: labels.tags.filter((t) => t !== tag) });
  };

  return (
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
          <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Tag className="h-4 w-4" />
              Label &amp; tags
            </div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Custom label
            </label>
            <input
              type="text"
              value={labels.label ?? ""}
              onChange={(e) => saveLabels({ ...labels, label: e.target.value })}
              placeholder="e.g. VIP client, needs follow-up…"
              className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <div className="mb-2 flex flex-wrap gap-1.5">
              {labels.tags.map((tag) => (
                <span
                  key={tag}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                    tagColorClass(tag),
                  )}
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="rounded-full p-0.5 hover:bg-black/10"
                    aria-label={`Remove tag ${tag}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                placeholder="Add tag…"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addTag}>
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
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
              {showVoice && (
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

            <DetailBlock title="Dollar cut">
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
