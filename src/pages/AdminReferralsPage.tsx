import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { API_BASE } from "@/config/api";
import { ListPaginationBar } from "@/components/trades/TradesPaginationBar";

const PAGE_SIZE = 100;
import ReferrerTierBadge, { ReferrerTierLegend } from "@/components/admin/ReferrerTierBadge";
import { tierRangeLabel, REFERRER_TIERS } from "@/utils/referrerTier";

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

type ReferrerFilter = {
  id: number;
  label: string;
};

const AdminReferralsPage = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<RefRow[]>([]);
  const [top, setTop] = useState<TopRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [referrerFilter, setReferrerFilter] = useState<ReferrerFilter | null>(null);
  const { toast } = useToast();

  const load = async (pageNum = page) => {
    setLoading(true);
    try {
      const offset = (pageNum - 1) * PAGE_SIZE;
      const qs = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
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
        setPage(pageNum);
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
    setReferrerFilter(null);
    void load(1);
  };

  const filterByReferrer = (id: number, label: string) => {
    setReferrerFilter({ id, label });
  };

  const displayRows = useMemo(() => {
    let list = [...rows];
    if (referrerFilter) {
      list = list.filter((r) => Number(r.referrer_id) === referrerFilter.id);
    }
    return list.sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });
  }, [rows, referrerFilter]);

  const referrerLabel = (r: RefRow) => {
    const parts = [r.referrer_telegram, r.referrer_name].filter(Boolean);
    if (parts.length) return parts.join(" · ");
    if (r.referrer_email) return r.referrer_email;
    return r.referrer_id ? `#${r.referrer_id}` : "—";
  };

  const openProfile = (id: number) => {
    navigate(`/admin/user-profile/${id}`);
  };

  if (loading && rows.length === 0) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-neutral-900" size={36} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-8 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Refer a friend</h1>
        <p className="mt-1 text-sm text-slate-500">
          Click a user name to open their profile. Referrer names filter the list.
        </p>
      </div>

      {referrerFilter && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
          <p className="text-sm text-indigo-900">
            Showing <span className="font-semibold">{displayRows.length}</span> user
            {displayRows.length === 1 ? "" : "s"} referred by{" "}
            <span className="font-semibold">{referrerFilter.label}</span>
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1 border-indigo-200 bg-white text-indigo-800 hover:bg-indigo-100"
            onClick={() => setReferrerFilter(null)}
          >
            <X className="h-3.5 w-3.5" />
            Clear filter
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
            <h2 className="font-semibold text-slate-800">
              {referrerFilter ? "Referred users" : "All users & referrer"}
            </h2>
            <form onSubmit={search} className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  className="w-56 rounded-lg border py-1.5 pl-8 pr-3 text-sm text-black"
                  placeholder="Telegram, email, name, id…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <button type="submit" className="rounded-lg bg-[#FFD700] px-3 py-1.5 text-sm font-medium text-black">
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
                {displayRows.map((r) => {
                  const refName = referrerLabel(r);
                  const canFilter = r.referrer_id != null && refName !== "—";
                  return (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="p-3 font-mono">
                        <button
                          type="button"
                          onClick={() => openProfile(r.id)}
                          className="font-medium text-indigo-700 underline-offset-2 hover:underline"
                        >
                          {r.id}
                        </button>
                      </td>
                      <td className="p-3">{r.telegram ?? "—"}</td>
                      <td className="p-3">
                        {r.name ? (
                          <button
                            type="button"
                            onClick={() => openProfile(r.id)}
                            className="text-left font-medium text-slate-800 underline-offset-2 hover:text-indigo-700 hover:underline"
                          >
                            {r.name}
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-3">{r.referrer_id ?? "—"}</td>
                      <td className="p-3">
                        {canFilter ? (
                          <button
                            type="button"
                            onClick={() =>
                              filterByReferrer(Number(r.referrer_id), refName)
                            }
                            onDoubleClick={() => openProfile(Number(r.referrer_id))}
                            className={`text-left font-medium underline-offset-2 hover:underline ${
                              referrerFilter?.id === r.referrer_id
                                ? "text-indigo-700"
                                : "text-slate-800 hover:text-indigo-700"
                            }`}
                            title="Click to filter · double-click to open profile"
                          >
                            {refName}
                          </button>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap p-3 text-slate-500">
                        {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ListPaginationBar
            page={page}
            totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
            total={total}
            pageSize={PAGE_SIZE}
            onPageChange={(p) => void load(p)}
            itemLabel="users"
          />
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <h2 className="font-semibold text-slate-800">Top referrers</h2>
            <p className="mt-1 text-xs text-slate-500">Click a name to filter the list</p>
            <div className="mt-3 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Referral tiers
              </p>
              <ReferrerTierLegend />
              <div className="grid grid-cols-1 gap-0.5 text-[10px] text-slate-500">
                {REFERRER_TIERS.map((tier) => (
                  <span key={tier.id}>
                    <span className="font-semibold text-slate-700">{tier.label}</span>
                    {" · "}
                    {tierRangeLabel(tier)}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <ol className="divide-y divide-slate-100">
            {top.map((t, i) => {
              const label = t.telegram || t.name || `#${t.user_id}`;
              const active = referrerFilter?.id === t.user_id;
              const referrals = Number(t.direct_referrals ?? 0);
              return (
                <li key={t.user_id}>
                  <button
                    type="button"
                    onClick={() => filterByReferrer(t.user_id, label)}
                    onDoubleClick={() => openProfile(t.user_id)}
                    className={`flex w-full items-start gap-2 p-3 text-left transition hover:bg-indigo-50/60 ${
                      active ? "bg-indigo-50" : ""
                    }`}
                    title="Click to filter · double-click to open profile"
                  >
                    <span className="w-6 shrink-0 pt-1 font-mono text-xs text-slate-500">{i + 1}.</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={`truncate font-medium ${active ? "text-indigo-800" : "text-slate-800"}`}>
                          {label}
                        </p>
                        <ReferrerTierBadge count={referrals} />
                      </div>
                      <p className="truncate text-xs text-slate-500">{t.email}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="block font-bold tabular-nums text-neutral-800">{referrals}</span>
                      <span className="text-[10px] text-slate-400">refs</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
          {top.length === 0 && <p className="p-4 text-sm text-slate-500">No referral data yet.</p>}
        </section>
      </div>
    </div>
  );
};

export default AdminReferralsPage;
