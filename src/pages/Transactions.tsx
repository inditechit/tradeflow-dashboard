import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_BASE } from "@/config/api";
import { ListPaginationBar } from "@/components/trades/TradesPaginationBar";

const PAGE_SIZE = 100;

type Payment = {
  id: number;
  user_id: number;
  name?: string;
  email?: string;
  mobile?: string;
  amount: number;
  status: string;
  tx_hash?: string;
  package_id: string;
  payment_method: string;
  sweep_status?: string;
  created_at: string;
};

const Transactions = () => {
  const { toast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchPayments = useCallback(
    async (pageNum = 1) => {
      setLoading(true);
      setError("");
      try {
        const offset = (pageNum - 1) * PAGE_SIZE;
        const res = await fetch(
          `${API_BASE}/admin/payments?limit=${PAGE_SIZE}&offset=${offset}&page=${pageNum}`,
        );
        const data = await res.json();
        if (data.success) {
          setPayments(data.payments ?? []);
          setTotal(Number(data.total ?? 0));
          setPage(pageNum);
        } else {
          setError("Failed to fetch transactions");
        }
      } catch {
        setError("Server error");
        toast({
          title: "Error",
          description: "Unable to fetch transactions",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    void fetchPayments(1);
  }, [fetchPayments]);

  const formatDate = (date: string) => new Date(date).toLocaleString();

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-50 text-yellow-600 border-yellow-200";
      case "success":
        return "bg-[#FFF9E6] text-yellow-700 border-yellow-200";
      case "failed":
        return "bg-red-50 text-red-600 border-red-200";
      default:
        return "bg-slate-50 text-slate-600 border-slate-200";
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl text-black font-bold">Transactions</h1>
          <p className="text-slate-500 text-sm">Monitor all payment activities</p>
          {total > 0 && (
            <p className="mt-1 text-xs text-slate-400">{total.toLocaleString()} payments total</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void fetchPayments(page)}
          disabled={loading}
          className="px-5 py-2.5 rounded-xl bg-[#FFD700] text-black font-bold hover:bg-[#E6C200] transition flex items-center gap-2"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600">{error}</div>
      )}

      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="px-6 py-4 text-xs font-bold text-slate-500">Payment ID</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500">User</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500">Email</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500">Phone</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500">Amount</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500">Method</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500">Package</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500">Sweep</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500">Created</th>
              </tr>
            </thead>
            <tbody>
              {loading && payments.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-slate-400">
                    Loading…
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-slate-500">
                    No transactions found
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="hover:bg-yellow-50/50 transition">
                    <td className="px-6 py-4 font-bold text-slate-600">{p.id}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{p.name ?? p.user_id}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{p.email ?? "—"}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{p.mobile ?? "—"}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-yellow-700">
                      {p.payment_method === "INR"
                        ? `₹${parseFloat(String(p.amount)).toFixed(0)}`
                        : `$${parseFloat(String(p.amount)).toFixed(0)}`}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{p.payment_method}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{p.package_id}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 text-xs rounded-lg border ${getStatusStyle(p.status)}`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{p.sweep_status ?? "—"}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{formatDate(p.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <ListPaginationBar
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={PAGE_SIZE}
          onPageChange={(p) => void fetchPayments(p)}
          itemLabel="payments"
        />
      </div>
    </div>
  );
};

export default Transactions;
