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
  onTransferred,
}: Props) {
  const { toast } = useToast();
  const [direction, setDirection] = useState<"safe_to_trading" | "trading_to_safe">(
    "safe_to_trading",
  );
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const max =
    direction === "safe_to_trading" ? Math.max(0, safeWallet) : Math.max(0, tradingWallet);

  const submit = async () => {
    const uid = Number(userId);
    const amt = Number(amount);
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

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-lg shadow-neutral-900/5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-900">Wallets</h2>
        <p className="text-xs text-slate-500">Recharge → Safe · Trade from Trading</p>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-900">
            <TrendingUp className="h-3.5 w-3.5" />
            Trading Wallet
          </div>
          <p className="text-2xl font-extrabold tabular-nums text-slate-900">
            {currency} {fmt(tradingWallet)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">At risk · P/L applies here</p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-900">
            <Shield className="h-3.5 w-3.5" />
            Safe Wallet
          </div>
          <p className="text-2xl font-extrabold tabular-nums text-slate-900">
            {currency} {fmt(safeWallet)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">Protected · withdraw from here</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <button
          type="button"
          onClick={() => setDirection("safe_to_trading")}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
            direction === "safe_to_trading"
              ? "border-amber-300 bg-amber-50 text-amber-950"
              : "border-slate-200 text-slate-600 hover:bg-slate-50",
          )}
        >
          Safe → Trading
        </button>
        <button
          type="button"
          onClick={() => setDirection("trading_to_safe")}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
            direction === "trading_to_safe"
              ? "border-emerald-300 bg-emerald-50 text-emerald-950"
              : "border-slate-200 text-slate-600 hover:bg-slate-50",
          )}
        >
          Trading → Safe
        </button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-xs font-semibold text-slate-500">Amount</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`Max ${fmt(max)}`}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm tabular-nums focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-100"
          />
        </div>
        <Button
          type="button"
          disabled={busy || !userId}
          onClick={() => void submit()}
          className="gap-2 bg-yellow-900 text-white hover:bg-yellow-800"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeftRight className="h-4 w-4" />}
          Transfer
        </Button>
      </div>
    </div>
  );
}
