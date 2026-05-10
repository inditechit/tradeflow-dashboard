import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownToLine, Loader2, Wallet } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const API_BASE = "https://mt5api.inditechit.com/api";
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

  const [balance, setBalance] = useState<number | null>(null);
  const [payoutSaved, setPayoutSaved] = useState("");
  const [amount, setAmount] = useState("");
  const [rows, setRows] = useState<WithdrawRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [wRes, pRes, rRes] = await Promise.all([
        fetch(`${API_BASE}/user/wallet/${userId}`),
        fetch(`${API_BASE}/user/profile/${userId}`),
        fetch(`${API_BASE}/user/withdraw/${userId}`),
      ]);
      const wData = await wRes.json();
      if (wData.success && wData.wallet) {
        setBalance(Number(wData.wallet.balance ?? 0));
      } else {
        setBalance(0);
      }
      const pData = await pRes.json();
      if (pData.success && pData.profile) {
        setPayoutSaved(String(pData.profile.trc20WithdrawAddress ?? "").trim());
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
  }, [userId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async () => {
    if (!userId) return;
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < MIN_WITHDRAW) {
      toast({
        title: "Invalid amount",
        description: `Minimum withdrawal is ${MIN_WITHDRAW} USD.`,
        variant: "destructive",
      });
      return;
    }
    if (balance != null && amt > balance) {
      toast({ title: "Insufficient balance", variant: "destructive" });
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
          description: "An admin will review and pay USDT TRC20 to your saved address.",
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

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-0 py-4 sm:px-2 md:px-6 md:py-10">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 sm:text-2xl">
          <ArrowDownToLine className="h-7 w-7 text-cyan-600" aria-hidden />
          Withdraw USDT (TRC20)
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Request a withdrawal from your in-app USD wallet. After approval, we send <strong className="font-medium text-slate-800">USDT on TRC20</strong> to the address saved in your profile.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2 text-slate-700">
            <Wallet className="h-5 w-5 text-cyan-600" />
            <span className="text-sm font-medium">Wallet balance</span>
          </div>
          <p className="text-2xl font-bold tabular-nums text-slate-900">
            {loading ? "…" : `USD ${(balance ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-700">Saved TRC20 address</p>
            {payoutSaved ? (
              <p className="mt-1 break-all font-mono text-sm text-slate-800">{payoutSaved}</p>
            ) : (
              <p className="mt-1 text-sm text-amber-800">
                You have not saved a payout address yet.{" "}
                <Link to="/user/profile" className="font-semibold text-cyan-700 underline">
                  Add it in Profile
                </Link>
                .
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="wd-amt" className="text-black">Amount (USD)</Label>
            <Input
              id="wd-amt"
              type="number"
              min={MIN_WITHDRAW}
              step="0.01"
              placeholder={`Min ${MIN_WITHDRAW}`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="max-w-xs border-slate-200 bg-white text-slate-900"
              disabled={loading || submitting || !payoutSaved}
            />
          </div>

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={loading || submitting || !payoutSaved || !amount}
            className="gap-2 bg-cyan-600 text-white hover:bg-cyan-700"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Submit withdrawal request
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-sans text-lg font-semibold text-slate-900">Your requests</h2>
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
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
                            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
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
                          className="break-all font-mono text-xs text-cyan-700 underline"
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
