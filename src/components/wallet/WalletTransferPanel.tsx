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
  /** When true, transfers are disabled until the user stops trading. */
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
  tradingActive = false,
  onTransferred,
}: Props) {
  const { toast } = useToast();
  const [direction, setDirection] = useState<"safe_to_trading" | "trading_to_safe">(
    "safe_to_trading",
  );
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const transferLocked = tradingActive === true;
  const max =
    direction === "safe_to_trading" ? Math.max(0, safeWallet) : Math.max(0, tradingWallet);

  const submit = async () => {
    const uid = Number(userId);
    const amt = Number(amount);
    if (transferLocked) {
      toast({
        title: "Trading is active",
        description: "Stop trading first, then transfer between wallets.",
        variant: "destructive",
      });
      return;
    }
    if (!uid || !(amt > 0)) {
      toast({
        title: "Enter an amount",
        description: "Choose how much to move between wallets.",
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
            ? `Moved ${fmt(amt)} to Trading Wallet.`
            : `Moved ${fmt(amt)} to Safe Wallet.`,
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

  const directionToggle = (
    <div className="flex shrink-0 flex-col items-center justify-center gap-1.5 px-1">
      <button
        type="button"
        disabled={transferLocked}
        onClick={() => setDirection("safe_to_trading")}
        className={cn(
          "whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition sm:px-3",
          transferLocked && "cursor-not-allowed opacity-50",
          direction === "safe_to_trading"
            ? "border-amber-300 bg-amber-50 text-amber-950"
            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
        )}
      >
        Trading ← Safe
      </button>
      <button
        type="button"
        disabled={transferLocked}
        onClick={() => setDirection("trading_to_safe")}
        className={cn(
          "whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition sm:px-3",
          transferLocked && "cursor-not-allowed opacity-50",
          direction === "trading_to_safe"
            ? "border-emerald-300 bg-emerald-50 text-emerald-950"
            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
        )}
      >
        Trading → Safe
      </button>
    </div>
  );

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-md shadow-neutral-900/5 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-900 sm:text-base">Wallets</h2>
        <p className="text-[10px] text-slate-500 sm:text-xs">Recharge → Safe · Trade from Trading</p>
      </div>

      {/* Trading | transfer buttons | Safe */}
      <div className="mb-3 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-2">
        <div className="min-w-0 flex-1 rounded-xl border border-amber-100 bg-amber-50/50 px-3 py-2.5">
          <div className="mb-0.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
            <TrendingUp className="h-3 w-3" />
            Trading
          </div>
          <p className="text-xl font-extrabold tabular-nums text-slate-900 sm:text-2xl">
            {currency} {fmt(tradingWallet)}
          </p>
        </div>

        <div className="flex justify-center sm:contents">{directionToggle}</div>

        <div className="min-w-0 flex-1 rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2.5">
          <div className="mb-0.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-900">
            <Shield className="h-3 w-3" />
            Safe
          </div>
          <p className="text-xl font-extrabold tabular-nums text-slate-900 sm:text-2xl">
            {currency} {fmt(safeWallet)}
          </p>
        </div>
      </div>

      {transferLocked ? (
        <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-950">
          Stop trading to unlock transfers.
        </p>
      ) : null}

      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Amount
          </label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={amount}
            disabled={transferLocked}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`Max ${fmt(max)}`}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm tabular-nums focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60"
          />
        </div>
        <Button
          type="button"
          disabled={busy || !userId || transferLocked}
          onClick={() => void submit()}
          className="h-[38px] shrink-0 gap-1.5 bg-yellow-900 px-3 text-white hover:bg-yellow-800"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeftRight className="h-4 w-4" />}
          Transfer
        </Button>
      </div>
    </div>
  );
}
