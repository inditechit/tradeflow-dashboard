import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API_BASE = "https://api.copytradeengine.org/api";

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
  const [loading, setLoading] = useState(true);
  const [userFilter, setUserFilter] = useState("");
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: "150", offset: "0" });
      const uid = userFilter.trim();
      if (uid && /^\d+$/.test(uid)) qs.set("userId", uid);
      const res = await fetch(`${API_BASE}/admin/wallet/ledger?${qs}`);
      const data = await res.json();
      if (data.success) {
        setRows(data.data ?? []);
        setTotal(Number(data.total ?? 0));
      } else toast({ title: "Error", description: data.error, variant: "destructive" });
    } catch {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Wallet ledger</h1>
        <p className="text-sm text-slate-500 mt-1">
          Audit log of balance changes: recharges, affiliate commissions, admin adjustments, new wallets.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Filter by user id</label>
          <input
            className="border rounded-lg px-3 py-2 text-sm w-40 text-black"
            placeholder="e.g. 30"
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={load}
          className="px-4 py-2 rounded-lg bg-[#FFD700] text-black text-sm font-semibold hover:bg-[#E6C200]"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={async () => {
            setUserFilter("");
            setLoading(true);
            try {
              const res = await fetch(`${API_BASE}/admin/wallet/ledger?limit=150&offset=0`);
              const data = await res.json();
              if (data.success) {
                setRows(data.data ?? []);
                setTotal(Number(data.total ?? 0));
              }
            } finally {
              setLoading(false);
            }
          }}
          className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-700"
        >
          Clear filter
        </button>
      </div>

      {loading ? (
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
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="p-3 whitespace-nowrap text-slate-600">
                    {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                  </td>
                  <td className="p-3">
                    <span className="font-mono text-xs">{r.user_id}</span>{" "}
                    <span className="text-slate-700">{r.user_telegram ?? ""}</span>
                  </td>
                  <td className={`p-3 font-mono ${Number(r.delta_usd) >= 0 ? "text-yellow-800" : "text-red-600"}`}>
                    {Number(r.delta_usd) >= 0 ? "+" : ""}
                    {Number(r.delta_usd).toFixed(4)}
                  </td>
                  <td className="p-3 font-mono">{Number(r.balance_after).toFixed(4)}</td>
                  <td className="p-3">{r.entry_type}</td>
                  <td className="p-3 text-xs text-slate-500">
                    {r.reference_type ?? "—"} {r.reference_id != null ? `#${r.reference_id}` : ""}
                  </td>
                  <td className="p-3 text-xs text-slate-600 max-w-[240px] truncate" title={r.note ?? ""}>
                    {r.note ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="p-3 text-xs text-slate-400 border-t">Rows: {rows.length} / total in DB (approx): {total}</p>
        </div>
      )}
    </div>
  );
};

export default AdminWalletLedgerPage;
