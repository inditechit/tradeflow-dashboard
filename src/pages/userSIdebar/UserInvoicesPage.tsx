import { useCallback, useEffect, useState } from "react";
import { FileText, Loader2, RefreshCw, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_BASE } from "@/config/api";
import { Button } from "@/components/ui/button";
import { ListPaginationBar } from "@/components/trades/TradesPaginationBar";
import { useApp } from "@/context/AppContext";

const PAGE_SIZE = 50;

type Invoice = {
  id: number;
  payment_id: number;
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

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

const UserInvoicesPage = () => {
  const { toast } = useToast();
  const { currentUser } = useApp();
  const userId = currentUser?.userId;
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(
    async (pageNum = 1) => {
      if (!userId) return;
      setLoading(true);
      try {
        const offset = (pageNum - 1) * PAGE_SIZE;
        const res = await fetch(
          `${API_BASE}/user/invoices/${userId}?limit=${PAGE_SIZE}&offset=${offset}&page=${pageNum}`,
        );
        const data = await res.json();
        if (data.success) {
          setInvoices(data.invoices ?? []);
          setTotal(Number(data.total ?? data.invoices?.length ?? 0));
          setPage(pageNum);
        } else {
          toast({ title: "Failed to load invoices", description: data.error, variant: "destructive" });
        }
      } catch {
        toast({ title: "Network error", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    },
    [userId, toast],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <FileText className="h-7 w-7" />
            Invoices
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Receipts for successful wallet recharges and package purchases.
          </p>
          {total > 0 && (
            <p className="mt-1 text-xs text-slate-400">{total.toLocaleString()} invoices total</p>
          )}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load(page)} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {loading && invoices.length === 0 ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-slate-500">
          No invoices yet. Successful recharges and package payments appear here.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b last:border-0 hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-800">
                      {inv.invoice_number || `#${inv.id}`}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{inv.package_name}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      ${Number(inv.amount).toFixed(2)} USD
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(inv.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button type="button" size="sm" variant="outline" onClick={() => setSelected(inv)}>
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ListPaginationBar
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={PAGE_SIZE}
            onPageChange={(p) => void load(p)}
            itemLabel="invoices"
          />
        </div>
      )}

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
            <h2 className="text-lg font-bold text-slate-900">Invoice details</h2>
            <p className="mt-1 font-mono text-sm text-slate-500">
              {selected.invoice_number || `#${selected.id}`}
            </p>
            <dl className="mt-6 space-y-3 text-sm">
              <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                <dt className="text-slate-500">Item</dt>
                <dd className="font-medium text-slate-900">{selected.package_name}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                <dt className="text-slate-500">Amount</dt>
                <dd className="font-bold text-slate-900">${Number(selected.amount).toFixed(2)} USD</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                <dt className="text-slate-500">Status</dt>
                <dd className="capitalize text-emerald-700">{selected.status}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                <dt className="text-slate-500">Payment method</dt>
                <dd className="text-slate-900">{selected.payment_method || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                <dt className="text-slate-500">Date</dt>
                <dd className="text-slate-900">{formatDate(selected.created_at)}</dd>
              </div>
              {selected.tx_hash ? (
                <div>
                  <dt className="mb-1 text-slate-500">Transaction hash</dt>
                  <dd className="break-all font-mono text-xs text-slate-800">{selected.tx_hash}</dd>
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

export default UserInvoicesPage;
