import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  History,
  Loader2,
  RefreshCw,
  Users,
  Wallet,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ListPaginationBar } from "@/components/trades/TradesPaginationBar";
import { API_BASE } from "@/config/api";

type PayableUser = {
  user_id: number;
  affiliate_balance: number;
  total_earned_usd: number;
  pending_withdrawal_count: number;
  pending_withdrawal_debit: number;
  trc20_withdraw_address: string | null;
  name: string | null;
  email: string | null;
  telegram: string | null;
  mobile: string | null;
  withdraw_fee_usd: number;
  min_payout_usd: number;
};

type PayoutRow = {
  id: number;
  user_id: number;
  payout_amount_usd: number;
  fee_usd: number;
  total_debit_usd: number;
  status: string;
  outbound_tx_hash: string | null;
  trc20_address: string | null;
  admin_initiated: boolean;
  rejection_reason: string | null;
  created_at: string;
  completed_at: string | null;
  user_name: string | null;
  user_email: string | null;
  user_telegram: string | null;
};

function fmt(n: number | string | null | undefined) {
  return Number(n ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function userLabel(row: { user_id: number; name?: string | null; telegram?: string | null; email?: string | null }) {
  const parts = [
    row.telegram ? `@${String(row.telegram).replace(/^@/, "")}` : null,
    row.name,
    row.email,
    `#${row.user_id}`,
  ].filter(Boolean);
  return parts[0] ?? `#${row.user_id}`;
}

function statusClass(s: string) {
  const x = String(s).toLowerCase();
  if (x === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (x === "pending" || x === "processing") return "border-amber-200 bg-amber-50 text-amber-900";
  if (x === "rejected" || x === "failed" || x === "cancelled") return "border-red-200 bg-red-50 text-red-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

const AdminReferralPayablePage = () => {
  const { toast } = useToast();
  const [tab, setTab] = useState<"balances" | "history">("balances");

  const [users, setUsers] = useState<PayableUser[]>([]);
  const [totalPayable, setTotalPayable] = useState(0);
  const [userCount, setUserCount] = useState(0);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersPage, setUsersPage] = useState(1);
  const usersPageSize = 50;

  const [history, setHistory] = useState<PayoutRow[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyFilter, setHistoryFilter] = useState<"all" | "completed" | "pending" | "processing" | "rejected">("all");
  const historyPageSize = 50;

  const [payOpen, setPayOpen] = useState(false);
  const [payUser, setPayUser] = useState<PayableUser | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [paySendOnChain, setPaySendOnChain] = useState(true);
  const [payTxHash, setPayTxHash] = useState("");
  const [payNote, setPayNote] = useState("");
  const [payBusy, setPayBusy] = useState(false);

  const loadUsers = useCallback(async (pageNum = 1) => {
    setUsersLoading(true);
    try {
      const qs = new URLSearchParams({
        limit: String(usersPageSize),
        offset: String((pageNum - 1) * usersPageSize),
      });
      const res = await fetch(`${API_BASE}/admin/referral-payable/users?${qs}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to load");
      setUsers(data.users ?? []);
      setTotalPayable(Number(data.total_payable_usd ?? 0));
      setUserCount(Number(data.user_count ?? 0));
      setUsersPage(pageNum);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Could not load referral balances",
        variant: "destructive",
      });
    } finally {
      setUsersLoading(false);
    }
  }, [toast]);

  const loadHistory = useCallback(async (pageNum = 1) => {
    setHistoryLoading(true);
    try {
      const qs = new URLSearchParams({
        limit: String(historyPageSize),
        offset: String((pageNum - 1) * historyPageSize),
      });
      if (historyFilter !== "all") qs.set("status", historyFilter);
      const res = await fetch(`${API_BASE}/admin/referral-payable/history?${qs}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to load history");
      setHistory(data.payouts ?? []);
      setHistoryTotal(Number(data.total ?? 0));
      setHistoryPage(pageNum);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Could not load payout history",
        variant: "destructive",
      });
    } finally {
      setHistoryLoading(false);
    }
  }, [historyFilter, toast]);

  useEffect(() => {
    if (tab === "balances") void loadUsers(usersPage);
  }, [tab, loadUsers, usersPage]);

  useEffect(() => {
    if (tab === "history") void loadHistory(historyPage);
  }, [tab, loadHistory, historyPage]);

  const payFee = payUser?.withdraw_fee_usd ?? 5;
  const payMin = payUser?.min_payout_usd ?? 10;
  const payAmountNum = Number(payAmount);
  const payTotalDebit = useMemo(
    () => (Number.isFinite(payAmountNum) && payAmountNum > 0 ? payAmountNum + payFee : 0),
    [payAmountNum, payFee],
  );

  const openPay = (row: PayableUser) => {
    const maxPayout = Math.max(0, row.affiliate_balance - payFee);
    setPayUser(row);
    setPayAmount(maxPayout >= payMin ? String(Math.floor(maxPayout * 100) / 100) : "");
    setPaySendOnChain(true);
    setPayTxHash("");
    setPayNote("");
    setPayOpen(true);
  };

  const submitPay = async () => {
    if (!payUser) return;
    setPayBusy(true);
    try {
      const res = await fetch(`${API_BASE}/admin/referral-payable/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: payUser.user_id,
          amount: payAmountNum,
          sendOnChain: paySendOnChain,
          outbound_tx_hash: payTxHash.trim() || undefined,
          note: payNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Payment failed");
      }
      toast({
        title: "Referral payout sent",
        description: `$${fmt(data.payoutAmount)} to ${userLabel(payUser)}${data.txHash ? ` · TX ${data.txHash.slice(0, 10)}…` : ""}`,
      });
      setPayOpen(false);
      setPayUser(null);
      await Promise.all([loadUsers(usersPage), loadHistory(1)]);
      setTab("history");
      setHistoryPage(1);
    } catch (err) {
      toast({
        title: "Payment failed",
        description: err instanceof Error ? err.message : "Could not pay user",
        variant: "destructive",
      });
    } finally {
      setPayBusy(false);
    }
  };

  const refresh = () => {
    if (tab === "balances") void loadUsers(usersPage);
    else void loadHistory(historyPage);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/admin/financial-stats"
            className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft size={16} />
            Financial stats
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Referral payable</h1>
          <p className="mt-1 text-sm text-slate-500">
            Affiliate wallet balances owed to referrers — pay out and track history.
          </p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={usersLoading || historyLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${usersLoading || historyLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Total payable now</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-blue-900">${fmt(totalPayable)}</p>
          <p className="mt-1 text-xs text-blue-700">{userCount} user{userCount === 1 ? "" : "s"} with balance</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payout fee</p>
          <p className="mt-2 text-lg font-semibold text-slate-800">${fmt(payFee)} per withdrawal (from affiliate wallet)</p>
          <p className="mt-1 text-xs text-slate-500">Minimum payout ${payMin} USDT to user address on profile.</p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setTab("balances")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
            tab === "balances"
              ? "border-[#FFD700] text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Users size={16} />
          Balances
        </button>
        <button
          type="button"
          onClick={() => setTab("history")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
            tab === "history"
              ? "border-[#FFD700] text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <History size={16} />
          Payout history
        </button>
      </div>

      {tab === "balances" && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {usersLoading ? (
            <div className="flex justify-center py-16 text-slate-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading balances…
            </div>
          ) : users.length === 0 ? (
            <div className="py-16 text-center text-slate-500">No referral wallet balances to pay.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3 text-right">Affiliate balance</th>
                      <th className="px-4 py-3 text-right">Lifetime earned</th>
                      <th className="px-4 py-3">Payout address</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((row) => {
                      const hasAddress = Boolean(row.trc20_withdraw_address?.trim());
                      const pending = row.pending_withdrawal_count > 0;
                      const maxPayout = Math.max(0, row.affiliate_balance - row.withdraw_fee_usd);
                      const canPay = hasAddress && !pending && maxPayout >= row.min_payout_usd;
                      return (
                        <tr key={row.user_id} className="hover:bg-slate-50/80">
                          <td className="px-4 py-3">
                            <Link
                              to={`/admin/user-profile/${row.user_id}`}
                              className="font-medium text-slate-900 hover:underline"
                            >
                              {userLabel(row)}
                            </Link>
                            {pending && (
                              <p className="mt-0.5 text-xs text-amber-700">Pending withdrawal in queue</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums text-blue-800">
                            ${fmt(row.affiliate_balance)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                            ${fmt(row.total_earned_usd)}
                          </td>
                          <td className="px-4 py-3">
                            {hasAddress ? (
                              <code className="text-xs text-slate-600">{row.trc20_withdraw_address}</code>
                            ) : (
                              <span className="text-xs text-red-600">No TRC20 address on profile</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              size="sm"
                              disabled={!canPay}
                              onClick={() => openPay(row)}
                              className="bg-[#FFD700] text-black hover:bg-[#E6C200]"
                            >
                              <Wallet className="mr-1 h-4 w-4" />
                              Pay
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <ListPaginationBar
                page={usersPage}
                pageSize={usersPageSize}
                total={userCount}
                onPageChange={setUsersPage}
              />
            </>
          )}
        </div>
      )}

      {tab === "history" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(["all", "completed", "pending", "processing", "rejected"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setHistoryFilter(s);
                  setHistoryPage(1);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${
                  historyFilter === s
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {historyLoading ? (
              <div className="flex justify-center py-16 text-slate-500">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading history…
              </div>
            ) : history.length === 0 ? (
              <div className="py-16 text-center text-slate-500">No affiliate payout records yet.</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px] text-sm">
                    <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">User</th>
                        <th className="px-4 py-3 text-right">Payout</th>
                        <th className="px-4 py-3 text-right">Fee</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">TX</th>
                        <th className="px-4 py-3">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {history.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50/80">
                          <td className="px-4 py-3 text-slate-600">
                            {new Date(row.completed_at || row.created_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              to={`/admin/user-profile/${row.user_id}`}
                              className="font-medium text-slate-900 hover:underline"
                            >
                              {userLabel(row)}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-right font-medium tabular-nums">
                            ${fmt(row.payout_amount_usd)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                            ${fmt(row.fee_usd)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${statusClass(row.status)}`}>
                              {row.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {row.outbound_tx_hash ? (
                              <a
                                href={`https://tronscan.org/#/transaction/${row.outbound_tx_hash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline"
                              >
                                {row.outbound_tx_hash.slice(0, 12)}…
                              </a>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {row.admin_initiated ? "Admin" : "User request"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ListPaginationBar
                  page={historyPage}
                  pageSize={historyPageSize}
                  total={historyTotal}
                  onPageChange={setHistoryPage}
                />
              </>
            )}
          </div>
        </div>
      )}

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pay referral balance</DialogTitle>
            <DialogDescription>
              {payUser ? (
                <>
                  Pay <strong>{userLabel(payUser)}</strong> from their affiliate wallet. Available: $
                  {fmt(payUser.affiliate_balance)} (fee ${fmt(payFee)} deducted from wallet).
                </>
              ) : (
                "Send USDT to the user’s profile TRC20 address."
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="pay-amount">Payout amount (USDT)</Label>
              <Input
                id="pay-amount"
                type="number"
                min={payMin}
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="mt-1"
              />
              <p className="mt-1 text-xs text-slate-500">
                Wallet debit: ${fmt(payTotalDebit)} (incl. ${fmt(payFee)} fee) · Min payout ${payMin}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="pay-onchain"
                type="checkbox"
                checked={paySendOnChain}
                onChange={(e) => setPaySendOnChain(e.target.checked)}
                className="rounded border-slate-300"
              />
              <Label htmlFor="pay-onchain" className="font-normal">
                Send USDT on-chain automatically
              </Label>
            </div>

            {!paySendOnChain && (
              <div>
                <Label htmlFor="pay-tx">Outbound transaction hash</Label>
                <Input
                  id="pay-tx"
                  value={payTxHash}
                  onChange={(e) => setPayTxHash(e.target.value)}
                  placeholder="Required if not sending automatically"
                  className="mt-1 font-mono text-xs"
                />
              </div>
            )}

            <div>
              <Label htmlFor="pay-note">Note (optional)</Label>
              <Textarea
                id="pay-note"
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                rows={2}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)} disabled={payBusy}>
              Cancel
            </Button>
            <Button
              onClick={submitPay}
              disabled={
                payBusy ||
                !payUser ||
                !Number.isFinite(payAmountNum) ||
                payAmountNum < payMin ||
                payTotalDebit > (payUser?.affiliate_balance ?? 0) + 0.01 ||
                (!paySendOnChain && !payTxHash.trim())
              }
              className="bg-[#FFD700] text-black hover:bg-[#E6C200]"
            >
              {payBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Confirm payout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminReferralPayablePage;
