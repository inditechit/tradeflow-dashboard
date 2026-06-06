import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FileText, Filter, Loader2, RefreshCw, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_BASE } from "@/config/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Invoice = {
  id: number;
  user_id: number;
  user_name: string | null;
  user_email: string | null;
  invoice_number: string | null;
  amount: number;
  status: string;
  package_id: string;
  package_name: string;
  payment_method: string | null;
  tx_hash: string | null;
  type: "recharge" | "package";
  created_at: string;
};

type InvoiceStats = {
  invoice_count: number;
  total_amount_usd: number;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

const AdminInvoicesPage = () => {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<InvoiceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterUserId, setFilterUserId] = useState(searchParams.get("userId") ?? "");
  const [filterType, setFilterType] = useState(searchParams.get("type") ?? "all");
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 100;

  const fetchInvoices = useCallback(
    async (pageNum = 1) => {
      setLoading(true);
      try {
        const qs = new URLSearchParams();
        qs.set("page", String(pageNum));
        qs.set("limit", String(pageSize));
        if (filterUserId.trim() && /^\d+$/.test(filterUserId.trim())) {
          qs.set("userId", filterUserId.trim());
        }
        if (filterType === "recharge" || filterType === "package") {
          qs.set("type", filterType);
        }
        const res = await fetch(`${API_BASE}/admin/invoices?${qs.toString()}`);
        const data = await res.json();
        if (data.success) {
          setInvoices(data.invoices ?? []);
          setTotal(Number(data.total ?? 0));
          setPage(Number(data.page ?? pageNum));
          if (data.stats) {
            setStats({
              invoice_count: Number(data.stats.invoice_count ?? 0),
              total_amount_usd: Number(data.stats.total_amount_usd ?? 0),
            });
          }
        } else {
          toast({ title: "Failed to load invoices", description: data.error, variant: "destructive" });
        }
      } catch {
        toast({ title: "Network error", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    },
    [filterUserId, filterType, toast],
  );

  useEffect(() => {
    void fetchInvoices(1);
  }, [fetchInvoices]);

  const applyFilters = () => {
    const next = new URLSearchParams();
    if (filterUserId.trim()) next.set("userId", filterUserId.trim());
    if (filterType !== "all") next.set("type", filterType);
    setSearchParams(next);
    void fetchInvoices(1);
  };

  const clearFilters = () => {
    setFilterUserId("");
    setFilterType("all");
    setSearchParams({});
    void fetchInvoices(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <FileText className="h-7 w-7" />
          Invoices
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          All successful recharges and package payments with invoice numbers.
        </p>
      </div>

      {stats ? (
        <div className="mb-4 flex flex-wrap gap-3">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            {stats.invoice_count} invoice(s)
          </span>
          <span className="rounded-full bg-[#FFF9E6] px-3 py-1 text-xs font-semibold text-neutral-900 ring-1 ring-yellow-200">
            ${stats.total_amount_usd.toLocaleString("en-US", { minimumFractionDigits: 2 })} total
          </span>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="text-xs font-medium text-slate-500">User ID</label>
          <Input
            className="mt-1 w-32"
            placeholder="All"
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Type</label>
          <select
            className="mt-1 flex h-10 w-40 rounded-md border border-input bg-background px-3 text-sm"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">All</option>
            <option value="recharge">Recharge only</option>
            <option value="package">Package only</option>
          </select>
        </div>
        <Button type="button" onClick={applyFilters}>
          <Filter className="mr-2 h-4 w-4" />
          Apply
        </Button>
        <Button type="button" variant="ghost" onClick={clearFilters}>
          Clear
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => void fetchInvoices(page)} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b last:border-0 hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-mono text-xs font-semibold">{inv.invoice_number || `#${inv.id}`}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{inv.user_name || "—"}</div>
                      <div className="text-xs text-slate-400">
                        #{inv.user_id} · {inv.user_email || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{inv.package_name}</td>
                    <td className="px-4 py-3 font-semibold">${Number(inv.amount).toFixed(2)}</td>
                    <td className="px-4 py-3 text-slate-600">{inv.payment_method || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(inv.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button type="button" size="sm" variant="outline" onClick={() => setSelected(inv)}>
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
                {!invoices.length && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                      No invoices found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => void fetchInvoices(page - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-slate-600">
            Page {page} of {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => void fetchInvoices(page + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <button
              type="button"
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-700"
              onClick={() => setSelected(null)}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-bold text-slate-900">Invoice {selected.invoice_number}</h2>
            <p className="text-sm text-slate-500">
              {selected.user_name} (#{selected.user_id})
            </p>
            <dl className="mt-6 space-y-3 text-sm">
              <div className="flex justify-between gap-4 border-b pb-2">
                <dt className="text-slate-500">Item</dt>
                <dd className="font-medium">{selected.package_name}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b pb-2">
                <dt className="text-slate-500">Amount</dt>
                <dd className="font-bold">${Number(selected.amount).toFixed(2)} USD</dd>
              </div>
              <div className="flex justify-between gap-4 border-b pb-2">
                <dt className="text-slate-500">Method</dt>
                <dd>{selected.payment_method || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b pb-2">
                <dt className="text-slate-500">Date</dt>
                <dd>{formatDate(selected.created_at)}</dd>
              </div>
              {selected.tx_hash ? (
                <div>
                  <dt className="mb-1 text-slate-500">Tx hash</dt>
                  <dd className="break-all font-mono text-xs">{selected.tx_hash}</dd>
                </div>
              ) : null}
            </dl>
            <Button type="button" className="mt-6 w-full" variant="secondary" onClick={() => setSelected(null)}>
              Close
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminInvoicesPage;
