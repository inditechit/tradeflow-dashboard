import React, { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import {
  RefreshCw,
  CalendarRange,
  Wallet,
  TrendingDown,
  Landmark,
} from "lucide-react";
import { tradeInDateRange } from "@/utils/mt5TradeDates";
import { plBadgeClass, plDotClass, plTextClass } from "@/utils/plColors";
import { API_BASE, SOCKET_URL } from "@/config/api";

const socket = io(SOCKET_URL, {
  transports: ["websocket"],
});









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

const normStatus = (t) => String(t?.status ?? "").toUpperCase();

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
  const [searchTerm, setSearchTerm] = useState("");
  const [accountMetrics, setAccountMetrics] = useState(null);
  const [platformTotals, setPlatformTotals] = useState(null);
  const [financials, setFinancials] = useState(null);
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

  const fetchFinancials = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/financial-stats`);
      const data = await res.json();
      if (data.success && data.stats) {
        const s = data.stats;
        setFinancials({
          totalDeposited: Number(s.facts?.total_recharged_usd ?? 0),
          totalWithdrawn: Number(s.facts?.total_withdrawn_usd ?? 0),
          currentWallet: Number(
            s.owe_users_breakdown?.wallets_usd ?? platformTotals?.sumWallets ?? 0,
          ),
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
    fetchFinancials();

    socket.on("mt5data", (trade) => {
      setTrades((prev) => {
        const index = prev.findIndex(
          (t) => Number(t.ticket) === Number(trade.ticket)
        );
        if (index !== -1) {
          const updatedTrades = [...prev];
          updatedTrades[index] = { ...updatedTrades[index], ...trade };
          return updatedTrades;
        }
        return [trade, ...prev];
      });
    });

    // Keep closed rows in the feed (final P/L) — removing them broke totals vs MT4/history.
    socket.on("mt5close", (trade) => {
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

    socket.on("mt5live", (live) => {
      setTrades((prev) =>
        prev.map((t) =>
          Number(t.ticket) === Number(live.ticket)
            ? { ...t, profit: live.profit }
            : t
        )
      );
    });

    socket.on("mt5metrics", (payload) => {
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
      socket.off("mt5data");
      socket.off("mt5close");
      socket.off("mt5live");
      socket.off("mt5metrics");
    };
  }, []);

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
    let closedCount = 0;
    let winCount = 0;
    let openCount = 0;

    for (const t of tradesInRange) {
      const st = normStatus(t);
      const p = profitNum(t);
      const vol = Number(t.volume);
      const px = Number(t.price);

      if (st === "OPEN") {
        openCount += 1;
        if (Number.isFinite(vol) && Number.isFinite(px)) {
          openNotional += vol * px;
        }
        if (p !== null) floatingPl += p;
        continue;
      }

      if (st === "CLOSED" && p !== null) {
        closedCount += 1;
        realizedNet += p;
        if (p > 0) {
          realizedProfit += p;
          winCount += 1;
        }
        if (p < 0) realizedLoss += Math.abs(p);
      }
    }

    const combinedNet = realizedNet + floatingPl;
    const winRate = closedCount > 0 ? (winCount / closedCount) * 100 : null;
    const profitFactor = realizedLoss > 0 ? realizedProfit / realizedLoss : null;

    return {
      openNotional,
      floatingPl,
      realizedProfit,
      realizedLoss,
      realizedNet,
      combinedNet,
      closedCount,
      openCount,
      winCount,
      winRate,
      profitFactor,
    };
  }, [tradesInRange]);

  const filteredTrades = tradesInRange.filter(
    (t) =>
      String(t.status ?? "").toUpperCase() === "OPEN" &&
      t.symbol?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const dateFilterActive = Boolean(dateFrom || dateTo);

  const moneyCard = (icon, tileClass, label, value) => (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-neutral-900/8">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tileClass}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-bold uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <p className="text-xl font-extrabold tabular-nums text-slate-900">{value}</p>
      </div>
    </div>
  );

  // Compact performance metric used in the stats strip.
  const metricCell = (label, value, valueClass) => (
    <div className="px-5 py-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-extrabold tabular-nums ${valueClass || "text-slate-900"}`}>
        {value}
      </p>
    </div>
  );

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

      {/* Money row */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        {moneyCard(
          <Wallet className="h-5 w-5 text-emerald-600" />,
          "bg-emerald-50",
          "Total deposited",
          `$${fmtMoney(financials?.totalDeposited ?? 0)}`,
        )}
        {moneyCard(
          <TrendingDown className="h-5 w-5 text-amber-600" />,
          "bg-amber-50",
          "Total withdrawls",
          `$${fmtMoney(financials?.totalWithdrawn ?? 0)}`,
        )}
        {moneyCard(
          <Landmark className="h-5 w-5 text-indigo-600" />,
          "bg-indigo-50",
          "Current wallet",
          `$${fmtMoney(financials?.currentWallet ?? platformTotals?.sumWallets ?? 0)}`,
        )}
      </div>

      {/* Performance strip — all 6 metrics in one line */}
      <div className="mb-8 grid grid-cols-6 divide-x divide-slate-100 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm shadow-neutral-900/8">
        {metricCell("Gross profit", `$${fmtMoney(stats.realizedProfit)}`, "text-emerald-600")}
        {metricCell("Gross loss", `-$${fmtMoney(stats.realizedLoss)}`, "text-red-600")}
        {metricCell("Net profit", `$${fmtMoney(stats.realizedNet)}`, realizedColor)}
        {metricCell(
          "Profit factor",
          stats.profitFactor == null ? "—" : stats.profitFactor.toFixed(2),
        )}
        {metricCell("Win rate", stats.winRate == null ? "—" : fmtPct(stats.winRate))}
        {metricCell("Total trades", stats.closedCount + stats.openCount)}
      </div>

      <div className="bg-white rounded-2xl shadow-xl shadow-neutral-900/8 border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <input
            type="text"
            placeholder="Search Symbol..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-yellow-500"
          />
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
                        className={`animate-pulse w-2 h-2 rounded-full ${plDotClass(isProfit)}`}
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
