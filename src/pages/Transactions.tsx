import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarRange, RefreshCw } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { API_BASE } from "@/config/api";
import { ListPaginationBar } from "@/components/trades/TradesPaginationBar";

const PAGE_SIZE = 100;

const PACKAGE_OPTIONS = [
  { id: "7-day-trial", label: "7-day trial" },
  { id: "1-month", label: "1 month" },
  { id: "3-month", label: "3 month" },
  { id: "6-month", label: "6 month" },
  { id: "1-year", label: "1 year" },
  { id: "india-tour", label: "India tour" },
  { id: "intl-tour", label: "International tour" },
  { id: "meet-guru", label: "Meet guru" },
];

const METHOD_OPTIONS = ["USDT", "INR", "WALLET", "TRIAL"];

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

type PaymentFilters = {
  q: string;
  paymentId: string;
  userId: string;
  status: string;
  packageId: string;
  method: string;
  dateFrom: string;
  dateTo: string;
};

const EMPTY_FILTERS: PaymentFilters = {
  q: "",
  paymentId: "",
  userId: "",
  status: "all",
  packageId: "all",
  method: "all",
  dateFrom: "",
  dateTo: "",
};

const inputCls =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-yellow-500/30";

function buildQueryParams(pageNum: number, filters: PaymentFilters) {
  const params = new URLSearchParams();
  params.set("limit", String(PAGE_SIZE));
  params.set("offset", String((pageNum - 1) * PAGE_SIZE));
  params.set("page", String(pageNum));
  const q = filters.q.trim();
  if (q) params.set("q", q);
  const paymentId = filters.paymentId.trim();
  if (paymentId) params.set("paymentId", paymentId);
  const userId = filters.userId.trim();
  if (userId) params.set("userId", userId);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.packageId !== "all") params.set("package", filters.packageId);
  if (filters.method !== "all") params.set("method", filters.method);
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);
  return params;
}

function filtersActive(filters: PaymentFilters) {
  return (
    filters.q.trim() !== "" ||
    filters.paymentId.trim() !== "" ||
    filters.userId.trim() !== "" ||
    filters.status !== "all" ||
    filters.packageId !== "all" ||
    filters.method !== "all" ||
    Boolean(filters.dateFrom || filters.dateTo)
  );
}

const Transactions = () => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<PaymentFilters>(() => {
    const uid = searchParams.get("userId")?.trim() ?? "";
    if (uid && /^\d+$/.test(uid)) {
      return { ...EMPTY_FILTERS, userId: uid };
    }
    return EMPTY_FILTERS;
  });
  const [appliedFilters, setAppliedFilters] = useState<PaymentFilters>(() => {
    const uid = searchParams.get("userId")?.trim() ?? "";
    if (uid && /^\d+$/.test(uid)) {
      return { ...EMPTY_FILTERS, userId: uid };
    }
    return EMPTY_FILTERS;
  });

  const fetchPayments = useCallback(
    async (pageNum: number, activeFilters: PaymentFilters) => {
      setLoading(true);
      setError("");
      try {
        const qs = buildQueryParams(pageNum, activeFilters).toString();
        const res = await fetch(`${API_BASE}/admin/payments?${qs}`);
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
    void fetchPayments(1, appliedFilters);
  }, [appliedFilters, fetchPayments]);

  useEffect(() => {
    const uid = searchParams.get("userId")?.trim() ?? "";
    if (uid && /^\d+$/.test(uid)) {
      const next = { ...EMPTY_FILTERS, userId: uid };
      setFilters(next);
      setAppliedFilters(next);
    }
  }, [searchParams]);

  const applyFilters = () => {
    setAppliedFilters({ ...filters });
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
  };

  const active = useMemo(() => filtersActive(appliedFilters), [appliedFilters]);

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
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl text-black font-bold">Transactions</h1>
          <p className="text-slate-500 text-sm">Monitor all payment activities</p>
          {total > 0 && (
            <p className="mt-1 text-xs text-slate-400">
              {total.toLocaleString()} payment{total === 1 ? "" : "s"}
              {active ? " matching filters" : " total"}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void fetchPayments(page, appliedFilters)}
          disabled={loading}
          className="px-5 py-2.5 rounded-xl bg-[#FFD700] text-black font-bold hover:bg-[#E6C200] transition flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex min-w-[140px] flex-1 flex-col gap-1">
          <label className="text-xs font-semibold uppercase text-slate-500">Search</label>
          <input
            type="text"
            placeholder="Name, email, phone, user #"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyFilters();
            }}
            className={inputCls}
          />
        </div>
        <div className="flex w-[110px] flex-col gap-1">
          <label className="text-xs font-semibold uppercase text-slate-500">Payment ID</label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="e.g. 252"
            value={filters.paymentId}
            onChange={(e) => setFilters((f) => ({ ...f, paymentId: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyFilters();
            }}
            className={inputCls}
          />
        </div>
        <div className="flex w-[100px] flex-col gap-1">
          <label className="text-xs font-semibold uppercase text-slate-500">User ID</label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="e.g. 123"
            value={filters.userId}
            onChange={(e) => setFilters((f) => ({ ...f, userId: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyFilters();
            }}
            className={inputCls}
          />
        </div>
        <div className="flex min-w-[120px] flex-col gap-1">
          <label className="text-xs font-semibold uppercase text-slate-500">Status</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            className={inputCls}
          >
            <option value="all">All</option>
            <option value="success">Success</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <div className="flex min-w-[130px] flex-col gap-1">
          <label className="text-xs font-semibold uppercase text-slate-500">Package</label>
          <select
            value={filters.packageId}
            onChange={(e) => setFilters((f) => ({ ...f, packageId: e.target.value }))}
            className={inputCls}
          >
            <option value="all">All</option>
            {PACKAGE_OPTIONS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-[110px] flex-col gap-1">
          <label className="text-xs font-semibold uppercase text-slate-500">Method</label>
          <select
            value={filters.method}
            onChange={(e) => setFilters((f) => ({ ...f, method: e.target.value }))}
            className={inputCls}
          >
            <option value="all">All</option>
            {METHOD_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-[140px] flex-col gap-1">
          <label className="text-xs font-semibold uppercase text-slate-500 flex items-center gap-1">
            <CalendarRange className="h-3.5 w-3.5" />
            From
          </label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
            className={inputCls}
          />
        </div>
        <div className="flex min-w-[140px] flex-col gap-1">
          <label className="text-xs font-semibold uppercase text-slate-500 flex items-center gap-1">
            <CalendarRange className="h-3.5 w-3.5" />
            Through
          </label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
            className={inputCls}
          />
        </div>
        <button
          type="button"
          onClick={applyFilters}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
        >
          Apply
        </button>
        {active && (
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Clear
          </button>
        )}
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
                    {active ? "No transactions match your filters" : "No transactions found"}
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="hover:bg-yellow-50/50 transition">
                    <td className="px-6 py-4 font-bold text-slate-600">{p.id}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {p.name ?? "—"}
                      <span className="block text-xs text-slate-400">#{p.user_id}</span>
                    </td>
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
          onPageChange={(p) => void fetchPayments(p, appliedFilters)}
          itemLabel="payments"
        />
      </div>
    </div>
  );
};

export default Transactions;
