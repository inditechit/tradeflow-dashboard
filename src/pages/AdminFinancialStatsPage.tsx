import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw,
  Loader2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowDownToLine,
  Percent,
  Package,
  Calendar,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { plTextClass } from "@/utils/plColors";

const API_BASE = "https://api.copytradeengine.org/api";

type LedgerTypeRow = {
  entry_type: string;
  row_count: number;
  total_delta: number;
};

type PackageRow = {
  package_id: string;
  payment_count: number;
  success_count: number;
  success_usd: number;
  pending_usd: number;
};

type PeriodMetrics = {
  recharges: { success_usd: number; pending_usd: number; success_count: number; pending_count: number };
  packages: { total_success_usd: number; success_count: number; by_package: PackageRow[] };
  withdrawals: {
    completed_usd: number;
    pending_usd: number;
    completed_count: number;
    pending_count: number;
    fee_usd: number;
  };
  fees: {
    assign_net_usd: number;
    assign_collected_usd: number;
    assign_refunds_usd: number;
    assign_fee_rows: number;
  };
  affiliate: { paid_usd: number; reversed_usd: number; net_usd: number };
  profit_loss: {
    mt5_closed_profit_usd: number;
    mt5_closed_tickets: number;
    settlement_raw_pl_usd: number;
    settlement_user_wallet_usd: number;
    settlement_credits_usd: number;
    settlement_debits_usd: number;
    settlement_net_usd: number;
    settled_assign_profit_usd: number;
    settled_assign_loss_usd: number;
    settled_assign_net_usd: number;
    settled_assign_rows: number;
  };
  admin_earnings: {
    assign_fees_usd: number;
    profit_share_usd: number;
    package_sales_usd: number;
    withdrawal_fees_usd: number;
    affiliate_paid_usd: number;
    total_usd: number;
  };
  ledger_by_type: LedgerTypeRow[];
};

type FinancialStats = {
  generated_at: string;
  fee_per_lot_usd: number;
  baseline_profit_share: boolean;
  filter: { active: boolean; from: string | null; to: string | null; label: string };
  live: {
    open_tickets: number;
    open_volume: number;
    mt5_open_profit_usd: number;
    open_assign_rows: number;
    open_users: number;
    copy_live_raw_pl_usd: number;
    copy_live_user_pl_usd: number;
    copy_live_admin_estimate_usd: number;
    copy_live_fees_on_open_usd: number;
    copy_live_equity_usd: number;
    funded_wallets_usd: number;
  };
  display: PeriodMetrics;
  snapshot: {
    user_wallets_total_usd: number;
    funded_users: number;
    net_user_liability_usd: number;
    mt5_open_profit_all_time_usd: number;
    mt5_closed_profit_all_time_usd: number;
    mt5_total_profit_all_time_usd: number;
  };
  top_funded_users: Array<{
    user_id: number;
    name: string | null;
    email: string | null;
    wallet_usd: number;
    recharge_total_usd: number;
  }>;
};

type Mt5LiveMetrics = {
  equity?: number;
  balance?: number;
  margin?: number;
  free_margin?: number;
  updated_at?: string;
};

function fmt(n: number | undefined | null) {
  return Number(n ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  accent = "slate",
  valueClass,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  accent?: "gold" | "emerald" | "red" | "blue" | "slate" | "purple";
  valueClass?: string;
}) {
  const accents = {
    gold: "border-[#FFD700]/40 bg-[#FFF9E6]",
    emerald: "border-emerald-200 bg-emerald-50",
    red: "border-red-200 bg-red-50",
    blue: "border-blue-200 bg-blue-50",
    purple: "border-purple-200 bg-purple-50",
    slate: "border-slate-200 bg-white",
  };
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${accents[accent]}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${valueClass ?? "text-slate-900"}`}>${value}</p>
          {sub && <p className="mt-1 text-xs text-slate-600">{sub}</p>}
        </div>
        <Icon className="h-5 w-5 shrink-0 text-slate-400" />
      </div>
    </div>
  );
}

const PACKAGE_LABELS: Record<string, string> = {
  "7-day-trial": "7-day trial",
  "1-month": "1 month",
  "3-month": "3 months",
  "6-month": "6 months",
  "1-year": "1 year",
  "india-tour": "India tour",
  "intl-tour": "International tour",
  "meet-guru": "Meet guru",
};

const AdminFinancialStatsPage = () => {
  const { toast } = useToast();
  const [stats, setStats] = useState<FinancialStats | null>(null);
  const [mt5Live, setMt5Live] = useState<Mt5LiveMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (dateFrom) qs.set("from", dateFrom);
      if (dateTo) qs.set("to", dateTo);
      const res = await fetch(`${API_BASE}/admin/financial-stats?${qs}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to load stats");
      setStats(data.stats);
      setMt5Live(data.mt5_live_metrics ?? null);
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Could not load financial stats",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  const d = stats?.display;
  const live = stats?.live;
  const snap = stats?.snapshot;
  const pl = d?.profit_loss;
  const admin = d?.admin_earnings;
  const periodLabel = stats?.filter.active ? stats.filter.label : "All time";

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Financial reconciliation</h1>
          <p className="mt-1 text-sm text-slate-500">
            Live P/L, admin earnings, package sales — match with your MT5 app.
          </p>
          {stats?.generated_at && (
            <p className="mt-1 text-xs text-slate-400">
              Last updated: {new Date(stats.generated_at).toLocaleString()}
              {stats.filter.active && ` · Showing: ${stats.filter.label}`}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-[#FFD700] px-4 py-2 text-sm font-semibold text-black hover:bg-[#E6C200] disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      {/* Date filter */}
      <section className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Calendar className="h-4 w-4 text-slate-400" />
          Date range
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-black"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-black"
          />
        </div>
        <button
          type="button"
          onClick={load}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={() => {
            setDateFrom("");
            setDateTo("");
          }}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700"
        >
          Clear dates
        </button>
        <p className="w-full text-xs text-slate-500">
          Period stats filter recharges, settlements, fees, and closed MT5 trades by date. Live section is always current.
        </p>
      </section>

      {loading && !stats ? (
        <div className="flex items-center justify-center py-20 text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading stats…
        </div>
      ) : stats && d && live && snap && pl && admin ? (
        <>
          {/* LIVE — always current */}
          <section>
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-indigo-600">Live now (open trades)</h2>
            <p className="mb-3 text-xs text-slate-500">Updates on refresh — compare with MT5 app open P/L.</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <StatCard
                title="MT5 open P/L"
                value={fmt(live.mt5_open_profit_usd)}
                sub={`${live.open_tickets} tickets · ${fmt(live.open_volume)} lots`}
                icon={TrendingUp}
                accent={live.mt5_open_profit_usd >= 0 ? "emerald" : "red"}
                valueClass={plTextClass(live.mt5_open_profit_usd)}
              />
              <StatCard
                title="Copy pool raw P/L"
                value={fmt(live.copy_live_raw_pl_usd)}
                sub="Gross proportional share before fee split"
                icon={TrendingUp}
                valueClass={plTextClass(live.copy_live_raw_pl_usd)}
              />
              <StatCard
                title="Copy pool user P/L"
                value={fmt(live.copy_live_user_pl_usd)}
                sub={`${live.open_users} users · ${live.open_assign_rows} assigns`}
                icon={TrendingUp}
                accent="blue"
                valueClass={plTextClass(live.copy_live_user_pl_usd)}
              />
              <StatCard
                title="Admin share (open est.)"
                value={fmt(live.copy_live_admin_estimate_usd)}
                sub="Estimated if closed now at current MT5 profit"
                icon={Percent}
                accent="purple"
              />
              <StatCard
                title="Fees on open trades"
                value={fmt(live.copy_live_fees_on_open_usd)}
                sub={`$${stats.fee_per_lot_usd}/lot booked on assigns`}
                icon={Percent}
                accent="emerald"
              />
              <StatCard
                title="User wallets (all)"
                value={fmt(live.funded_wallets_usd)}
                sub={`${snap.funded_users} funded users · liability $${fmt(snap.net_user_liability_usd)}`}
                icon={Wallet}
                accent="gold"
              />
            </div>
          </section>

          {mt5Live && (
            <section className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
              <h2 className="text-sm font-semibold text-indigo-900">MT5 EA webhook (last push)</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                <div>
                  <p className="text-xs text-indigo-600">Balance</p>
                  <p className="text-lg font-bold tabular-nums text-indigo-950">${fmt(mt5Live.balance)}</p>
                </div>
                <div>
                  <p className="text-xs text-indigo-600">Equity</p>
                  <p className="text-lg font-bold tabular-nums text-indigo-950">${fmt(mt5Live.equity)}</p>
                </div>
                <div>
                  <p className="text-xs text-indigo-600">Margin</p>
                  <p className="text-lg font-bold tabular-nums text-indigo-950">${fmt(mt5Live.margin)}</p>
                </div>
                <div>
                  <p className="text-xs text-indigo-600">Free margin</p>
                  <p className="text-lg font-bold tabular-nums text-indigo-950">${fmt(mt5Live.free_margin)}</p>
                </div>
              </div>
              {mt5Live.updated_at && (
                <p className="mt-2 text-xs text-indigo-500">
                  Received: {new Date(mt5Live.updated_at).toLocaleString()}
                </p>
              )}
            </section>
          )}

          {/* Admin earnings — period */}
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-purple-700">
              Admin earnings · {periodLabel}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <StatCard
                title="Total admin earning"
                value={fmt(admin.total_usd)}
                sub="Fees + profit share + packages + withdraw fees − affiliate"
                icon={DollarSign}
                accent="purple"
              />
              <StatCard
                title="Assign / brokerage fees"
                value={fmt(admin.assign_fees_usd)}
                sub={`${d.fees.assign_fee_rows} ledger rows`}
                icon={Percent}
                accent="emerald"
              />
              <StatCard
                title="Profit share (settled)"
                value={fmt(admin.profit_share_usd)}
                sub="Admin cut when copy trades closed"
                icon={TrendingUp}
                accent="purple"
              />
              <StatCard
                title="Package sales"
                value={fmt(admin.package_sales_usd)}
                sub={`${d.packages.success_count} successful payments`}
                icon={Package}
                accent="gold"
              />
              <StatCard
                title="Withdrawal fees"
                value={fmt(admin.withdrawal_fees_usd)}
                sub={`Affiliate paid: $${fmt(admin.affiliate_paid_usd)}`}
                icon={ArrowDownToLine}
              />
            </div>
          </section>

          {/* P/L — period */}
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Profit & loss · {periodLabel}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <StatCard
                title="MT5 closed P/L"
                value={fmt(pl.mt5_closed_profit_usd)}
                sub={`${pl.mt5_closed_tickets} closed tickets in range`}
                icon={TrendingUp}
                valueClass={plTextClass(pl.mt5_closed_profit_usd)}
              />
              <StatCard
                title="Settlement gross (raw)"
                value={fmt(pl.settlement_raw_pl_usd)}
                sub="Raw proportional P/L at close"
                icon={TrendingUp}
                valueClass={plTextClass(pl.settlement_raw_pl_usd)}
              />
              <StatCard
                title="User wallet settlements"
                value={fmt(pl.settlement_net_usd)}
                sub={`Credits $${fmt(pl.settlement_credits_usd)} · Debits $${fmt(pl.settlement_debits_usd)}`}
                icon={Wallet}
                valueClass={plTextClass(pl.settlement_net_usd)}
              />
              <StatCard
                title="Settled assign P/L"
                value={fmt(pl.settled_assign_net_usd)}
                sub={`Profit $${fmt(pl.settled_assign_profit_usd)} · Loss $${fmt(pl.settled_assign_loss_usd)} · ${pl.settled_assign_rows} rows`}
                icon={TrendingDown}
                valueClass={plTextClass(pl.settled_assign_net_usd)}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              All-time MT5 P/L: open ${fmt(snap.mt5_open_profit_all_time_usd)} + closed ${fmt(snap.mt5_closed_profit_all_time_usd)} = ${fmt(snap.mt5_total_profit_all_time_usd)}
            </p>
          </section>

          {/* Cash flow — period */}
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Cash flow · {periodLabel}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="User recharges"
                value={fmt(d.recharges.success_usd)}
                sub={`${d.recharges.success_count} success · $${fmt(d.recharges.pending_usd)} pending`}
                icon={DollarSign}
                accent="gold"
              />
              <StatCard
                title="Withdrawals paid"
                value={fmt(d.withdrawals.completed_usd)}
                sub={`${d.withdrawals.completed_count} completed · $${fmt(d.withdrawals.pending_usd)} pending`}
                icon={ArrowDownToLine}
              />
              <StatCard
                title="User wallets (now)"
                value={fmt(snap.user_wallets_total_usd)}
                sub="Snapshot — not date filtered"
                icon={Wallet}
                accent="blue"
              />
              <StatCard
                title="Owed to users"
                value={fmt(snap.net_user_liability_usd)}
                sub="Wallets + pending withdrawals"
                icon={Wallet}
              />
            </div>
          </section>

          {/* Package breakdown */}
          {d.packages.by_package.length > 0 && (
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-800">Package sales · {periodLabel}</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-slate-500">
                      <th className="py-2 pr-4">Package</th>
                      <th className="py-2 pr-4 text-right">Success</th>
                      <th className="py-2 pr-4 text-right">Revenue</th>
                      <th className="py-2 text-right">Pending</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.packages.by_package.map((p) => (
                      <tr key={p.package_id} className="border-b border-slate-50">
                        <td className="py-2.5 pr-4 font-medium text-slate-800">
                          {PACKAGE_LABELS[p.package_id] ?? p.package_id}
                        </td>
                        <td className="py-2.5 pr-4 text-right tabular-nums">{p.success_count}</td>
                        <td className="py-2.5 pr-4 text-right tabular-nums font-semibold text-emerald-700">
                          ${fmt(p.success_usd)}
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-slate-600">${fmt(p.pending_usd)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold">
                      <td className="py-2 pr-4">Total</td>
                      <td className="py-2 pr-4 text-right">{d.packages.success_count}</td>
                      <td className="py-2 pr-4 text-right text-emerald-700">${fmt(d.packages.total_success_usd)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-800">Ledger by type · {periodLabel}</h2>
              <div className="mt-3 max-h-80 overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-slate-500">
                      <th className="py-2 pr-2">Type</th>
                      <th className="py-2 pr-2 text-right">Rows</th>
                      <th className="py-2 text-right">Net delta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.ledger_by_type.map((row) => (
                      <tr key={row.entry_type} className="border-b border-slate-50">
                        <td className="py-2 pr-2 font-mono text-xs text-slate-700">{row.entry_type}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{row.row_count}</td>
                        <td className={`py-2 text-right tabular-nums font-medium ${plTextClass(row.total_delta)}`}>
                          ${fmt(row.total_delta)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-800">Top funded users (current)</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-slate-500">
                      <th className="py-2 pr-2">User</th>
                      <th className="py-2 pr-2 text-right">Wallet</th>
                      <th className="py-2 text-right">Recharged</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.top_funded_users.map((u) => (
                      <tr key={u.user_id} className="border-b border-slate-50">
                        <td className="py-2 pr-2">
                          <div className="font-medium text-slate-800">{u.name || `User ${u.user_id}`}</div>
                          <div className="text-xs text-slate-500">ID {u.user_id}</div>
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums font-semibold">${fmt(u.wallet_usd)}</td>
                        <td className="py-2 text-right tabular-nums text-slate-600">${fmt(u.recharge_total_usd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default AdminFinancialStatsPage;
