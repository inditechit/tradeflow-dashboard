import React, { useEffect, useMemo, useState } from "react";
import {
  RefreshCw,
  CalendarRange,
  Wallet,
  TrendingUp,
  TrendingDown,
  PieChart,
  Landmark,
  Scale,
  Gauge,
  Percent,
} from "lucide-react";
import { tradeInDateRange } from "@/utils/mt5TradeDates";
import { plBadgeClass, plDotClass, plTextClass } from "@/utils/plColors";
import { API_BASE } from "@/config/api";
import { getLiveSocket } from "@/lib/liveSocket";
import { useLiveFeedStatus } from "@/hooks/useLiveFeedStatus";

function isMt5TradeOpen(t) {
  const st = String(t?.status ?? "").toUpperCase();
  if (st.includes("CLOSE")) return false;
  const ct = t?.close_time;
  if (
    ct != null &&
    String(ct).trim() !== "" &&
    String(ct) !== "0000-00-00 00:00:00"
  ) {
    return false;
  }
  return true;
}

const fmtMoney = (n) => {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n));
};

const fmtPct = (n) => {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${Number(n).toFixed(2)}%`;
};

const profitNum = (t) => {
  if (t?.profit === undefined || t?.profit === null || t?.profit === "") {
    return null;
  }
  const p = Number(t.profit);
  return Number.isFinite(p) ? p : null;
};

const Dashboard = () => {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [socketLive, setSocketLive] = useState(false);
  const [lastClientTickAt, setLastClientTickAt] = useState(null);
  const { status: feedStatus } = useLiveFeedStatus(8000);
  const [searchTerm, setSearchTerm] = useState("");
  const [accountMetrics, setAccountMetrics] = useState(null);
  const [platformTotals, setPlatformTotals] = useState(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchPlatformTotals = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/users`);
      const data = await res.json();
      if (data.success && data.totals) {
        setPlatformTotals({
          sumWallets: Number(data.totals.sum_wallet_balances_usd ?? 0),
          liveUsers: Number(data.totals.live_users ?? 0),
          totalUsers: Number(data.totals.total_users ?? 0),
        });
      }
    } catch {
      /* ignore */
    }
  };

  const fetchAccountMetrics = async () => {
    const paths = ["/admin/mt5-metrics", "/mt5-metrics"];
    for (const path of paths) {
      try {
        const res = await fetch(`${API_BASE}${path}`);
        if (!res.ok) continue;
        const data = await res.json();
        const m = data.metrics || data;
        if (data.success && (m?.equity != null || m?.margin != null)) {
          setAccountMetrics({
            equity: m.equity ?? m.Equity,
            margin: m.margin ?? m.Margin,
            free_margin: m.free_margin ?? m.freeMargin ?? m.FreeMargin,
            margin_level: m.margin_level ?? m.marginLevel ?? m.MarginLevel,
          });
          return;
        }
      } catch {
        /* ignore */
      }
    }
    setAccountMetrics(null);
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

  useEffect(() => {
    fetchTrades();
    fetchAccountMetrics();
    fetchPlatformTotals();

    const pollMs = feedStatus.mt5FeedLive ? 15000 : 5000;
    const poll = setInterval(() => {
      fetchTrades();
      fetchAccountMetrics();
    }, pollMs);

    const socket = getLiveSocket();
    setSocketLive(socket.connected);
    const onConnect = () => setSocketLive(true);
    const onDisconnect = () => setSocketLive(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    const upsertTrade = (trade) => {
      if (!trade?.ticket) return;
      if (!isMt5TradeOpen(trade)) {
        setTrades((prev) =>
          prev.filter((t) => Number(t.ticket) !== Number(trade.ticket)),
        );
        return;
      }
      setTrades((prev) => {
        const index = prev.findIndex(
          (t) => Number(t.ticket) === Number(trade.ticket),
        );
        if (index !== -1) {
          const updatedTrades = [...prev];
          updatedTrades[index] = { ...updatedTrades[index], ...trade };
          return updatedTrades;
        }
        return [trade, ...prev];
      });
    };

    socket.on("live:trade", upsertTrade);

    socket.on("live:tick", (live) => {
      setLastClientTickAt(Date.now());
      setTrades((prev) => {
        const idx = prev.findIndex(
          (t) => Number(t.ticket) === Number(live.ticket),
        );
        if (idx === -1) return prev;
        return prev.map((t) =>
          Number(t.ticket) === Number(live.ticket)
            ? { ...t, profit: live.profit }
            : t,
        );
      });
    });

    socket.on("live:metrics", (payload) => {
      const m = payload?.metrics || payload;
      if (m && (m.equity != null || m.margin != null)) {
        setAccountMetrics({
          equity: m.equity,
          margin: m.margin,
          free_margin: m.free_margin ?? m.freeMargin,
          margin_level: m.margin_level ?? m.marginLevel,
        });
      }
    });

    return () => {
      clearInterval(poll);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("live:trade", upsertTrade);
      socket.off("live:tick");
      socket.off("live:metrics");
    };
  }, [feedStatus.mt5FeedLive]);

  const tradesInRange = useMemo(
    () => trades.filter((t) => tradeInDateRange(t, dateFrom, dateTo)),
    [trades, dateFrom, dateTo]
  );

  const stats = useMemo(() => {
    let realizedProfit = 0;
    let realizedLoss = 0;
    let realizedNet = 0;
    let floatingPl = 0;
    let openNotional = 0;

    for (const t of tradesInRange) {
      const p = profitNum(t);
      const vol = Number(t.volume);
      const px = Number(t.price);

      if (isMt5TradeOpen(t)) {
        if (Number.isFinite(vol) && Number.isFinite(px)) {
          openNotional += vol * px;
        }
        if (p !== null) floatingPl += p;
        continue;
      }

      if (!isMt5TradeOpen(t) && p !== null) {
        realizedNet += p;
        if (p > 0) realizedProfit += p;
        if (p < 0) realizedLoss += Math.abs(p);
      }
    }

    const combinedNet = realizedNet + floatingPl;

    return {
      openNotional,
      floatingPl,
      realizedProfit,
      realizedLoss,
      realizedNet,
      combinedNet,
    };
  }, [tradesInRange]);

  const filteredTrades = tradesInRange.filter(
    (t) =>
      isMt5TradeOpen(t) &&
      t.symbol?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const dateFilterActive = Boolean(dateFrom || dateTo);

  const equity = accountMetrics?.equity;
  const margin = accountMetrics?.margin;
  const freeMargin = accountMetrics?.free_margin;
  const marginLevel = accountMetrics?.margin_level;

  const statCard = (icon, label, value, sub) => (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-neutral-900/8">
      <div className="mb-3 flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-extrabold tabular-nums text-slate-900">
        {value}
      </div>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );

  const plColor = plTextClass(stats.floatingPl);
  const combinedColor = plTextClass(stats.combinedNet);
  const realizedColor = plTextClass(stats.realizedNet);

  return (
    <div className="max-w-7xl mx-auto p-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Master MT5 Dashboard</h1>
          <p className="text-slate-500 text-sm">
            Broker master account trades only — not user wallet balances
            {dateFilterActive && (
              <span className="text-slate-700">
                {" "}
                · Date range: {dateFrom || "…"} → {dateTo || "…"}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => {
            fetchTrades();
            fetchAccountMetrics();
          }}
          className="px-5 py-2.5 rounded-xl bg-[#FFD700] text-black font-bold hover:bg-[#E6C200] transition flex items-center gap-2 disabled:opacity-60"
          disabled={loading}
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-slate-600">
          <CalendarRange className="h-5 w-5 shrink-0 text-neutral-900" />
          <span className="text-sm font-semibold">Filter by date</span>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase text-slate-500">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-yellow-500/30"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase text-slate-500">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-yellow-500/30"
          />
        </div>
        {dateFilterActive && (
          <button
            type="button"
            onClick={() => {
              setDateFrom("");
              setDateTo("");
            }}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Clear dates
          </button>
        )}
      </div>

      <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <strong>Two different views:</strong> Rows below = <strong>master MT5</strong> (broker account). User
        app cards = each user&apos;s <strong>wallet + their % of trades</strong>. They are linked but not equal
        dollar amounts.
      </p>
      {platformTotals && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          {statCard(
            <Wallet className="h-4 w-4 text-emerald-700" />,
            "All user wallets (platform)",
            fmtMoney(platformTotals.sumWallets),
            `Sum of in-app balances · ${platformTotals.liveUsers} users online`
          )}
          {statCard(
            <PieChart className={`h-4 w-4 ${plColor}`} />,
            "Master floating P/L (open)",
            <span className={plColor}>{fmtMoney(stats.floatingPl)}</span>,
            "Full broker position profit — compare trend, not 1:1 with one user"
          )}
        </div>
      )}

      {/* Summary metrics — MT4-style split: realized (closed) vs floating (open) */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">

         {statCard(
          <TrendingUp className="h-4 w-4 text-emerald-600" />,
          "Realized profit",
          <span className="text-emerald-600">{fmtMoney(stats.realizedProfit)}</span>,
          "CLOSED trades with profit &gt; 0 only."
        )}
        {statCard(
          <TrendingDown className="h-4 w-4 text-red-500" />,
          "Realized loss",
          <span className="text-red-600">{fmtMoney(stats.realizedLoss)}</span>,
          "CLOSED trades with profit &lt; 0 (absolute sum)."
        )}

        {statCard(
          <Wallet className="h-4 w-4" />,
          "Open notional (Σ vol×price)",
          fmtMoney(stats.openNotional),
          "Only OPEN trades. Same as your “total invested” column per open row; not broker margin."
        )}
        {statCard(
          <PieChart className={`h-4 w-4 ${plColor}`} />,
          "Floating P/L (open)",
          <span className={plColor}>{fmtMoney(stats.floatingPl)}</span>,
          "Sum of profit on OPEN trades only (unrealized)."
        )}
       
        {statCard(
          <PieChart className={`h-4 w-4 ${realizedColor}`} />,
          "Closed P/L (master)",
          <span className={realizedColor}>{fmtMoney(stats.realizedNet)}</span>,
          "Sum of profit on CLOSED master tickets in date range."
        )}
        {statCard(
          <PieChart className={`h-4 w-4 ${combinedColor}`} />,
          "Combined P/L (feed)",
          <span className={combinedColor}>{fmtMoney(stats.combinedNet)}</span>,
          "Closed net + floating open. Matches Σ profit if every row is OPEN or CLOSED."
        )}
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCard(
          <Landmark className="h-4 w-4" />,
          "Equity",
          fmtMoney(equity),
          equity == null
            ? "From API / socket when your backend exposes it."
            : undefined
        )}
        {statCard(
          <Scale className="h-4 w-4" />,
          "Margin",
          fmtMoney(margin),
          margin == null ? "Requires /admin/mt5-metrics or mt5metrics event." : undefined
        )}
        {statCard(
          <Gauge className="h-4 w-4" />,
          "Free margin",
          fmtMoney(freeMargin),
          freeMargin == null ? "Requires account metrics API." : undefined
        )}
        {statCard(
          <Percent className="h-4 w-4" />,
          "Margin level",
          fmtPct(marginLevel),
          marginLevel == null ? "Requires account metrics API." : undefined
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-xl shadow-neutral-900/8 border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search Symbol..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 min-w-[200px] px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-yellow-500"
          />
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
              socketLive ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${socketLive ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`}
            />
            {socketLive ? "App socket connected" : "App socket offline"}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
              feedStatus.mt5FeedLive
                ? "bg-emerald-100 text-emerald-800"
                : feedStatus.mt5BridgeConnected
                  ? "bg-amber-100 text-amber-900"
                  : "bg-red-100 text-red-800"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                feedStatus.mt5FeedLive
                  ? "bg-emerald-500 animate-pulse"
                  : feedStatus.mt5BridgeConnected
                    ? "bg-amber-500"
                    : "bg-red-500"
              }`}
            />
            {feedStatus.mt5FeedLive
              ? `MT5 feed live · tick ${feedStatus.secondsSinceTick ?? 0}s ago`
              : feedStatus.mt5BridgeConnected
                ? "MT5 connected — no ticks yet"
                : feedStatus.mt5BridgeUrl
                  ? "MT5 feed offline (check MT5_SOCKET_URL)"
                  : "MT5_SOCKET_URL not set on API"}
          </span>
          {lastClientTickAt ? (
            <span className="text-[11px] text-slate-500">
              Last UI tick: {Math.round((Date.now() - lastClientTickAt) / 1000)}s ago
            </span>
          ) : null}
        </div>

        <div className="min-h-[300px]">
          {loading && trades.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              <RefreshCw className="animate-spin mx-auto mb-2 text-yellow-800" />
              Loading data...
            </div>
          ) : filteredTrades.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              No active trades found
            </div>
          ) : (
            filteredTrades.map((trade, i) => {
              const isProfit = parseFloat(trade.profit || 0) >= 0;
              return (
                <div
                  key={trade.ticket || i}
                  className="flex justify-between items-center px-6 py-4 border-b border-slate-100 hover:bg-yellow-50/50 transition"
                >
                  <div>
                    <div className="font-bold text-slate-800">{trade.symbol}</div>
                    <div className="text-xs text-slate-500">
                      Ticket: {trade.ticket}
                    </div>
                  </div>
                  <div className="text-sm text-slate-600">Vol: {trade.volume}</div>
                  <div className="text-right">
                    <div className="text-sm text-slate-600">{trade.price}</div>
                    <div
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold shadow-sm ${plBadgeClass(isProfit)}`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${socketLive ? "animate-pulse" : "opacity-40"} ${plDotClass(isProfit)}`}
                      />

                      {isProfit ? "+" : ""}
                      {trade.profit}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
