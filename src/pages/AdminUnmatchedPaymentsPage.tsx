import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ExternalLink, Filter, Loader2, RefreshCw, X } from "lucide-react";
import { API_BASE } from "@/config/api";
import { ListPaginationBar } from "@/components/trades/TradesPaginationBar";
import { Button } from "@/components/ui/button";

type UnmatchedRow = {
  id: number;
  tx_hash: string;
  from_address: string | null;
  to_address: string | null;
  deposit_wallet: string | null;
  block_timestamp: number | null;
  created_at: string;
  received_amount_usd: number;
  expected_amount_usd: number;
  shortfall_usd: number;
  payment_id: number | null;
  user_id: number | null;
  user_name: string | null;
  user_email: string | null;
  user_mobile: string | null;
  user_telegram: string | null;
  package_id: string | null;
  payment_status: string | null;
  sweep_status: string | null;
};

const PACKAGE_LABELS: Record<string, string> = {
  recharge: "Wallet recharge",
  "7-day-trial": "7-day trial",
  "1-month": "1 month",
  "3-month": "3 month",
  "6-month": "6 month",
  "1-year": "1 year",
};

function fmtUsd(n: number) {
  return `$${Number(n || 0).toFixed(2)}`;
}

function fmtDate(value: string | number | null) {
  if (value == null) return "—";
  const d = typeof value === "number" ? new Date(value) : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function tronscanTxUrl(txHash: string) {
  return `https://tronscan.org/#/transaction/${txHash}`;
}

const AdminUnmatchedPaymentsPage = () => {
  const [rows, setRows] = useState<UnmatchedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterUserId, setFilterUserId] = useState("");
  const [activeUserId, setActiveUserId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 50;

  const load = useCallback(async (userId: number | null, pageNum = 1) => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      qs.set("page", String(pageNum));
      qs.set("limit", String(pageSize));
      if (userId != null) qs.set("userId", String(userId));
      const res = await fetch(`${API_BASE}/admin/unmatched-payments?${qs.toString()}`);
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Failed to load unmatched payments");
        setRows([]);
        setTotal(0);
        return;
      }
      setRows(data.payments ?? []);
      setTotal(Number(data.total ?? 0));
      setPage(Number(data.page ?? pageNum));
    } catch {
      setError("Network error");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(activeUserId, page);
  }, [load, activeUserId, page]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.received += Number(r.received_amount_usd || 0);
        acc.expected += Number(r.expected_amount_usd || 0);
        acc.shortfall += Number(r.shortfall_usd || 0);
        return acc;
      },
      { received: 0, expected: 0, shortfall: 0 },
    );
  }, [rows]);

  const applyUserFilter = () => {
    const trimmed = filterUserId.trim();
    if (!trimmed) {
      setActiveUserId(null);
      setPage(1);
      return;
    }
    if (!/^\d+$/.test(trimmed)) {
      setError("User ID must be a number");
      return;
    }
    setActiveUserId(Number(trimmed));
    setPage(1);
  };

  const clearUserFilter = () => {
    setFilterUserId("");
    setActiveUserId(null);
    setPage(1);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <AlertTriangle className="h-7 w-7 text-amber-600" />
            Unmatched payments
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Users who sent <strong>less USDT</strong> than required (outside the $2 tolerance). Funds may
            have been swept, but the payment was not activated.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void load(activeUserId, page)}
          disabled={loading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">On this page — received</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{fmtUsd(totals.received)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">On this page — expected</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{fmtUsd(totals.expected)}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">On this page — shortfall</p>
          <p className="mt-1 text-xl font-bold text-amber-900">{fmtUsd(totals.shortfall)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Filter by user ID</label>
          <input
            type="text"
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyUserFilter();
            }}
            placeholder="e.g. 124"
            className="w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <Button type="button" onClick={applyUserFilter}>
          <Filter className="mr-2 h-4 w-4" />
          Apply
        </Button>
        {activeUserId != null ? (
          <Button type="button" variant="ghost" onClick={clearUserFilter}>
            <X className="mr-1 h-4 w-4" />
            Clear filter (#{activeUserId})
          </Button>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-500">No unmatched payments found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="p-3">When</th>
                  <th className="p-3">User</th>
                  <th className="p-3">Package</th>
                  <th className="p-3">Expected</th>
                  <th className="p-3">Received</th>
                  <th className="p-3">Shortfall</th>
                  <th className="p-3">Payment</th>
                  <th className="p-3">TX</th>
                  <th className="p-3">Deposit wallet</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/80">
                    <td className="whitespace-nowrap p-3 text-slate-600">{fmtDate(r.created_at)}</td>
                    <td className="p-3">
                      {r.user_id ? (
                        <div className="space-y-0.5">
                          <Link
                            to={`/admin/user-profile/${r.user_id}`}
                            className="font-semibold text-neutral-900 hover:underline"
                          >
                            #{r.user_id}
                            {r.user_name ? ` · ${r.user_name}` : ""}
                          </Link>
                          {r.user_email ? (
                            <p className="text-xs text-slate-500">{r.user_email}</p>
                          ) : null}
                          {r.user_telegram ? (
                            <p className="text-xs text-slate-500">{r.user_telegram}</p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-slate-400">Unknown</span>
                      )}
                    </td>
                    <td className="p-3 text-slate-700">
                      {r.package_id
                        ? PACKAGE_LABELS[r.package_id] ?? r.package_id
                        : "—"}
                    </td>
                    <td className="p-3 font-medium text-slate-800">{fmtUsd(r.expected_amount_usd)}</td>
                    <td className="p-3 font-medium text-emerald-700">{fmtUsd(r.received_amount_usd)}</td>
                    <td className="p-3 font-bold text-amber-700">{fmtUsd(r.shortfall_usd)}</td>
                    <td className="p-3">
                      {r.payment_id ? (
                        <div className="space-y-0.5">
                          <span className="font-mono text-xs">#{r.payment_id}</span>
                          {r.payment_status ? (
                            <p className="text-xs capitalize text-slate-500">{r.payment_status}</p>
                          ) : null}
                          {r.sweep_status ? (
                            <p className="text-xs text-slate-400">Sweep: {r.sweep_status}</p>
                          ) : null}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3">
                      {r.tx_hash ? (
                        <a
                          href={tronscanTxUrl(r.tx_hash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-xs text-blue-700 hover:underline"
                          title={r.tx_hash}
                        >
                          {r.tx_hash.slice(0, 10)}…
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="max-w-[140px] truncate p-3 font-mono text-xs text-slate-500" title={r.deposit_wallet ?? ""}>
                      {r.deposit_wallet ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ListPaginationBar
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
      />
    </div>
  );
};

export default AdminUnmatchedPaymentsPage;
