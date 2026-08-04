import { useState } from "react";
import { ArrowLeftRight, Loader2, Shield, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { API_BASE } from "@/config/api";
import { useToast } from "@/hooks/use-toast";

type Direction = "safe_to_trading" | "trading_to_safe";

type Props = {
  userId: string | number | undefined;
  tradingWallet: number;
  safeWallet: number;
  currency?: string;
  /** True while copy-trading is active (not exited). */
  tradingActive?: boolean;
  /** Open / live positions — blocks Trading → Safe while trading is active. */
  openPositionCount?: number;
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
  tradingActive = false,
  openPositionCount = 0,
  onTransferred,
}: Props) {
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [direction, setDirection] = useState<Direction>("safe_to_trading");

  // Safe → Trading: always allowed.
  // Trading → Safe: only when stopped OR no live open trades.
  const tradingToSafeAllowed = tradingActive !== true || openPositionCount <= 0;
  const transferLocked = direction === "trading_to_safe" && !tradingToSafeAllowed;
  const max =
    direction === "safe_to_trading" ? Math.max(0, safeWallet) : Math.max(0, tradingWallet);

  const submit = async () => {
    const uid = Number(userId);
    const amt = Number(amount);
    if (transferLocked) {
      toast({
        title: "Live trades open",
        description:
          "Exit pool first, or wait until all trades are settled before moving Trading → Safe.",
        variant: "destructive",
      });
      return;
    }
    if (!uid || !(amt > 0)) {
      toast({
        title: "Enter an amount",
        description:
          direction === "safe_to_trading"
            ? "Choose how much to move into Trading."
            : "Choose how much to move into Safe.",
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
        description:
          direction === "safe_to_trading"
            ? `Moved ${fmt(amt)} to Trading.`
            : `Moved ${fmt(amt)} to Safe.`,
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
          Recharge → Safe · Safe ↔ Trading
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
        </div>

        <div className="flex w-full shrink-0 flex-col items-center justify-center px-0 sm:w-[11.5rem] sm:px-1">
          <Select
            value={direction}
            onValueChange={(value) => {
              setDirection(value as Direction);
              setAmount("");
            }}
          >
            <SelectTrigger
              aria-label="Transfer direction"
              className="h-9 w-full rounded-xl border-slate-200 bg-slate-50 text-left text-[11px] font-semibold text-slate-800 shadow-none focus:ring-yellow-200 sm:h-10 sm:text-xs"
            >
              <SelectValue placeholder="Select direction" />
            </SelectTrigger>
            <SelectContent align="center" className="rounded-xl">
              <SelectItem value="safe_to_trading" className="text-xs font-medium">
                Trading ← Safe
              </SelectItem>
              <SelectItem
                value="trading_to_safe"
                className="text-xs font-medium"
                disabled={!tradingToSafeAllowed}
              >
                Trading → Safe
              </SelectItem>
            </SelectContent>
          </Select>
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
          Live trades are open — Exit pool first, or wait until all trades settle, then move
          Trading → Safe. Safe → Trading still works anytime.
        </p>
      ) : direction === "safe_to_trading" ? (
        <p className="mb-2 text-[10px] text-slate-500 sm:text-[11px]">
          Move funds from Safe into Trading anytime — even while trades are open.
        </p>
      ) : (
        <p className="mb-2 text-[10px] text-slate-500 sm:text-[11px]">
          Move Trading → Safe when you have no live trades, or after Exit pool.
        </p>
      )}

      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <label className="mb-0.5 block text-[9px] font-semibold uppercase tracking-wide text-slate-500 sm:text-[10px]">
            {direction === "safe_to_trading" ? "Amount to Trading" : "Amount to Safe"}
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
