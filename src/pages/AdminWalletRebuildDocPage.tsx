import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, FileText, AlertTriangle, Wrench } from "lucide-react";
import { API_BASE } from "@/config/api";

type WalletDocUser = {
  user_id: number;
  name: string;
  wallet_june8_usd: number;
  expected_wallet_usd: number;
  current_db_wallet_usd: number;
  drift_vs_db_usd: number;
  recharge_total_usd: number;
  simulated_trade_pl_usd: number;
  assign_count: number;
  pool_excluded: boolean;
  year_pack: boolean;
  needs_fix: boolean;
};

type WalletDocResponse = {
  ok: boolean;
  has_preview: boolean;
  note?: string;
  report_path?: string | null;
  generated_at?: string | null;
  anchor_date?: string | null;
  issue_summary?: string[];
  resolution_summary?: string[];
  rules?: Record<string, string> | null;
  csv_files?: Record<string, string> | null;
  stats?: Record<string, number> | null;
  users?: WalletDocUser[];
};

function fmtUsd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n || 0));
}

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d.toLocaleString() : "—";
}

const AdminWalletRebuildDocPage = () => {
  const [data, setData] = useState<WalletDocResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`${API_BASE}/admin/reports/wallet-rebuild-doc`);
      const json = (await res.json()) as WalletDocResponse;
      if (!res.ok || json.ok === false) {
        throw new Error((json as { error?: string }).error || "Failed to load report");
      }
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const users = data?.users ?? [];
  const topDrift = useMemo(() => users.slice(0, 100), [users]);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Wallet Rebuild Justification</h1>
          <p className="mt-1 text-sm text-slate-600">
            Admin documentation for the wallet/trade assignment issue, the rebuild rules, and the
            per-user expected wallet before deployment.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Preview generated: {fmtDate(data?.generated_at)} · Anchor: {fmtDate(data?.anchor_date)}
          </p>
        </div>

        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="inline-flex w-fit items-center gap-2 rounded-xl bg-[#FFD700] px-5 py-2.5 font-bold text-black transition hover:bg-[#E6C200] disabled:opacity-60"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!data?.has_preview ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          {data?.note || "No preview report found."}
        </div>
      ) : (
        <>
          <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-2 flex items-center gap-2 text-slate-700">
                <AlertTriangle className="h-5 w-5" />
                <span className="text-sm font-semibold">Issue summary</span>
              </div>
              <div className="space-y-1 text-sm text-slate-600">
                <div>Users total: {data?.stats?.users_total ?? 0}</div>
                <div>Wallet drift users: {data?.stats?.users_with_wallet_drift ?? 0}</div>
                <div>Pool users at anchor: {data?.stats?.users_in_pool_at_anchor ?? 0}</div>
                <div>MT5 trades simulated: {data?.stats?.mt5_trades_simulated ?? 0}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-2 flex items-center gap-2 text-slate-700">
                <Wrench className="h-5 w-5" />
                <span className="text-sm font-semibold">Fix impact</span>
              </div>
              <div className="space-y-1 text-sm text-slate-600">
                <div>Wallet should increase: {data?.stats?.users_wallet_should_increase ?? 0}</div>
                <div>Wallet should decrease: {data?.stats?.users_wallet_should_decrease ?? 0}</div>
                <div>
                  Admin cash ignored: {data?.stats?.admin_cash_excluded_count ?? 0}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-2 flex items-center gap-2 text-slate-700">
                <FileText className="h-5 w-5" />
                <span className="text-sm font-semibold">Preview files</span>
              </div>
              <div className="space-y-1 break-all text-xs text-slate-500">
                <div>Report: {data?.report_path ?? "—"}</div>
                <div>Summary CSV: {data?.csv_files?.summary ?? "—"}</div>
                <div>June 8 CSV: {data?.csv_files?.anchor_june8 ?? "—"}</div>
                <div>Fixes CSV: {data?.csv_files?.fixes ?? "—"}</div>
              </div>
            </div>
          </section>

          <section className="mb-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-base font-semibold text-slate-900">What was wrong</h2>
              <div className="space-y-2 text-sm text-slate-600">
                {(data?.issue_summary ?? []).map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-base font-semibold text-slate-900">What we changed</h2>
              <div className="space-y-2 text-sm text-slate-600">
                {(data?.resolution_summary ?? []).map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            </div>
          </section>

          <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-base font-semibold text-slate-900">Rebuild rules</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {Object.entries(data?.rules ?? {}).map(([key, value]) => (
                <div key={key} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    {key.replaceAll("_", " ")}
                  </div>
                  <div className="mt-1 text-sm text-slate-700">{value}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">Per-user wallet justification</h2>
              <p className="mt-1 text-sm text-slate-500">
                Expected wallet from preview vs current DB wallet. Sorted by biggest drift first.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">User</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">June 8</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Recharge</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Trade P/L</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Expected</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Current DB</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Fix Delta</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Assigns</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Flags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topDrift.map((user) => (
                    <tr key={user.user_id} className="hover:bg-yellow-50/40">
                      <td className="px-4 py-3 text-sm">
                        <div className="font-semibold text-slate-900">{user.name || "User"}</div>
                        <div className="text-xs text-slate-500">#{user.user_id}</div>
                      </td>
                      <td className="px-4 py-3 text-sm tabular-nums text-slate-700">
                        {fmtUsd(user.wallet_june8_usd)}
                      </td>
                      <td className="px-4 py-3 text-sm tabular-nums text-slate-700">
                        {fmtUsd(user.recharge_total_usd)}
                      </td>
                      <td
                        className={`px-4 py-3 text-sm font-semibold tabular-nums ${
                          user.simulated_trade_pl_usd >= 0 ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        {fmtUsd(user.simulated_trade_pl_usd)}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold tabular-nums text-slate-900">
                        {fmtUsd(user.expected_wallet_usd)}
                      </td>
                      <td className="px-4 py-3 text-sm tabular-nums text-slate-700">
                        {fmtUsd(user.current_db_wallet_usd)}
                      </td>
                      <td
                        className={`px-4 py-3 text-sm font-bold tabular-nums ${
                          user.drift_vs_db_usd >= 0 ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        {fmtUsd(user.drift_vs_db_usd)}
                      </td>
                      <td className="px-4 py-3 text-sm tabular-nums text-slate-700">
                        {user.assign_count}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        <div className="flex flex-wrap gap-1">
                          {user.needs_fix ? (
                            <span className="rounded-full bg-amber-100 px-2 py-1 font-semibold text-amber-900">
                              needs fix
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-100 px-2 py-1 font-semibold text-emerald-800">
                              ok
                            </span>
                          )}
                          {user.year_pack ? (
                            <span className="rounded-full bg-sky-100 px-2 py-1 font-semibold text-sky-800">
                              year pack
                            </span>
                          ) : null}
                          {user.pool_excluded ? (
                            <span className="rounded-full bg-slate-200 px-2 py-1 font-semibold text-slate-700">
                              pool excluded
                            </span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {topDrift.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-10 text-center text-slate-500">
                        No users found in the preview report.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default AdminWalletRebuildDocPage;
