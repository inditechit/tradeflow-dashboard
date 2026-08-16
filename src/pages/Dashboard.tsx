import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { io } from "socket.io-client";
import {
  RefreshCw,
  Wallet,
  ArrowDownToLine,
  Users,
  Activity,
  Landmark,
  Radio,
  TrendingUp,
  TrendingDown,
  Shield,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { plTextClass } from "@/utils/plColors";
import { parseUserRiskIds } from "@/utils/userRiskProfile";
import { API_BASE, SOCKET_URL } from "@/config/api";
import { TicketAssignDialog } from "@/components/admin/TicketAssignDialog";
import type { AdminOpenAssignRow } from "@/utils/adminLiveFinance";
import { resolveRowAdminUserPl } from "@/utils/adminLiveFinance";
import {
  fmtMt5Price,
  formatMt5SideLabel,
  isTradeClosed,
  isUserStoppedTrade,
  resolveEffectiveSlice,
  resolveMt5BuySellPrices,
  type UserTradeRowLike,
} from "@/utils/userTradePl";

const socket = io(SOCKET_URL, {
  transports: ["websocket"],
});

const RISK_BAR_COLORS: Record<string, string> = {
  LOW: "#10b981",
  MEDIUM: "#eab308",
  HIGH: "#f97316",
  SUPER_HIGH: "#ef4444",
  UNSET: "#94a3b8",
};

type SegmentRow = {
  id: string;
  label: string;
  users: number;
  funded: number;
  wallet_usd: number;
  live_pl_usd: number;
  equity_usd: number;
};

type FinancialStats = {
  facts: {
    funded_users: number;
    trader_users?: number;
    wallet_users?: number;
    total_recharged_usd: number;
    total_withdrawn_usd: number;
    settled_gross_profit_usd?: number;
    settled_gross_loss_usd?: number;
  };
  live: {
    mt5_open_tickets: number;
    copy_live_user_pl_usd: number;
    user_equity_usd?: number;
    mt5_open_profit_usd?: number;
  };
  owe_users_breakdown?: {
    wallets_usd: number;
    open_live_user_pl_usd: number;
  };
  charts?: {
    users_by_risk?: SegmentRow[];
    users_by_kyc?: SegmentRow[];
    users_by_trading?: SegmentRow[];
  };
};

type Mt5Trade = {
  ticket?: number | string;
  symbol?: string;
  status?: string;
  profit?: number | string;
  volume?: number | string;
  price?: number | string;
  type?: string;
  open_time?: string | null;
  close_time?: string | null;
};

type AdminUserRow = {
  id?: number;
  role?: string;
  risk?: unknown;
  kyc_status?: string;
  trading_active?: number | boolean;
  wallet_balance?: number | string;
  trading_wallet_usd?: number | string;
  safe_wallet_usd?: number | string;
};

const RISK_ORDER = ["LOW", "MEDIUM", "HIGH", "SUPER_HIGH", "UNSET"] as const;

function emptySegment(id: string, label: string): SegmentRow {
  return { id, label, users: 0, funded: 0, wallet_usd: 0, live_pl_usd: 0, equity_usd: 0 };
}

function bumpSegment(bucket: SegmentRow, wallet: number) {
  bucket.users += 1;
  if (wallet > 0.02) bucket.funded += 1;
  bucket.wallet_usd += wallet;
  bucket.equity_usd += wallet;
}

function buildSegmentsFromUsers(users: AdminUserRow[]) {
  const byRisk: Record<string, SegmentRow> = Object.fromEntries(
    RISK_ORDER.map((id) => [
      id,
      emptySegment(id, id === "UNSET" ? "No risk set" : id.replace(/_/g, " ")),
    ]),
  );
  const byKyc: Record<string, SegmentRow> = {};
  const byTrading = {
    active: emptySegment("active", "Trading on"),
    paused: emptySegment("paused", "Trading paused"),
  };

  for (const u of users) {
    const role = String(u.role ?? "").toLowerCase();
    if (role === "admin" || role === "employee") continue;
    const wallet = Number(u.wallet_balance ?? 0) || 0;
    const riskId = parseUserRiskIds(u.risk)[0] ?? "UNSET";
    bumpSegment(byRisk[riskId] ?? byRisk.UNSET, wallet);

    const kyc = String(u.kyc_status || "pending").toLowerCase() || "pending";
    if (!byKyc[kyc]) byKyc[kyc] = emptySegment(kyc, kyc.replace(/_/g, " "));
    bumpSegment(byKyc[kyc], wallet);

    bumpSegment(Number(u.trading_active) === 0 ? byTrading.paused : byTrading.active, wallet);
  }

  return {
    by_risk: RISK_ORDER.map((id) => byRisk[id]),
    by_kyc: Object.values(byKyc).sort((a, b) => b.users - a.users),
    by_trading: [byTrading.active, byTrading.paused],
  };
}

const fmtMoney = (n: number | null | undefined) => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n));
};

const fmtInt = (n: number | null | undefined) => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return new Intl.NumberFormat("en-US").format(Number(n));
};

const fmtUsd = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function fmtLots(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return "—";
  return v >= 0.01 ? v.toFixed(2) : v.toFixed(4);
}

function fmtMt5DateTime(raw: string | null | undefined): string {
  if (!raw) return "—";
  const ms = Date.parse(String(raw).replace(" ", "T"));
  if (!Number.isFinite(ms)) return "—";
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function isMasterTradeClosed(r: AdminOpenAssignRow): boolean {
  const st = String(r.mt5_status ?? "").toUpperCase();
  if (st.includes("CLOSE")) return true;
  const ct = r.close_time;
  return ct != null && String(ct).trim() !== "" && String(ct) !== "0000-00-00 00:00:00";
}

function ticketSharePct(rows: AdminOpenAssignRow[]): number {
  if (!rows.length) return 0;
  const V = Number(rows[0]?.mt5_volume ?? rows[0]?.total_trade_volume ?? 0);
  if (V > 0) {
    let allocSum = 0;
    for (const r of rows) allocSum += Number(r.allocated_volume ?? 0);
    return Math.round((allocSum / V) * 10000) / 100;
  }
  let sum = 0;
  for (const r of rows) {
    const { effectiveShare } = resolveEffectiveSlice(r);
    sum += effectiveShare;
  }
  return Math.round(sum * 10000) / 100;
}

const normStatus = (t: Mt5Trade) => String(t?.status ?? "").toUpperCase();

function KpiCard({
  icon,
  label,
  value,
  sub,
  valueClass,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
      <div className="flex items-center justify-between gap-1">
        <p className="truncate text-[10px] font-semibold uppercase leading-tight tracking-wide text-slate-500">
          {label}
        </p>
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-50 text-slate-600">
          {icon}
        </div>
      </div>
      <p className={`mt-1 truncate text-sm font-extrabold tabular-nums leading-tight sm:text-base ${valueClass ?? "text-slate-900"}`}>
        {value}
      </p>
      {sub ? <p className="mt-0.5 truncate text-[10px] leading-tight text-slate-500">{sub}</p> : null}
    </div>
  );
}

const Dashboard = () => {
  const [trades, setTrades] = useState<Mt5Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<FinancialStats | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [walletTotals, setWalletTotals] = useState({ trading: 0, safe: 0 });
  const [assignments, setAssignments] = useState<AdminOpenAssignRow[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [liveProfitByTicket, setLiveProfitByTicket] = useState<Record<string, number>>({});
  const [dialogTicket, setDialogTicket] = useState<string | null>(null);

  const fetchFinancials = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/financial-stats`);
      const data = await res.json();
      if (data.success && data.stats) {
        setStats(data.stats as FinancialStats);
      }
    } catch {
      /* ignore */
    }
  };

  const fetchTrades = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/mt5-trades`);
      const data = await res.json();
      if (data.success) {
        setTrades(data.trades);
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignments = useCallback(async () => {
    try {
      setAssignLoading(true);
      const res = await fetch(`${API_BASE}/admin/open-assignments?all=1`);
      const data = await res.json();
      if (data.success && Array.isArray(data.assignments)) {
        setAssignments(data.assignments as AdminOpenAssignRow[]);
      }
    } catch (err) {
      console.error("Fetch assignments error:", err);
    } finally {
      setAssignLoading(false);
    }
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/users`);
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        setUsers(data.users);
        const fromTotalsTrading = Number(data.totals?.sum_trading_wallet_usd ?? data.totals?.sum_wallet_balances_usd);
        const fromTotalsSafe = Number(data.totals?.sum_safe_wallet_usd);
        const trading = Number.isFinite(fromTotalsTrading)
          ? fromTotalsTrading
          : data.users.reduce(
              (sum: number, u: AdminUserRow) =>
                sum + Number(u.trading_wallet_usd ?? u.wallet_balance ?? 0),
              0,
            );
        const safe = Number.isFinite(fromTotalsSafe)
          ? fromTotalsSafe
          : data.users.reduce(
              (sum: number, u: AdminUserRow) => sum + Number(u.safe_wallet_usd ?? 0),
              0,
            );
        setWalletTotals({ trading, safe });
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    fetchTrades();
    fetchFinancials();
    fetchUsers();
    void fetchAssignments();

    socket.on("mt5data", (trade: Mt5Trade) => {
      setTrades((prev) => {
        const index = prev.findIndex((t) => Number(t.ticket) === Number(trade.ticket));
        if (index !== -1) {
          const updatedTrades = [...prev];
          updatedTrades[index] = { ...updatedTrades[index], ...trade };
          return updatedTrades;
        }
        return [trade, ...prev];
      });
    });

    socket.on("mt5close", (trade: Mt5Trade) => {
      setTrades((prev) => {
        const ticket = Number(trade.ticket);
        const idx = prev.findIndex((t) => Number(t.ticket) === ticket);
        const merged = {
          ...trade,
          status: normStatus(trade) || "CLOSED",
        };
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...merged };
          return next;
        }
        return [merged, ...prev];
      });
    });

    socket.on("mt5live", (live: { ticket?: number; profit?: number }) => {
      setTrades((prev) =>
        prev.map((t) => (Number(t.ticket) === Number(live.ticket) ? { ...t, profit: live.profit } : t)),
      );
      const ticket = String(live.ticket ?? "");
      const raw = Number(live.profit);
      if (ticket && Number.isFinite(raw)) {
        setLiveProfitByTicket((prev) => ({ ...prev, [ticket]: raw }));
      }
    });

    return () => {
      socket.off("mt5data");
      socket.off("mt5close");
      socket.off("mt5live");
    };
  }, []);

  const liveOpenCount = useMemo(
    () => trades.filter((t) => normStatus(t) === "OPEN").length,
    [trades],
  );

  const liveCopyGroups = useMemo(() => {
    const byTicket = new Map<string, AdminOpenAssignRow[]>();
    for (const row of assignments) {
      const t = String(row.ticket_id ?? "");
      if (!t) continue;
      if (!byTicket.has(t)) byTicket.set(t, []);
      byTicket.get(t)!.push(row);
    }
    const groups = [];
    for (const [ticket, rows] of byTicket) {
      const sample = rows[0];
      if (isMasterTradeClosed(sample)) continue;
      const liveMaster = liveProfitByTicket[ticket];
      const masterPl =
        liveMaster != null && Number.isFinite(liveMaster)
          ? liveMaster
          : Number(sample.mt5_total_profit ?? 0);
      let userShareSum = 0;
      let adminPlSum = 0;
      let userExposureSum = 0;
      let stoppedUserCount = 0;
      for (const r of rows) {
        if (isUserStoppedTrade(r)) stoppedUserCount += 1;
        const split = resolveRowAdminUserPl(r, String(ticket), liveProfitByTicket);
        adminPlSum += split.adminShare;
        userShareSum += split.userShare;
        userExposureSum += Number(r.reserved_exposure_usd ?? 0);
      }
      groups.push({
        ticket,
        symbol: String(sample.symbol ?? "—"),
        status: String(sample.mt5_status ?? "OPEN"),
        masterPl,
        openTime: sample.open_time != null ? String(sample.open_time) : null,
        type: sample.mt5_type != null ? String(sample.mt5_type) : undefined,
        volume: Number(sample.mt5_volume ?? 0),
        price: sample.price != null ? Number(sample.price) : undefined,
        assigns: rows,
        adminPlSum: Math.round(adminPlSum * 100) / 100,
        userShareSum: Math.round(userShareSum * 100) / 100,
        copyPl: Math.round((userShareSum + adminPlSum) * 100) / 100,
        totalSharePct: ticketSharePct(rows),
        tradeExposureUsd:
          sample.trade_exposure_usd != null ? Number(sample.trade_exposure_usd) : null,
        userExposureSum: Math.round(userExposureSum * 100) / 100,
        stoppedUserCount,
      });
    }
    groups.sort((a, b) => {
      const ta = Date.parse(String(a.openTime ?? "").replace(" ", "T"));
      const tb = Date.parse(String(b.openTime ?? "").replace(" ", "T"));
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
    });
    return groups;
  }, [assignments, liveProfitByTicket]);

  const livePlTotals = useMemo(() => {
    let copyPl = 0;
    let lots = 0;
    for (const g of liveCopyGroups) {
      copyPl += Number(g.copyPl) || 0;
      lots += Number(g.volume) || 0;
    }
    return {
      copyPl: Math.round(copyPl * 100) / 100,
      lots: Math.round(lots * 100) / 100,
      count: liveCopyGroups.length,
    };
  }, [liveCopyGroups]);

  const dialogRows = useMemo(
    () => (dialogTicket ? assignments.filter((r) => String(r.ticket_id ?? "") === dialogTicket) : []),
    [assignments, dialogTicket],
  );

  const mt5Gross = useMemo(() => {
    let profit = 0;
    let loss = 0;
    for (const t of trades) {
      const st = normStatus(t);
      if (!st.includes("CLOSE")) continue;
      const p = Number(t.profit);
      if (!Number.isFinite(p)) continue;
      if (p > 0) profit += p;
      if (p < 0) loss += Math.abs(p);
    }
    return { profit, loss };
  }, [trades]);

  const userSegments = useMemo(() => buildSegmentsFromUsers(users), [users]);

  const totalUsers = stats?.facts.trader_users ?? stats?.facts.wallet_users ?? users.length;
  const fundedUsers = stats?.facts.funded_users ?? 0;
  const livePl = Number(stats?.live.copy_live_user_pl_usd ?? 0);
  const liveEquity =
    stats?.live.user_equity_usd ??
    Number(stats?.owe_users_breakdown?.wallets_usd ?? 0) + livePl;
  const liveTradeCount = stats?.live.mt5_open_tickets ?? liveOpenCount;
  const settledProfit = Number(stats?.facts.settled_gross_profit_usd ?? 0);
  const settledLoss = Number(stats?.facts.settled_gross_loss_usd ?? 0);
  const grossProfit = mt5Gross.profit > 0.005 ? mt5Gross.profit : settledProfit;
  const grossLoss = mt5Gross.loss > 0.005 ? mt5Gross.loss : settledLoss;

  const riskRows =
    stats?.charts?.users_by_risk?.some((r) => r.users > 0) ? stats.charts.users_by_risk : userSegments.by_risk;
  const tradingRows =
    stats?.charts?.users_by_trading?.some((r) => r.users > 0)
      ? stats.charts.users_by_trading
      : userSegments.by_trading;

  return (
    <div className="mx-auto max-w-none p-0 sm:p-3">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-800 sm:text-2xl">Admin dashboard</h1>
          {/* <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
            Platform deposits, live copy P/L, and users by risk / KYC / trading status
          </p> */}
        </div>
        <button
          type="button"
          onClick={() => {
            fetchTrades();
            fetchFinancials();
            fetchUsers();
            void fetchAssignments();
          }}
          className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[#FFD700] px-5 py-2.5 font-bold text-black transition hover:bg-[#E6C200] disabled:opacity-60 sm:w-auto"
          disabled={loading}
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-1.5 lg:grid-cols-4">
      <KpiCard
          icon={<TrendingUp className="h-3.5 w-3.5 text-emerald-600" />}
          label="Gross profit"
          value={`$${fmtMoney(grossProfit)}`}
          sub="Closed MT5 winning trades"
          valueClass="text-emerald-600"
        />
        <KpiCard
          icon={<TrendingDown className="h-3.5 w-3.5 text-red-600" />}
          label="Gross loss"
          value={`-$${fmtMoney(grossLoss)}`}
          sub="Closed MT5 losing trades"
          valueClass="text-red-600"
        />
        <KpiCard
          icon={<Wallet className="h-3.5 w-3.5 text-emerald-600" />}
          label="Total deposit"
          value={`$${fmtMoney(stats?.facts.total_recharged_usd ?? 0)}`}
          sub="Successful recharges"
        />
        <KpiCard
          icon={<ArrowDownToLine className="h-3.5 w-3.5 text-orange-600" />}
          label="Total withdrawals"
          value={`$${fmtMoney(stats?.facts.total_withdrawn_usd ?? 0)}`}
          sub="Completed withdrawals"
        />
        <KpiCard
          icon={<Wallet className="h-3.5 w-3.5 text-slate-700" />}
          label="Trading wallet"
          value={`$${fmtMoney(walletTotals.trading)}`}
          sub="All users trading balance"
        />
        <KpiCard
          icon={<Shield className="h-3.5 w-3.5 text-teal-600" />}
          label="Safe wallet"
          value={`$${fmtMoney(walletTotals.safe)}`}
          sub="All users safe balance"
        />
        <KpiCard
          icon={<Users className="h-3.5 w-3.5 text-indigo-600" />}
          label="Total / active (funded)"
          value={`${fmtInt(totalUsers)} / ${fmtInt(fundedUsers)}`}
          sub="All traders / wallet > $0.02"
        />
        {/* <KpiCard
          icon={<Activity className="h-3.5 w-3.5 text-blue-600" />}
          label="Live P/L (total)"
          value={`${livePl >= 0 ? "" : "-"}$${fmtMoney(Math.abs(livePl))}`}
          sub="User copy P/L on open trades"
          valueClass={plTextClass(livePl)}
        /> */}
        <KpiCard
          icon={<Landmark className="h-3.5 w-3.5 text-violet-600" />}
          label="Total equity of users (live)"
          value={`$${fmtMoney(liveEquity)}`}
          sub="Trading wallets + live P/L"
        />
        {/* <KpiCard
          icon={<Radio className="h-3.5 w-3.5 text-sky-600" />}
          label="Live trades"
          value={fmtInt(liveTradeCount)}
          sub="Open master tickets"
        /> */}
        
      </div>

      <div className="mb-4 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div
            className={`flex h-[42px] flex-col items-center justify-center px-2.5 ${
              livePlTotals.copyPl < 0 ? "bg-red-600" : "bg-emerald-600"
            }`}
          >
            <div className="text-[10px] font-semibold uppercase tracking-wide text-white/80">Total P/L</div>
            <div className="text-base font-extrabold tabular-nums leading-none text-white">
              {livePlTotals.copyPl >= 0 ? "+" : ""}
              {fmtUsd(livePlTotals.copyPl)}
            </div>
          </div>

          <div className="max-h-[168px] min-h-[168px] divide-y divide-slate-100 overflow-y-auto">
            {assignLoading && assignments.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                <RefreshCw className="mx-auto mb-1 h-4 w-4 animate-spin text-yellow-800" />
                Loading copy assignments…
              </div>
            ) : liveCopyGroups.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">No active copy trades</div>
            ) : (
              liveCopyGroups.map((g) => {
                const priceRow: UserTradeRowLike = {
                  ticket_id: g.ticket,
                  symbol: g.symbol,
                  price: g.price,
                  mt5_type: g.type,
                  mt5_volume: g.volume,
                  mt5_total_profit: g.masterPl,
                  mt5_status: g.status,
                };
                const { buyPrice, sellPrice, buyIsLive, sellIsLive } = resolveMt5BuySellPrices(priceRow);
                const side = formatMt5SideLabel(g.type);
                const isSell = side === "Sell";
                const isBuy = !isSell;
                const entry = isBuy ? buyPrice : sellPrice;
                const exit = isBuy ? sellPrice : buyPrice;
                const exitLive = isBuy ? sellIsLive : buyIsLive;
                const stamp = fmtMt5DateTime(g.openTime);
                const sideCls = isSell ? "text-red-600" : "text-emerald-600";

                return (
                  <button
                    type="button"
                    key={g.ticket}
                    onClick={() => setDialogTicket(g.ticket)}
                    className="flex w-full items-start justify-between gap-2 px-2.5 py-1.5 text-left hover:bg-yellow-50/40"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 text-xs font-bold text-slate-900">
                        <span className="truncate">{g.symbol}</span>
                        {side !== "—" && (
                          <span className={`font-semibold ${sideCls}`}>
                            , {side.toLowerCase()} {fmtLots(g.volume)}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] tabular-nums text-slate-500">
                        {entry != null ? fmtMt5Price(entry, g.symbol) : "—"}
                        <span className="mx-1 text-slate-400">→</span>
                        {exitLive && exit != null ? "~" : ""}
                        {exit != null ? fmtMt5Price(exit, g.symbol) : "—"}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[10px] tabular-nums text-slate-400">{stamp}</div>
                      <div className={`mt-0.5 text-sm font-extrabold tabular-nums ${plTextClass(g.copyPl)}`}>
                        {g.copyPl >= 0 ? "+" : ""}
                        {fmtUsd(g.copyPl)}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-2">
          <h2 className="text-[11px] font-bold text-slate-800">Users by risk</h2>
          <ResponsiveContainer width="100%" height={168}>
            <BarChart data={riskRows} barGap={2} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={0} />
              <YAxis tick={{ fontSize: 9 }} allowDecimals={false} width={28} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="users" name="Users" fill="#0f172a" radius={[3, 3, 0, 0]} />
              <Bar dataKey="funded" name="Funded" fill="#FFD700" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-2">
          <h2 className="text-[11px] font-bold text-slate-800">Wallet by risk</h2>
          <ResponsiveContainer width="100%" height={168}>
            <BarChart data={riskRows} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={0} />
              <YAxis tick={{ fontSize: 9 }} width={36} />
              <Tooltip formatter={(value: number) => `$${fmtMoney(value)}`} />
              <Bar dataKey="wallet_usd" name="Wallet" radius={[3, 3, 0, 0]}>
                {riskRows.map((row) => (
                  <Cell key={row.id} fill={RISK_BAR_COLORS[row.id] ?? "#6366f1"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-2">
          <h2 className="text-[11px] font-bold text-slate-800">Trading status</h2>
          <ResponsiveContainer width="100%" height={168}>
            <BarChart data={tradingRows} layout="vertical" margin={{ top: 8, left: 4, right: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 9 }} />
              <YAxis type="category" dataKey="label" width={78} tick={{ fontSize: 9 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="users" name="Users" fill="#0f172a" radius={[0, 3, 3, 0]} />
              <Bar dataKey="funded" name="Funded" fill="#FFD700" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <TicketAssignDialog
        open={Boolean(dialogTicket)}
        onOpenChange={(open) => {
          if (!open) setDialogTicket(null);
        }}
        ticketId={dialogTicket}
        symbol={liveCopyGroups.find((g) => g.ticket === dialogTicket)?.symbol}
        rows={dialogRows}
        liveProfitByTicket={liveProfitByTicket}
      />
    </div>
  );
};

export default Dashboard;
