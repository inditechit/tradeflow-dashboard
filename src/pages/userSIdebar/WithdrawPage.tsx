import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownToLine, Loader2, Wallet } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useToast } from "@/hooks/use-toast";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { useUserFinance } from "@/hooks/useUserFinance";
import { getTrialWithdrawLock } from "@/utils/trialWithdrawLock";
import { API_BASE } from "@/config/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MIN_WITHDRAW = 10;

type WithdrawRow = {
  id: number;
  amount_usd: string | number;
  trc20_address: string;
  status: string;
  rejection_reason: string | null;
  outbound_tx_hash: string | null;
  created_at: string;
  completed_at: string | null;
};

const WithdrawPage = () => {
  const { currentUser } = useApp();
  const { toast } = useToast();
  const userId = currentUser?.userId;
  const subscription = useSubscriptionStatus();
  const trialLock = useMemo(
    () => getTrialWithdrawLock(subscription.isActive, subscription.activeSegment),
    [subscription.isActive, subscription.activeSegment],
  );

  const { refresh: refreshFinance, ...finance } = useUserFinance(userId);
  const balance = finance.walletBalance;
  const withdrawableEquity = finance.withdrawable;
  const softBust = finance.softBust;
  const [payoutSaved, setPayoutSaved] = useState("");
  const [addressDraft, setAddressDraft] = useState("");
  const [amount, setAmount] = useState("");
  const [rows, setRows] = useState<WithdrawRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [pRes, rRes] = await Promise.all([
        fetch(`${API_BASE}/user/profile/${userId}`),
        fetch(`${API_BASE}/user/withdraw/${userId}`),
      ]);
      await refreshFinance();
      const pData = await pRes.json();
      if (pData.success && pData.profile) {
        const addr = String(pData.profile.trc20WithdrawAddress ?? "").trim();
        setPayoutSaved(addr);
        if (!addr) setAddressDraft("");
      } else {
        setPayoutSaved("");
      }
      const rData = await rRes.json();
      if (rData.success && Array.isArray(rData.requests)) {
        setRows(rData.requests);
      } else {
        setRows([]);
      }
    } catch {
      toast({ title: "Could not load data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [userId, toast, refreshFinance]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaveAddress = async () => {
    if (!userId) return;
    const trimmed = addressDraft.trim();
    if (!trimmed) {
      toast({
        title: "Address required",
        description: "Enter your trc20 payout address.",
        variant: "destructive",
      });
      return;
    }
    setSavingAddress(true);
    try {
      const res = await fetch(`${API_BASE}/user/profile/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trc20_withdraw_address: trimmed }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Saved", description: "Your trc20 payout address is saved." });
        setAddressDialogOpen(false);
        await load();
      } else {
        toast({
          title: "Could not save",
          description: data.error ?? "Check the address format.",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSavingAddress(false);
    }
  };

  const handleSubmit = async () => {
    if (!userId) return;
    if (trialLock.locked) {
      toast({
        title: "Trial withdrawal locked",
        description:
          trialLock.message ??
          "Withdrawals unlock when your 7-day free trial ends. You can stop trading anytime.",
        variant: "destructive",
      });
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < MIN_WITHDRAW) {
      toast({
        title: "Invalid amount",
        description: `Minimum withdrawal is ${MIN_WITHDRAW} USD.`,
        variant: "destructive",
      });
      return;
    }
    if (!payoutSaved) {
      setAddressDialogOpen(true);
      toast({
        title: "Add payout address",
        description: "Enter your trc20 wallet address in the popup to continue.",
        variant: "destructive",
      });
      return;
    }
    const maxOut = Math.max(0, finance.withdrawable, finance.walletBalance);
    if (amt > maxOut) {
      toast({
        title: "Insufficient equity",
        description: "Amount exceeds your wallet balance. Lower the amount.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/user/withdraw/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: "Request submitted",
          description: "An admin will review and send USDT (trc20) to your saved address.",
        });
        setAmount("");
        load();
      } else {
        toast({
          title: "Request failed",
          description: data.error ?? "Try again",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!userId) {
    return null;
  }

  const hasAddress = Boolean(payoutSaved);
  const withdrawBlocked = trialLock.locked;
  const unlockLabel = trialLock.unlockAt
    ? new Date(trialLock.unlockAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-0 py-4 sm:px-2 md:px-6 md:py-10">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 sm:text-2xl">
          <ArrowDownToLine className="h-7 w-7 text-neutral-900" aria-hidden />
          Withdraw USDT (trc20)
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Paid plans: outbound USDT typically within 5 seconds to 1 minute after approval. Enter how much you want to withdraw.
        </p>
      </div>

      {withdrawBlocked && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-bold text-amber-900">Free trial — withdrawals locked</p>
          <p className="mt-2">
            {trialLock.message ??
              "Your funds stay locked during the 7-day trial. You can stop trading anytime, but withdrawal opens when the trial ends."}
          </p>
          {unlockLabel && (
            <p className="mt-2 font-semibold tabular-nums">
              Unlocks: {unlockLabel}
              {trialLock.daysRemaining > 0
                ? ` (${trialLock.daysRemaining} day${trialLock.daysRemaining === 1 ? "" : "s"} left)`
                : ""}
            </p>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 space-y-3 border-b border-slate-100 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-slate-700">
              <Wallet className="h-5 w-5 text-neutral-900" />
              <span className="text-sm font-medium">Wallet (deposits)</span>
            </div>
            <p className="text-xl font-bold tabular-nums text-slate-900">
              {loading || finance.loading
                ? "…"
                : `USD ${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-medium text-slate-700">Withdrawable (USDT)</span>
            <p
              className={`text-2xl font-bold tabular-nums ${
                withdrawableEquity > 0 ? "text-emerald-800" : "text-slate-700"
              }`}
            >
              {loading || finance.loading
                ? "…"
                : `USD ${withdrawableEquity.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
          </div>
          {softBust && !loading && !finance.loading && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              Open trades are in loss — withdrawable is reduced by that share but cannot go below zero.
            </p>
          )}
          <p className="text-xs text-slate-500">
            Withdrawable = wallet (deposits + closed trade results) plus your live share of open profit/loss. Withdrawing
            more than the wallet balance will realize open P/L into the wallet first.
          </p>
        </div>

        <div className="space-y-6">
          {/* 1) Amount first */}
          <div className="space-y-2">
            <Label htmlFor="wd-amt" className="text-black">
              Amount (USD)
            </Label>
            <Input
              id="wd-amt"
              type="number"
              min={MIN_WITHDRAW}
              step="0.01"
              placeholder={`Min ${MIN_WITHDRAW}`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="max-w-xs border-slate-200 bg-white text-slate-900"
              disabled={loading || submitting || withdrawBlocked}
            />
          </div>

          {!loading && !hasAddress && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3">
              <p className="text-sm text-amber-950">No trc20 payout address saved yet.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-amber-400 bg-white font-semibold text-amber-950 hover:bg-amber-100"
                onClick={() => setAddressDialogOpen(true)}
              >
                Add trc20 address
              </Button>
            </div>
          )}

          {!loading && hasAddress && (
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Saved trc20 address</p>
              <p className="mt-1 break-all font-mono text-sm text-slate-900">{payoutSaved}</p>
              <Link
                to="/user/profile#trc20-payout"
                className="mt-2 inline-block text-sm font-semibold text-neutral-900 underline"
              >
                Change in profile
              </Link>
            </div>
          )}

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={loading || submitting || !amount || withdrawBlocked}
            className="gap-2 bg-[#FFD700] text-black hover:bg-[#E6C200]"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Submit withdrawal request
          </Button>
          {!hasAddress && !loading && (
            <p className="text-xs text-slate-500">
              Enter an amount and submit — if no address is saved, a popup will ask for your trc20 wallet.
            </p>
          )}
        </div>
      </div>

      <Dialog open={addressDialogOpen} onOpenChange={setAddressDialogOpen}>
        <DialogContent className="z-[100] max-w-md border-slate-200 bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-900">Add trc20 payout address</DialogTitle>
            <DialogDescription className="text-left text-slate-600">
              USDT withdrawals go to this Tron (trc20) address. You can also edit it anytime in profile.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="dlg-trc20" className="text-slate-800">
              trc20 address (starts with T…)
            </Label>
            <Input
              id="dlg-trc20"
              placeholder="TXyz…"
              autoComplete="off"
              spellCheck={false}
              value={addressDraft}
              onChange={(e) => setAddressDraft(e.target.value)}
              className="font-mono text-sm border-slate-200 bg-white text-slate-900"
              disabled={savingAddress}
            />
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <Button type="button" variant="outline" className="w-full border-slate-300 sm:w-auto" asChild>
              <Link to="/user/profile#trc20-payout" onClick={() => setAddressDialogOpen(false)}>
                Open in profile
              </Link>
            </Button>
            <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
              <Button type="button" variant="ghost" onClick={() => setAddressDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={savingAddress || !addressDraft.trim()}
                className="gap-2 bg-[#FFD700] text-black hover:bg-[#E6C200]"
                onClick={handleSaveAddress}
              >
                {savingAddress ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save address
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-sans text-lg font-semibold text-slate-900">Your requests</h2>
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-neutral-900" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500">No withdrawal requests yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-4">When</th>
                  <th className="pb-2 pr-4">Amount</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">Tx / note</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="py-3 pr-4 whitespace-nowrap text-slate-600">
                      {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                    </td>
                    <td className="py-3 pr-4 font-semibold tabular-nums text-slate-900">
                      ${Number(r.amount_usd).toFixed(2)}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${
                          r.status === "completed"
                            ? "border-yellow-200 bg-[#FFF9E6] text-neutral-900"
                            : r.status === "pending"
                              ? "border-amber-200 bg-amber-50 text-amber-900"
                              : "border-red-200 bg-red-50 text-red-900"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 text-slate-600">
                      {r.status === "rejected" && r.rejection_reason ? (
                        <span className="text-sm text-red-800">{r.rejection_reason}</span>
                      ) : r.outbound_tx_hash ? (
                        <a
                          href={`https://tronscan.org/#/transaction/${encodeURIComponent(r.outbound_tx_hash)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="break-all font-mono text-xs text-neutral-800 underline"
                        >
                          {r.outbound_tx_hash}
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default WithdrawPage;
