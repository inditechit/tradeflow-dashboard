import React, { useEffect, useMemo, useState } from "react";
import { CalendarRange, RefreshCw } from "lucide-react";
import {
  formatIsoDateTime,
  tradeInDateRange,
} from "@/utils/mt5TradeDates";

const API_BASE = "https://mt5api.inditechit.com/api";

type Trade = {
  ticket?: number | string;
  account?: string;
  symbol?: string;
  type?: string;
  volume?: number | string;
  price?: number | string;
  profit?: number;
  status?: string;
  open_time?: string | null;
  close_time?: string | null;
};

function isBuyType(type?: string) {
  return type === "DEAL_TYPE_BUY" || type === "ORDER_TYPE_BUY";
}

const OpenTrades = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const [symbolFilter, setSymbolFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "buy" | "sell">("all");
  const [volumeFilter, setVolumeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [profitFilter, setProfitFilter] = useState<"all" | "profit" | "loss">(
    "all"
  );
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchTrades = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/mt5-trades`);
      const data = await res.json();

      if (data.success) {
        setTrades(data.trades);
        setCount(data.count);
      }
    } catch (error) {
      console.error("Error fetching trades:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrades();
  }, []);

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    trades.forEach((t) => {
      if (t.status) set.add(String(t.status));
    });
    return Array.from(set).sort();
  }, [trades]);

  const filteredTrades = useMemo(() => {
    const sym = symbolFilter.trim().toLowerCase();
    const volNum = volumeFilter.trim() === "" ? null : Number(volumeFilter);

    return trades.filter((trade) => {
      if (!tradeInDateRange(trade, dateFrom, dateTo)) {
        return false;
      }
      if (sym && !String(trade.symbol ?? "").toLowerCase().includes(sym)) {
        return false;
      }
      if (typeFilter === "buy" && !isBuyType(trade.type)) {
        return false;
      }
      if (typeFilter === "sell" && isBuyType(trade.type)) {
        return false;
      }
      if (volNum !== null && !Number.isNaN(volNum)) {
        if (Number(trade.volume) !== volNum) return false;
      }
      if (statusFilter !== "all" && trade.status !== statusFilter) {
        return false;
      }
      const p = Number(trade.profit);
      if (profitFilter === "profit" && !(p >= 0)) return false;
      if (profitFilter === "loss" && !(p < 0)) return false;
      return true;
    });
  }, [
    trades,
    symbolFilter,
    typeFilter,
    volumeFilter,
    statusFilter,
    profitFilter,
    dateFrom,
    dateTo,
  ]);

  const filtersActive =
    symbolFilter.trim() !== "" ||
    typeFilter !== "all" ||
    volumeFilter.trim() !== "" ||
    statusFilter !== "all" ||
    profitFilter !== "all" ||
    Boolean(dateFrom || dateTo);

  const clearFilters = () => {
    setSymbolFilter("");
    setTypeFilter("all");
    setVolumeFilter("");
    setStatusFilter("all");
    setProfitFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  const inputCls =
    "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20";

  return (
    <div className="max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Open Trades</h1>
          <p className="text-slate-500 text-sm">
            Total Active Trades: {count}
            {filtersActive && (
              <span className="text-slate-600">
                {" "}
                · Showing {filteredTrades.length} filtered
              </span>
            )}
          </p>
        </div>

        <button
          onClick={fetchTrades}
          disabled={loading}
          className="px-5 py-2.5 rounded-xl bg-cyan-600 text-white font-bold hover:bg-cyan-700 transition flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw
            size={18}
            className={loading ? "animate-spin" : ""}
          />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* FILTERS */}
      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex min-w-[140px] flex-1 flex-col gap-1">
          <label className="text-xs font-semibold uppercase text-slate-500">
            Symbol
          </label>
          <input
            type="text"
            placeholder="e.g. XAUUSD"
            value={symbolFilter}
            onChange={(e) => setSymbolFilter(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="flex min-w-[120px] flex-col gap-1">
          <label className="text-xs font-semibold uppercase text-slate-500">
            Type
          </label>
          <select
            value={typeFilter}
            onChange={(e) =>
              setTypeFilter(e.target.value as "all" | "buy" | "sell")
            }
            className={inputCls}
          >
            <option value="all">All</option>
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
          </select>
        </div>
        <div className="flex w-[110px] flex-col gap-1">
          <label className="text-xs font-semibold uppercase text-slate-500">
            Volume
          </label>
          <input
            type="number"
            step="any"
            min="0"
            placeholder="Lots"
            value={volumeFilter}
            onChange={(e) => setVolumeFilter(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="flex min-w-[130px] flex-col gap-1">
          <label className="text-xs font-semibold uppercase text-slate-500">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={inputCls}
          >
            <option value="all">All</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-[140px] flex-col gap-1">
          <label className="text-xs font-semibold uppercase text-slate-500 flex items-center gap-1">
            <CalendarRange className="h-3.5 w-3.5" />
            Open from
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="flex min-w-[140px] flex-col gap-1">
          <label className="text-xs font-semibold uppercase text-slate-500 flex items-center gap-1">
            <CalendarRange className="h-3.5 w-3.5" />
            Through
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="flex min-w-[140px] flex-col gap-1">
          <label className="text-xs font-semibold uppercase text-slate-500">
            Profit
          </label>
          <select
            value={profitFilter}
            onChange={(e) =>
              setProfitFilter(e.target.value as "all" | "profit" | "loss")
            }
            className={inputCls}
          >
            <option value="all">All</option>
            <option value="profit">In profit (≥ 0)</option>
            <option value="loss">In loss (&lt; 0)</option>
          </select>
        </div>
        {filtersActive && (
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Clear
          </button>
        )}
      </div>

      {/* TABLE CARD */}
      <div className="bg-white rounded-2xl shadow-xl shadow-cyan-900/5 border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            {/* HEADER */}
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">
                  Ticket
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">
                  Account
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">
                  Symbol
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">
                  Type
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">
                  Volume
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">
                  Price
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">
                  Profit
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase whitespace-nowrap">
                  Open time
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase whitespace-nowrap">
                  Close time
                </th>
              </tr>
            </thead>

            {/* BODY */}
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-slate-500">
                    <RefreshCw className="animate-spin mx-auto mb-2 text-cyan-500" />
                    Loading trades...
                  </td>
                </tr>
              ) : filteredTrades.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-slate-500">
                    {trades.length === 0
                      ? "No open trades"
                      : "No trades match your filters"}
                  </td>
                </tr>
              ) : (
                filteredTrades.map((trade, index) => {
                  const isProfit = Number(trade.profit) >= 0;

                  return (
                    <tr
                      key={`${trade.ticket}-${index}`}
                      className="hover:bg-cyan-50/30 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-slate-800">
                        {trade.ticket}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600">
                        {trade.account}
                      </td>

                      <td className="px-6 py-4 text-sm font-semibold text-cyan-600">
                        {trade.symbol}
                      </td>

                      {/* TYPE */}
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 rounded text-xs font-bold ${isBuyType(trade?.type)
                              ? "bg-green-50 text-green-600"
                              : "bg-red-50 text-red-600"
                            }`}
                        >
                          {isBuyType(trade?.type) ? "BUY" : "SELL"}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600">
                        {trade.volume}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600">
                        {Number(trade.price).toFixed(2)}
                      </td>

                      {/* PROFIT */}
                      <td
                        className={`px-6 py-4 text-sm font-bold ${isProfit ? "text-green-600" : "text-red-600"
                          }`}
                      >
                        {trade.profit}
                      </td>

                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold
      ${trade.status === "OPEN"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                            }`}
                        >
                          {trade.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600 whitespace-nowrap">
                        {formatIsoDateTime(trade.open_time)}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600 whitespace-nowrap">
                        {formatIsoDateTime(trade.close_time)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OpenTrades;
