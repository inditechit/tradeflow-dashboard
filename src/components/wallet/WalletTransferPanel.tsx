import { useState } from "react";
import { ArrowLeftRight, Loader2, Shield, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { API_BASE } from "@/config/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Props = {
  userId: string | number | undefined;
  tradingWallet: number;
  safeWallet: number;
  currency?: string;
  /** Estimated admin share if user Settles now (vs settle baseline). */
  adminPendingShare?: number;
  /** User profit-share % (e.g. 50). */
  userSharePct?: number;
  /** When true, transfers are disabled until the user Settles. */
  tradingActive?: boolean;
  onTransferred?: () => void;
};

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Trading (at-risk) ↔ Safe (protected) transfer panel for the user dashboard. */
export function WalletTransferPanel({
  userId,
  tradingWallet,
  safeWallet,
  currency = "USD",
  adminPendingShare = 0,
  userSharePct = 50,
  tradingActive = false,
  onTransferred,
}: Props) {
  const adminPct = Math.round((100 - Math.min(100, Math.max(0, userSharePct || 50))) * 100) / 100;
  const estAdminOnSettle = Math.max(0, Number(adminPendingShare) || 0);
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  // Only Safe→Trading is allowed; Trading→Safe happens via Settle Trade (admin cut).
  const direction = "safe_to_trading" as const;
  const transferLocked = tradingActive === true;
  const max = Math.max(0, safeWallet);

  const submit = async () => {
    const uid = Number(userId);
    const amt = Number(amount);
    if (transferLocked) {
      toast({
        title: "Trading is active",
        description: "Settle Trade first, then transfer Safe → Trading.",
        variant: "destructive",
      });
      return;
    }
    if (!uid || !(amt > 0)) {
      toast({
        title: "Enter an amount",
        description: "Choose how much to move into Trading.",
        variant: "destructive",
      });
      return;
    }
    if (amt > max + 0.001) {
      toast({
        title: "Not enough balance",
        description: `Max available is ${currency} ${fmt(max)}.`,
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/user/wallet/transfer/${uid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction, amount: amt }),
      });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || "Transfer failed");
      toast({
        title: "Transfer complete",
        description: `Moved ${fmt(amt)} to Trading. This sets your settle baseline.`,
      });
      setAmount("");
      onTransferred?.();
    } catch (err) {
      toast({
        title: "Transfer failed",
        description: err instanceof Error ? err.message : "Could not move funds",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-2.5 shadow-md shadow-neutral-900/5 sm:rounded-2xl sm:p-4">
      <div className="mb-2 flex items-center justify-between gap-2 sm:mb-3">
        <h2 className="text-xs font-bold text-slate-900 sm:text-base">Wallets</h2>
        <p className="text-[9px] text-slate-500 sm:text-xs">
          Recharge → Safe · Settle moves Trading → Safe
        </p>
      </div>

      <div className="mb-2 flex flex-col items-stretch gap-1.5 sm:mb-3 sm:flex-row sm:items-center sm:gap-2">
        <div className="min-w-0 flex-1 rounded-xl border border-amber-100 bg-amber-50/50 px-2.5 py-2 sm:px-3 sm:py-2.5">
          <div className="mb-0.5 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wide text-amber-900 sm:text-[10px]">
            <TrendingUp className="h-3 w-3" />
            Trading
          </div>
          <p className="text-lg font-extrabold tabular-nums text-slate-900 sm:text-2xl">
            {currency} {fmt(tradingWallet)}
          </p>
          {estAdminOnSettle > 0.01 ? (
            <p className="mt-0.5 text-[9px] leading-snug text-amber-900/80 sm:mt-1 sm:text-[10px]">
              Est. admin on Settle (~{adminPct}%): {currency} {fmt(estAdminOnSettle)}
            </p>
          ) : (
            <p className="mt-0.5 text-[9px] leading-snug text-slate-500 sm:mt-1 sm:text-[10px]">
              No admin cut while at/below baseline
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-center justify-center gap-1 px-1">
          <span className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-950">
            Trading ← Safe
          </span>
        </div>

        <div className="min-w-0 flex-1 rounded-xl border border-emerald-100 bg-emerald-50/50 px-2.5 py-2 sm:px-3 sm:py-2.5">
          <div className="mb-0.5 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-900 sm:text-[10px]">
            <Shield className="h-3 w-3" />
            Safe
          </div>
          <p className="text-lg font-extrabold tabular-nums text-slate-900 sm:text-2xl">
            {currency} {fmt(safeWallet)}
          </p>
        </div>
      </div>

      {transferLocked ? (
        <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] text-amber-950 sm:px-2.5 sm:text-[11px]">
          Settle Trade to unlock Safe → Trading transfers. Trading → Safe only happens on Settle
          (admin share on profit).
        </p>
      ) : (
        <p className="mb-2 text-[10px] text-slate-500 sm:text-[11px]">
          Amount you move into Trading becomes your settle baseline. Admin takes ~{adminPct}% of
          profit above that baseline only when you Settle Trade — not on withdraw.
        </p>
      )}

      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <label className="mb-0.5 block text-[9px] font-semibold uppercase tracking-wide text-slate-500 sm:text-[10px]">
            Amount to Trading
          </label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={amount}
            disabled={transferLocked}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`Max ${fmt(max)}`}
            className="w-full rounded-xl border border-slate-200 px-2.5 py-1.5 text-sm tabular-nums focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60 sm:px-3 sm:py-2"
          />
        </div>
        <Button
          type="button"
          disabled={busy || !userId || transferLocked}
          onClick={() => void submit()}
          className="h-9 shrink-0 gap-1.5 bg-yellow-900 px-2.5 text-sm text-white hover:bg-yellow-800 sm:h-[38px] sm:px-3"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeftRight className="h-4 w-4" />}
          Transfer
        </Button>
      </div>
    </div>
  );
}
