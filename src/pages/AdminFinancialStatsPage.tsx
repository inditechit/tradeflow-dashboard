import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  RefreshCw,
  Loader2,
  Wallet,
  Percent,
  TrendingUp,
  Package,
  Users,
  Radio,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useToast } from "@/hooks/use-toast";
import { API_BASE, SOCKET_URL } from "@/config/api";
import {
  groupOpenRowsByUser,
  sumPlatformLiveLiability,
  sumSocketMt5OpenProfit,
  type AdminOpenAssignRow,
  type FinanceUserRow,
} from "@/utils/adminLiveFinance";
import type { UserTradeRowLike } from "@/utils/userTradePl";
import { plTextClass } from "@/utils/plColors";

const socket = io(SOCKET_URL, { transports: ["websocket"] });

const PIE_COLORS = ["#E6B800", "#6366f1", "#10b981", "#f59e0b", "#94a3b8"];

type FinancialStats = {
  generated_at: string;
  owe_users_now_usd: number;
  owe_users_breakdown: {
    wallets_usd: number;
    pending_withdrawals_usd: number;
    open_live_user_pl_usd: number;
  };
  brokerage_fees_usd: number;
  admin_profit_share_usd: number;
  package_revenue_usd: number;
  referral_payable_usd: number;
  referral_earned_all_time_usd: number;
  admin_total_earned_usd: number;
  live: {
    mt5_open_profit_usd: number;
    mt5_open_tickets: number;
    copy_live_user_pl_usd: number;
    mt5_balance_usd: number | null;
    mt5_equity_usd: number | null;
    mt5_updated_at: string | null;
  };
  facts: {
    funded_users: number;
    wallet_users: number;
    total_recharged_usd: number;
    recharge_count: number;
    total_withdrawn_usd: number;
    pending_withdrawals_usd: number;
    package_sales_count: number;
  };
  charts: {
    monthly_revenue: Array<{ month: string; recharges_usd: number; packages_usd: number }>;
    admin_income_split: Array<{ name: string; value: number; key: string }>;
  };
};

type Mt5Metrics = {
  balance?: number;
  equity?: number;
  updated_at?: string;
};

function fmt(n: number | undefined | null) {
  return Number(n ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function HeroCard({
  title,
  value,
  sub,
  icon: Icon,
  accent = "slate",
  valueClass,
  live,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  accent?: "red" | "gold" | "emerald" | "purple" | "blue";
  valueClass?: string;
  live?: boolean;
}) {
  const styles = {
    red: "border-red-200 bg-red-50",
    gold: "border-[#FFD700]/50 bg-[#FFF9E6]",
    emerald: "border-emerald-200 bg-emerald-50",
    purple: "border-purple-200 bg-purple-50",
    blue: "border-blue-200 bg-blue-50",
    slate: "border-slate-200 bg-white",
  };
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${styles[accent]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
            {live && (
              <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                LIVE
              </span>
            )}
          </div>
          <p className={`mt-2 text-3xl font-bold tabular-nums ${valueClass ?? "text-slate-900"}`}>
            ${value}
          </p>
          {sub && <p className="mt-2 text-xs leading-relaxed text-slate-600">{sub}</p>}
        </div>
        <Icon className="h-6 w-6 shrink-0 text-slate-400" />
      </div>
    </div>
  );
}

const AdminFinancialStatsPage = () => {
  const { toast } = useToast();
  const [stats, setStats] = useState<FinancialStats | null>(null);
  const [financeUsers, setFinanceUsers] = useState<FinanceUserRow[]>([]);
  const [openRowsByUser, setOpenRowsByUser] = useState<Record<number, UserTradeRowLike[]>>({});
  const [mt5Metrics, setMt5Metrics] = useState<Mt5Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [socketLive, setSocketLive] = useState(false);
  const [liveTick, setLiveTick] = useState(0);
  const walletPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadStatic = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/financial-stats`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to load");
      setStats(data.stats);
      if (data.mt5_live_metrics) {
        setMt5Metrics({
          balance: data.mt5_live_metrics.balance,
          equity: data.mt5_live_metrics.equity,
          updated_at: data.mt5_live_metrics.updated_at,
        });
      }
    } catch (e) {
      if (!quiet) {
        toast({
          title: "Error",
          description: e instanceof Error ? e.message : "Could not load stats",
          variant: "destructive",
        });
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [toast]);

  const loadLiveContext = useCallback(async () => {
    try {
      const [usersRes, openRes] = await Promise.all([
        fetch(`${API_BASE}/admin/users?finance=1`),
        fetch(`${API_BASE}/admin/open-assignments`),
      ]);
      const usersData = await usersRes.json();
      const openData = await openRes.json();
      if (usersData.success && Array.isArray(usersData.users)) {
        setFinanceUsers(
          usersData.users.map((u: Record<string, unknown>) => ({
            id: Number(u.id),
            wallet_balance: Number(u.wallet_balance ?? 0),
            deposit_baseline: Number(u.deposit_baseline ?? 0),
          })),
        );
      }
      if (openData.success && Array.isArray(openData.assignments)) {
        setOpenRowsByUser(groupOpenRowsByUser(openData.assignments as AdminOpenAssignRow[]));
      }
    } catch {
      /* keep last socket state */
    }
  }, []);

  useEffect(() => {
    void loadStatic();
    void loadLiveContext();
    walletPollRef.current = setInterval(() => void loadLiveContext(), 30_000);
    return () => {
      if (walletPollRef.current) clearInterval(walletPollRef.current);
    };
  }, [loadStatic, loadLiveContext]);

  useEffect(() => {
    const applyTicketProfit = (payload: { ticket?: unknown; profit?: unknown }) => {
      const ticket = String(payload.ticket ?? "");
      const raw = Number(payload.profit);
      if (!ticket || !Number.isFinite(raw)) return;

      setOpenRowsByUser((prev) => {
        let any = false;
        const next: Record<number, UserTradeRowLike[]> = { ...prev };
        for (const [uidKey, rows] of Object.entries(prev)) {
          let userTouched = false;
          const updated = rows.map((r) => {
            if (String(r.ticket_id ?? "") !== ticket) return r;
            userTouched = true;
            return { ...r, mt5_total_profit: raw };
          });
          if (userTouched) {
            any = true;
            next[Number(uidKey)] = updated;
          }
        }
        return any ? next : prev;
      });
      setLiveTick((t) => t + 1);
    };

    const onMetrics = (payload: { metrics?: Mt5Metrics } & Mt5Metrics) => {
      const m = payload?.metrics ?? payload;
      if (m && (m.equity != null || m.balance != null)) {
        setMt5Metrics({
          balance: m.balance != null ? Number(m.balance) : undefined,
          equity: m.equity != null ? Number(m.equity) : undefined,
          updated_at: new Date().toISOString(),
        });
        setLiveTick((t) => t + 1);
      }
    };

    const onConnect = () => setSocketLive(true);
    const onDisconnect = () => setSocketLive(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("mt5live", applyTicketProfit);
    socket.on("mt5data", applyTicketProfit);
    socket.on("mt5metrics", onMetrics);
    setSocketLive(socket.connected);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("mt5live", applyTicketProfit);
      socket.off("mt5data", applyTicketProfit);
      socket.off("mt5metrics", onMetrics);
    };
  }, []);

  const pendingWithdrawals =
    stats?.facts.pending_withdrawals_usd ??
    stats?.owe_users_breakdown.pending_withdrawals_usd ??
    0;

  const liveLiability = useMemo(() => {
    void liveTick;
    if (!financeUsers.length) {
      return stats?.owe_users_breakdown ?? null;
    }
    return sumPlatformLiveLiability(financeUsers, openRowsByUser, pendingWithdrawals);
  }, [financeUsers, openRowsByUser, pendingWithdrawals, stats, liveTick]);

  const liveCopyPl = liveLiability?.open_live_user_pl_usd ?? stats?.live.copy_live_user_pl_usd ?? 0;
  const liveMt5OpenPl = useMemo(() => {
    void liveTick;
    const fromSocket = sumSocketMt5OpenProfit(openRowsByUser);
    if (Object.keys(openRowsByUser).length > 0) return fromSocket;
    return stats?.live.mt5_open_profit_usd ?? 0;
  }, [openRowsByUser, stats, liveTick]);

  const oweNow = liveLiability?.owe_users_now_usd ?? stats?.owe_users_now_usd ?? 0;
  const walletsUsd = liveLiability?.wallets_usd ?? stats?.owe_users_breakdown.wallets_usd ?? 0;

  const monthly = stats?.charts.monthly_revenue ?? [];
  const incomeSplit = stats?.charts.admin_income_split ?? [];

  const refreshAll = () => {
    void loadStatic();
    void loadLiveContext();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Admin finances</h1>
          <p className="mt-1 text-sm text-slate-500">
            What you owe users and what you earned — open P/L updates live from MT5 socket.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
            {stats?.generated_at && (
              <span>Base data {new Date(stats.generated_at).toLocaleString()}</span>
            )}
            <span className="inline-flex items-center gap-1">
              <Radio className={`h-3 w-3 ${socketLive ? "text-emerald-500" : "text-slate-300"}`} />
              {socketLive ? "Socket live — P/L updates instantly" : "Socket offline"}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={refreshAll}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-[#FFD700] px-4 py-2 text-sm font-semibold text-black hover:bg-[#E6C200] disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      {loading && !stats ? (
        <div className="flex justify-center py-24 text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading…
        </div>
      ) : stats ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <HeroCard
              title="Pay users if all stop now"
              value={fmt(oweNow)}
              sub={`Wallets $${fmt(walletsUsd)} + pending $${fmt(pendingWithdrawals)} + open P/L $${fmt(liveCopyPl)}`}
              icon={Wallet}
              accent="red"
              live={socketLive && financeUsers.length > 0}
            />
            <HeroCard
              title="Brokerage fees (all time)"
              value={fmt(stats.brokerage_fees_usd)}
              sub="Assign fee per lot debited at trade open"
              icon={Percent}
              accent="gold"
            />
            <HeroCard
              title="Admin profit share (all time)"
              value={fmt(stats.admin_profit_share_usd)}
              sub="Your cut when copy trades closed"
              icon={TrendingUp}
              accent="purple"
            />
            <HeroCard
              title="Package sales (all time)"
              value={fmt(stats.package_revenue_usd)}
              sub={`${stats.facts.package_sales_count} successful package payments`}
              icon={Package}
              accent="emerald"
            />
            <HeroCard
              title="Referral payable now"
              value={fmt(stats.referral_payable_usd)}
              sub={`Total earned all time: $${fmt(stats.referral_earned_all_time_usd)} in affiliate wallets`}
              icon={Users}
              accent="blue"
            />
            <HeroCard
              title="Your total earned"
              value={fmt(stats.admin_total_earned_usd)}
              sub="Fees + profit share + packages + withdraw fees"
              icon={TrendingUp}
              accent="gold"
            />
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
              <p className="font-semibold text-slate-700">Quick facts</p>
              <ul className="mt-3 space-y-2 text-slate-600">
                <li className="flex justify-between">
                  <span>Funded copy users</span>
                  <span className="font-medium tabular-nums">{stats.facts.funded_users}</span>
                </li>
                <li className="flex justify-between">
                  <span>Total recharged</span>
                  <span className="font-medium tabular-nums">${fmt(stats.facts.total_recharged_usd)}</span>
                </li>
                <li className="flex justify-between">
                  <span>Total withdrawl</span>
                  <span className="font-medium tabular-nums">${fmt(stats.facts.total_withdrawn_usd)}</span>
                </li>
                <li className="flex justify-between">
                  <span>Pending withdrawals</span>
                  <span className="font-medium tabular-nums">${fmt(pendingWithdrawals)}</span>
                </li>
                <li className="flex justify-between">
                  <span>Open MT5 tickets</span>
                  <span className="font-medium tabular-nums">{stats.live.mt5_open_tickets}</span>
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 text-sm shadow-sm md:col-span-2">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-indigo-900">MT5 live</p>
                {socketLive && (
                  <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                    LIVE
                  </span>
                )}
              </div>
              <div className="mt-3 grid gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-indigo-600">Master equity</p>
                  <p className="text-lg font-bold tabular-nums text-indigo-950">
                    {mt5Metrics?.equity != null ? `$${fmt(mt5Metrics.equity)}` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-indigo-600">Master balance</p>
                  <p className="text-lg font-bold tabular-nums text-indigo-950">
                    {mt5Metrics?.balance != null ? `$${fmt(mt5Metrics.balance)}` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-indigo-600">Open P/L (socket)</p>
                  <p className={`text-lg font-bold tabular-nums ${plTextClass(liveMt5OpenPl)}`}>
                    ${fmt(liveMt5OpenPl)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-indigo-600">Copy user open P/L</p>
                  <p className={`text-lg font-bold tabular-nums ${plTextClass(liveCopyPl)}`}>
                    ${fmt(liveCopyPl)}
                  </p>
                </div>
              </div>
              {mt5Metrics?.updated_at && (
                <p className="mt-2 text-xs text-indigo-500">
                  Last metrics push: {new Date(mt5Metrics.updated_at).toLocaleString()}
                </p>
              )}
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-800">Revenue last 6 months</h2>
              <p className="text-xs text-slate-500">User recharges vs package sales</p>
              <div className="mt-4 h-64">
                {monthly.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                      <Tooltip formatter={(v: number) => `$${fmt(v)}`} />
                      <Legend />
                      <Bar dataKey="recharges_usd" name="Recharges" fill="#E6B800" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="packages_usd" name="Packages" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-16 text-center text-sm text-slate-400">No payment data yet</p>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-800">Your income split</h2>
              <p className="text-xs text-slate-500">All-time breakdown</p>
              <div className="mt-4 h-64">
                {incomeSplit.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={incomeSplit}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={88}
                        label={({ name, percent }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                      >
                        {incomeSplit.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => `$${fmt(v)}`} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-16 text-center text-sm text-slate-400">No earnings recorded yet</p>
                )}
              </div>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default AdminFinancialStatsPage;
