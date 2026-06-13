import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Loader2, DollarSign, TrendingUp, Wallet, ArrowDownToLine, Percent } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API_BASE = "https://api.copytradeengine.org/api";

type LedgerTypeRow = {
  entry_type: string;
  row_count: number;
  total_delta: number;
};

type ReconciliationHint = {
  label: string;
  value_usd: number;
  mt5_hint: string;
};

type FinancialStats = {
  generated_at: string;
  fee_per_lot_usd: number;
  summary: {
    user_deposits_usd: number;
    pending_deposits_usd: number;
    user_wallets_total_usd: number;
    pending_withdrawals_usd: number;
    completed_withdrawals_usd: number;
    net_user_liability_usd: number;
    assign_fees_collected_usd: number;
    trade_settlement_net_usd: number;
    trade_settlement_credits_usd: number;
    trade_settlement_debits_usd: number;
    settled_user_pl_usd: number;
    rough_net_cash_retained_usd: number;
  };
  recharges: Record<string, number>;
  withdrawals: Record<string, number>;
  wallets: Record<string, number>;
  fees: Record<string, number>;
  settlements: Record<string, number>;
  trade_assign: Record<string, number>;
  mt5: Record<string, number>;
  ledger_by_type: LedgerTypeRow[];
  top_funded_users: Array<{
    user_id: number;
    name: string | null;
    email: string | null;
    wallet_usd: number;
    recharge_total_usd: number;
  }>;
  reconciliation_hints: ReconciliationHint[];
};

type Mt5LiveMetrics = {
  equity?: number;
  balance?: number;
  margin?: number;
  free_margin?: number;
  margin_level?: number;
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
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  accent?: "gold" | "emerald" | "red" | "blue" | "slate";
}) {
  const accents = {
    gold: "border-[#FFD700]/40 bg-[#FFF9E6]",
    emerald: "border-emerald-200 bg-emerald-50",
    red: "border-red-200 bg-red-50",
    blue: "border-blue-200 bg-blue-50",
    slate: "border-slate-200 bg-white",
  };
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${accents[accent]}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">${value}</p>
          {sub && <p className="mt-1 text-xs text-slate-600">{sub}</p>}
        </div>
        <Icon className="h-5 w-5 shrink-0 text-slate-400" />
      </div>
    </div>
  );
}

const AdminFinancialStatsPage = () => {
  const { toast } = useToast();
  const [stats, setStats] = useState<FinancialStats | null>(null);
  const [mt5Live, setMt5Live] = useState<Mt5LiveMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/financial-stats`);
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
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const s = stats?.summary;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Financial reconciliation</h1>
          <p className="mt-1 text-sm text-slate-500">
            Compare platform totals with your MT5 app — deposits, liabilities, fees, and master P/L.
          </p>
          {stats?.generated_at && (
            <p className="mt-1 text-xs text-slate-400">
              Last updated: {new Date(stats.generated_at).toLocaleString()}
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

      {loading && !stats ? (
        <div className="flex items-center justify-center py-20 text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading stats…
        </div>
      ) : stats && s ? (
        <>
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Key totals (match with MT5)
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <StatCard
                title="User deposits (recharges)"
                value={fmt(s.user_deposits_usd)}
                sub={`${stats.recharges.success_count} successful · $${fmt(s.pending_deposits_usd)} pending`}
                icon={DollarSign}
                accent="gold"
              />
              <StatCard
                title="Owed to users now"
                value={fmt(s.net_user_liability_usd)}
                sub={`Wallets $${fmt(s.user_wallets_total_usd)} + pending withdrawals $${fmt(s.pending_withdrawals_usd)}`}
                icon={Wallet}
                accent="blue"
              />
              <StatCard
                title="Paid out (withdrawals)"
                value={fmt(s.completed_withdrawals_usd)}
                sub={`${stats.withdrawals.completed_count} completed · $${fmt(s.pending_withdrawals_usd)} pending`}
                icon={ArrowDownToLine}
                accent="slate"
              />
              <StatCard
                title="Brokerage / assign fees"
                value={fmt(s.assign_fees_collected_usd)}
                sub={`$${stats.fee_per_lot_usd}/lot at assign · ${stats.fees.assign_fee_rows} ledger rows`}
                icon={Percent}
                accent="emerald"
              />
              <StatCard
                title="MT5 master P/L (DB)"
                value={fmt(stats.mt5.total_profit_usd)}
                sub={`Open $${fmt(stats.mt5.open_profit_usd)} · Closed $${fmt(stats.mt5.closed_profit_usd)}`}
                icon={TrendingUp}
                accent={stats.mt5.total_profit_usd >= 0 ? "emerald" : "red"}
              />
              <StatCard
                title="Trade settlements (net)"
                value={fmt(s.trade_settlement_net_usd)}
                sub={`Credits $${fmt(s.trade_settlement_credits_usd)} · Debits $${fmt(s.trade_settlement_debits_usd)}`}
                icon={TrendingUp}
              />
              <StatCard
                title="Settled user P/L (assign rows)"
                value={fmt(s.settled_user_pl_usd)}
                sub={`Profit $${fmt(stats.trade_assign.settled_profit_usd)} · Loss $${fmt(stats.trade_assign.settled_loss_usd)}`}
                icon={TrendingUp}
              />
              <StatCard
                title="Rough cash retained"
                value={fmt(s.rough_net_cash_retained_usd)}
                sub="Deposits − withdrawals − wallet balances"
                icon={DollarSign}
                accent="slate"
              />
            </div>
          </section>

          {mt5Live && (
            <section className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
              <h2 className="text-sm font-semibold text-indigo-900">Live MT5 push (last webhook)</h2>
              <p className="mt-1 text-xs text-indigo-700">
                From EA on trade push — compare with your MT5 app balance/equity.
              </p>
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

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800">Reconciliation guide</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-slate-500">
                    <th className="py-2 pr-4">Metric</th>
                    <th className="py-2 pr-4 text-right">USD</th>
                    <th className="py-2">MT5 / notes</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.reconciliation_hints.map((row) => (
                    <tr key={row.label} className="border-b border-slate-100">
                      <td className="py-2.5 pr-4 font-medium text-slate-800">{row.label}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums font-semibold">${fmt(row.value_usd)}</td>
                      <td className="py-2.5 text-slate-600">{row.mt5_hint}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-800">Ledger by entry type</h2>
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
                    {stats.ledger_by_type.map((row) => (
                      <tr key={row.entry_type} className="border-b border-slate-50">
                        <td className="py-2 pr-2 font-mono text-xs text-slate-700">{row.entry_type}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{row.row_count}</td>
                        <td
                          className={`py-2 text-right tabular-nums font-medium ${
                            row.total_delta >= 0 ? "text-emerald-700" : "text-red-700"
                          }`}
                        >
                          ${fmt(row.total_delta)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-800">Top funded users</h2>
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

          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
            <p className="font-semibold text-slate-700">Open copy trades</p>
            <p className="mt-1">
              {stats.trade_assign.open_rows} assign rows · {stats.trade_assign.open_users} users ·{" "}
              {fmt(stats.trade_assign.open_allocated_volume)} lots allocated · MT5 open tickets{" "}
              {stats.mt5.open_tickets} ({fmt(stats.mt5.open_volume)} lots)
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
};

export default AdminFinancialStatsPage;
