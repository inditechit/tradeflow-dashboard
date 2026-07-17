import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_BASE } from "@/config/api";
import { ListPaginationBar } from "@/components/trades/TradesPaginationBar";

const PAYMENTS_PAGE_SIZE = 50;
const LEDGER_PAGE_SIZE = 50;

const UserTransactions = () => {
  const { toast } = useToast();

  const [payments, setPayments] = useState([]);
  const [paymentsTotal, setPaymentsTotal] = useState(0);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [ledger, setLedger] = useState<
    { id: number; delta_usd: string | number; balance_after: string | number; entry_type: string; note: string | null; created_at: string }[]
  >([]);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [error, setError] = useState("");

  const userData = JSON.parse(localStorage.getItem("mt5_user"));
  const userId = userData?.userId;

  const fetchLedger = useCallback(async (pageNum = 1) => {
    if (!userId) return;
    setLedgerLoading(true);
    try {
      const offset = (pageNum - 1) * LEDGER_PAGE_SIZE;
      const res = await fetch(
        `${API_BASE}/user/wallet/ledger/${userId}?limit=${LEDGER_PAGE_SIZE}&offset=${offset}`,
      );
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setLedger(data.data);
        setLedgerTotal(Number(data.total ?? data.data.length));
        setLedgerPage(pageNum);
      } else {
        setLedger([]);
        setLedgerTotal(0);
      }
    } catch {
      setLedger([]);
      setLedgerTotal(0);
    } finally {
      setLedgerLoading(false);
    }
  }, [userId]);

  const fetchPayments = useCallback(async (pageNum = 1) => {
    if (!userId) return;

    setLoading(true);
    setError("");

    try {
      const offset = (pageNum - 1) * PAYMENTS_PAGE_SIZE;
      const res = await fetch(
        `${API_BASE}/user/payments/${userId}?limit=${PAYMENTS_PAGE_SIZE}&offset=${offset}&page=${pageNum}`,
      );

      if (!res.ok) {
        throw new Error("API not reachable");
      }

      const data = await res.json();

      if (data.success) {
        setPayments(data.data ?? []);
        setPaymentsTotal(Number(data.total ?? data.data?.length ?? 0));
        setPaymentsPage(pageNum);
      } else {
        setError("Failed to fetch payments");
      }
    } catch (err) {
      console.error(err);
      setError("Server error");

      toast({
        title: "Error ❌",
        description: "Unable to fetch payments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    void fetchPayments(1);
    void fetchLedger(1);
  }, [userId, fetchPayments, fetchLedger]);
  const formatDate = (date) => {
    return new Date(date).toLocaleString();
  };


  const getStatusStyle = (status) => {
    switch (status) { 
      case "pending":
        return "bg-yellow-50 text-yellow-600 border-yellow-200";
      case "success":
        return "bg-green-50 text-green-600 border-green-200";
      case "failed":
        return "bg-red-50 text-red-600 border-red-200";
      default:
        return "bg-slate-50 text-slate-600 border-slate-200";
    }
  };

  return (
    <div className="max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-black">Transactions</h1>
        </div>

        <button
          type="button"
          onClick={() => {
            void fetchPayments(paymentsPage);
            void fetchLedger(ledgerPage);
          }}
          disabled={loading && ledgerLoading}
          className="flex items-center gap-2 rounded-xl bg-[#FFD700] px-5 py-2.5 font-bold text-black transition hover:bg-[#E6C200] disabled:opacity-50"
        >
          <RefreshCw size={18} className={loading || ledgerLoading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600">
          {error}
        </div>
      )}

      {/* Empty State */}
      {!loading && payments.length === 0 && paymentsTotal === 0 && (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-12">
          <div className="text-center">
            <div className="text-slate-400 text-6xl mb-4">📄</div>
            <p className="text-slate-600 font-medium text-lg">No transaction history found</p>
          </div>
        </div>
      )}

      {/* Table */}
      {!loading && payments.length > 0 && (
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">

            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="px-6 py-4 text-xs font-bold text-slate-500">Payment ID</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500">Amount</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500">Transaction ID</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500">Method</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500">Package</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500">Date</th>
              </tr>
            </thead>

            <tbody>
              {!loading && payments.map((p) => (
                <tr key={p.id} className="hover:bg-yellow-50/50 transition">

                  {/* ID */}
                  <td className="px-6 py-4 font-bold text-slate-600">
                    {p.id}
                  </td>

                  {/* Amount */}
                  <td className="px-6 py-4 text-sm font-semibold text-yellow-700">
                    {p.payment_method === "INR"
                      ? `₹${parseFloat(p.amount).toFixed(0)}`
                      : `$${parseFloat(p.amount).toFixed(0)}`}
                  </td>

                  {/* Transaction ID */}
                  <td className="px-6 py-4 text-xs text-slate-600 flex items-center gap-2">
                    <span className="font-mono">
                      {p.tx_hash ? p.tx_hash.slice(0, 10) + "..." : "N/A"}
                    </span>

                    {p.tx_hash && (
                      <button
                        onClick={() => navigator.clipboard.writeText(p.tx_hash)}
                        className="text-neutral-900 hover:text-neutral-900 text-xs"
                        title="Copy full TXN"
                      >
                        Copy
                      </button>
                    )}
                  </td>

                  {/* Method */}
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {p.payment_method}
                  </td>

                  {/* Package */}
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {p.package_name}
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 text-xs rounded-lg border ${getStatusStyle(p.status)}`}>
                      {p.status}
                    </span>
                  </td>

                  {/* Date */}
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {formatDate(p.created_at)}
                  </td>

                </tr>
              ))}
            </tbody>

          </table>
        </div>
        <ListPaginationBar
          page={paymentsPage}
          totalPages={Math.max(1, Math.ceil(paymentsTotal / PAYMENTS_PAGE_SIZE))}
          total={paymentsTotal}
          pageSize={PAYMENTS_PAGE_SIZE}
          onPageChange={(p) => void fetchPayments(p)}
          itemLabel="payments"
        />
      </div>
      )}

      <div className="mt-12">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-800">Wallet</h2>
          {ledgerTotal > 0 && (
            <span className="text-xs text-slate-400">{ledgerTotal.toLocaleString()} entries</span>
          )}
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Newest first in apply order. Recharges always post as their own row — if the balance drops
          right after, the next lines are trading fees/settlements, not a missing recharge.
          Account balance must match the top Balance after row.
        </p>
        {ledgerLoading && ledger.length === 0 ? (
          <p className="py-8 text-center text-slate-400">Loading wallet log…</p>
        ) : ledger.length === 0 ? (
          <p className="rounded-2xl border border-slate-100 bg-white py-8 text-center text-slate-500">
            No wallet movements yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">When</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Type</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Change</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Balance after</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ledger.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 text-slate-600">{formatDate(row.created_at)}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{row.entry_type}</td>
                      <td
                        className={`px-4 py-3 font-semibold tabular-nums ${
                          Number(row.delta_usd) >= 0 ? "text-emerald-700" : "text-red-600"
                        }`}
                      >
                        {Number(row.delta_usd) >= 0 ? "+" : ""}
                        {Number(row.delta_usd).toFixed(2)} USD
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-700">
                        {Number(row.balance_after).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ListPaginationBar
              page={ledgerPage}
              totalPages={Math.max(1, Math.ceil(ledgerTotal / LEDGER_PAGE_SIZE))}
              total={ledgerTotal}
              pageSize={LEDGER_PAGE_SIZE}
              onPageChange={(p) => void fetchLedger(p)}
              itemLabel="entries"
            />
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="py-10 text-center text-slate-400">Loading payments...</div>
      )}
    </div>
  );
};

export default UserTransactions;