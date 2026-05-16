import React, { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API_BASE = "https://api.copytradeengine.org/api";

type RefRow = {
  id: number;
  name?: string;
  email?: string;
  telegram?: string;
  mobile?: string;
  created_at?: string;
  referrer_id?: number | null;
  referrer_telegram?: string | null;
  referrer_name?: string | null;
  referrer_email?: string | null;
};

type TopRow = {
  user_id: number;
  telegram?: string;
  name?: string;
  email?: string;
  direct_referrals: number;
};

const AdminReferralsPage = () => {
  const [rows, setRows] = useState<RefRow[]>([]);
  const [top, setTop] = useState<TopRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: "300", offset: "0" });
      if (q.trim()) qs.set("q", q.trim());
      const [listRes, topRes] = await Promise.all([
        fetch(`${API_BASE}/admin/referrals?${qs}`),
        fetch(`${API_BASE}/admin/referrals/top?limit=30`),
      ]);
      const listData = await listRes.json();
      const topData = await topRes.json();
      if (listData.success) {
        setRows(listData.data ?? []);
        setTotal(Number(listData.total ?? 0));
      } else toast({ title: "Error", description: listData.error, variant: "destructive" });
      if (topData.success) setTop(topData.data ?? []);
    } catch {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    load();
  };

  if (loading && rows.length === 0) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-neutral-900" size={36} />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Referrals</h1>
        <p className="text-sm text-slate-500 mt-1">
          See who referred whom. Top referrers lists users with the most direct signups.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-wrap gap-3 items-center justify-between">
            <h2 className="font-semibold text-slate-800">All users & referrer</h2>
            <form onSubmit={search} className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  className="pl-8 pr-3 py-1.5 border rounded-lg text-sm w-56 text-black"
                  placeholder="Telegram, email, name, id…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <button type="submit" className="px-3 py-1.5 rounded-lg bg-[#FFD700] text-black text-sm font-medium">
                Search
              </button>
            </form>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-600">
                  <th className="p-3 font-semibold">User id</th>
                  <th className="p-3 font-semibold">Telegram</th>
                  <th className="p-3 font-semibold">Name</th>
                  <th className="p-3 font-semibold">Referrer id</th>
                  <th className="p-3 font-semibold">Referred by</th>
                  <th className="p-3 font-semibold">Joined</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="p-3 font-mono">{r.id}</td>
                    <td className="p-3">{r.telegram ?? "—"}</td>
                    <td className="p-3">{r.name ?? "—"}</td>
                    <td className="p-3">{r.referrer_id ?? "—"}</td>
                    <td className="p-3">
                      {r.referrer_telegram || r.referrer_name || r.referrer_email ? (
                        <span className="text-slate-800">
                          {[r.referrer_telegram, r.referrer_name].filter(Boolean).join(" · ") || r.referrer_email}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="p-3 text-slate-500 whitespace-nowrap">
                      {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="p-3 text-xs text-slate-400 border-t">Showing {rows.length} of {total}</p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Top referrers</h2>
            <p className="text-xs text-slate-500 mt-1">Most direct referrals</p>
          </div>
          <ol className="divide-y divide-slate-100">
            {top.map((t, i) => (
              <li key={t.user_id} className="p-3 flex justify-between gap-2 items-start">
                <span className="text-slate-500 font-mono text-xs w-6">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 truncate">{t.telegram || t.name || `#${t.user_id}`}</p>
                  <p className="text-xs text-slate-500 truncate">{t.email}</p>
                </div>
                <span className="shrink-0 font-bold text-neutral-800">{t.direct_referrals}</span>
              </li>
            ))}
          </ol>
          {top.length === 0 && <p className="p-4 text-sm text-slate-500">No referral data yet.</p>}
        </section>
      </div>
    </div>
  );
};

export default AdminReferralsPage;
