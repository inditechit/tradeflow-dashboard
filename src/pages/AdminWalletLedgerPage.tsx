import React, { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_BASE } from "@/config/api";
import { ListPaginationBar } from "@/components/trades/TradesPaginationBar";
import { plTextClass } from "@/utils/plColors";
import { formatLedgerEntryType } from "@/utils/ledgerEntryLabels";

const PAGE_SIZE = 100;

type LedgerRow = {
  id: number;
  user_id: number;
  user_telegram?: string;
  delta_usd: string | number;
  balance_after: string | number;
  currency: string;
  entry_type: string;
  reference_type?: string | null;
  reference_id?: number | null;
  note?: string | null;
  created_at: string;
};

const AdminWalletLedgerPage = () => {
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [userFilter, setUserFilter] = useState("");
  const [appliedUserFilter, setAppliedUserFilter] = useState("");
  const { toast } = useToast();

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = useCallback(
    async (pageNum: number, filterUserId: string) => {
      setLoading(true);
      try {
        const offset = (pageNum - 1) * PAGE_SIZE;
        const qs = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(offset),
        });
        const uid = filterUserId.trim();
        if (uid && /^\d+$/.test(uid)) qs.set("userId", uid);

        const res = await fetch(`${API_BASE}/admin/wallet/ledger?${qs}`);
        const data = await res.json();
        if (data.success) {
          setRows(data.data ?? []);
          setTotal(Number(data.total ?? 0));
          setPage(pageNum);
        } else {
          toast({ title: "Error", description: data.error, variant: "destructive" });
        }
      } catch {
        toast({ title: "Error", description: "Network error", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    void load(1, appliedUserFilter);
  }, [appliedUserFilter, load]);

  const applyFilter = () => {
    setAppliedUserFilter(userFilter.trim());
    setPage(1);
  };

  const clearFilter = () => {
    setUserFilter("");
    setAppliedUserFilter("");
    setPage(1);
  };

  const onPageChange = (nextPage: number) => {
    void load(nextPage, appliedUserFilter);
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Wallet ledger</h1>
        <p className="text-sm text-slate-500 mt-1">
          Audit log of balance changes: recharges, affiliate commissions, admin adjustments, new wallets.
        </p>
        {total > 0 && (
          <p className="mt-1 text-xs text-slate-400">{total.toLocaleString()} ledger entries</p>
        )}
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Filter by user id</label>
          <input
            className="border rounded-lg px-3 py-2 text-sm w-40 text-black"
            placeholder="e.g. 71"
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilter()}
          />
        </div>
        <button
          type="button"
          onClick={applyFilter}
          className="px-4 py-2 rounded-lg bg-[#FFD700] text-black text-sm font-semibold hover:bg-[#E6C200]"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={clearFilter}
          className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-700"
        >
          Clear filter
        </button>
      </div>

      {loading && rows.length === 0 ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-neutral-900" size={36} />
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-600">
                <th className="p-3 font-semibold">Time</th>
                <th className="p-3 font-semibold">User</th>
                <th className="p-3 font-semibold">Δ USD</th>
                <th className="p-3 font-semibold">Balance after</th>
                <th className="p-3 font-semibold">Type</th>
                <th className="p-3 font-semibold">Ref</th>
                <th className="p-3 font-semibold">Note</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No ledger rows found
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="p-3 whitespace-nowrap text-slate-600">
                      {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                    </td>
                    <td className="p-3">
                      <span className="font-mono text-xs">{r.user_id}</span>{" "}
                      <span className="text-slate-700">{r.user_telegram ?? ""}</span>
                    </td>
                    <td className={`p-3 font-mono ${plTextClass(Number(r.delta_usd))}`}>
                      {Number(r.delta_usd) >= 0 ? "+" : ""}
                      {Number(r.delta_usd).toFixed(4)}
                    </td>
                    <td className="p-3 font-mono">{Number(r.balance_after).toFixed(4)}</td>
                    <td className="p-3">{formatLedgerEntryType(r.entry_type)}</td>
                    <td className="p-3 text-xs text-slate-500">
                      {r.reference_type ?? "—"} {r.reference_id != null ? `#${r.reference_id}` : ""}
                    </td>
                    <td
                      className="p-3 text-xs text-slate-600 max-w-[240px] truncate"
                      title={r.note ?? ""}
                    >
                      {r.note ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <ListPaginationBar
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={PAGE_SIZE}
            onPageChange={onPageChange}
            itemLabel="entries"
          />
        </div>
      )}
    </div>
  );
};

export default AdminWalletLedgerPage;
