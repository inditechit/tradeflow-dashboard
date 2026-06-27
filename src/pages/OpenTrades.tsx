import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarRange, RefreshCw } from "lucide-react";
import { io } from "socket.io-client";
import { tradeInDateRange } from "@/utils/mt5TradeDates";
import { plTextClass } from "@/utils/plColors";
import { useClientPagination } from "@/hooks/useClientPagination";
import { ListPaginationBar } from "@/components/trades/TradesPaginationBar";
import { API_BASE, SOCKET_URL } from "@/config/api";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fmtMt5Price,
  formatMt5SideLabel,
  isTradeClosed,
  resolveEffectiveSlice,
  resolveMt5BuySellPrices,
  rowGrossPl,
  type UserTradeRowLike,
} from "@/utils/userTradePl";
import type { AdminOpenAssignRow } from "@/utils/adminLiveFinance";
import { TicketAssignDialog } from "@/components/admin/TicketAssignDialog";

const socket = io(SOCKET_URL, { transports: ["websocket"] });
const PAGE_SIZE = 50;

type Mt5Trade = {
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

type CopyScopeFilter = "all" | "open" | "closed";

type TicketGroup = {
  ticket: string;
  symbol: string;
  status: string;
  isOpen: boolean;
  masterPl: number;
  openTime: string | null;
  closeTime: string | null;
  type?: string;
  volume: number;
  price?: number;
  assigns: AdminOpenAssignRow[];
  userPlSum: number;
  userGrossSum: number;
  totalSharePct: number;
};

function rowCopyPlForGroup(
  r: AdminOpenAssignRow,
  ticket: string,
  live?: Record<string, number>,
): number {
  if (isTradeClosed(r)) {
    const fin = Number(r.final_profit_loss ?? NaN);
    if (Number.isFinite(fin)) return fin;
  }
  return rowGrossPl(r, live?.[ticket]);
}

function totalSharePct(rows: AdminOpenAssignRow[]): number {
  if (!rows.length) return 0;
  const V = Number(rows[0]?.mt5_volume ?? rows[0]?.total_trade_volume ?? 0);
  if (V > 0) {
    let allocSum = 0;
    for (const r of rows) {
      allocSum += Number(r.allocated_volume ?? 0);
    }
    return Math.round((allocSum / V) * 10000) / 100;
  }
  let sum = 0;
  for (const r of rows) {
    const { effectiveShare } = resolveEffectiveSlice(r);
    sum += effectiveShare;
  }
  return Math.round(sum * 10000) / 100;
}

function fmtUsd(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

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
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(
    d.getHours(),
  )}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

const OpenTrades = () => {
  const [tab, setTab] = useState<"master" | "open-pl">("open-pl");

  const [trades, setTrades] = useState<Mt5Trade[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const [assignments, setAssignments] = useState<AdminOpenAssignRow[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [liveProfitByTicket, setLiveProfitByTicket] = useState<Record<string, number>>({});
  const [socketLive, setSocketLive] = useState(false);

  const [dialogTicket, setDialogTicket] = useState<string | null>(null);

  const [symbolFilter, setSymbolFilter] = useState("");
  const [ticketFilter, setTicketFilter] = useState("");
  const [copyScopeFilter, setCopyScopeFilter] = useState<CopyScopeFilter>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "buy" | "sell">("all");
  const [volumeFilter, setVolumeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [profitFilter, setProfitFilter] = useState<"all" | "profit" | "loss">("all");
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

  const fetchAssignments = useCallback(async () => {
    try {
      setAssignLoading(true);
      const res = await fetch(`${API_BASE}/admin/open-assignments?all=1`);
      const data = await res.json();
      if (data.success && Array.isArray(data.assignments)) {
        setAssignments(data.assignments as AdminOpenAssignRow[]);
      }
    } catch (error) {
      console.error("Error fetching assignments:", error);
    } finally {
      setAssignLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTrades();
    void fetchAssignments();
  }, [fetchAssignments]);

  useEffect(() => {
    const applyLive = (payload: { ticket?: unknown; profit?: unknown }) => {
      const ticket = String(payload.ticket ?? "");
      const raw = Number(payload.profit);
      if (!ticket || !Number.isFinite(raw)) return;
      setLiveProfitByTicket((prev) => ({ ...prev, [ticket]: raw }));
      setAssignments((prev) =>
        prev.map((r) =>
          String(r.ticket_id ?? "") === ticket ? { ...r, mt5_total_profit: raw } : r,
        ),
      );
    };
    const onConnect = () => setSocketLive(true);
    const onDisconnect = () => setSocketLive(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("mt5live", applyLive);
    socket.on("mt5data", applyLive);
    setSocketLive(socket.connected);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("mt5live", applyLive);
      socket.off("mt5data", applyLive);
    };
  }, []);

  const assignsByTicket = useMemo(() => {
    const map = new Map<string, AdminOpenAssignRow[]>();
    for (const row of assignments) {
      const t = String(row.ticket_id ?? "");
      if (!t) continue;
      if (!map.has(t)) map.set(t, []);
      map.get(t)!.push(row);
    }
    return map;
  }, [assignments]);

  const copyPlGroups = useMemo((): TicketGroup[] => {
    const groups: TicketGroup[] = [];
    for (const [ticket, rows] of assignsByTicket) {
      const sample = rows[0];
      const closed = isTradeClosed(sample);
      const liveMaster = !closed ? liveProfitByTicket[ticket] : undefined;
      const masterPl =
        liveMaster != null && Number.isFinite(liveMaster)
          ? liveMaster
          : Number(sample.mt5_total_profit ?? 0);
      let userPlSum = 0;
      let userGrossSum = 0;
      for (const r of rows) {
        userGrossSum += rowGrossPl(r, closed ? undefined : liveProfitByTicket);
        userPlSum += rowCopyPlForGroup(r, ticket, closed ? undefined : liveProfitByTicket);
      }
      groups.push({
        ticket,
        symbol: String(sample.symbol ?? "—"),
        status: closed ? "CLOSED" : String(sample.mt5_status ?? "OPEN"),
        isOpen: !closed,
        masterPl,
        openTime: sample.open_time != null ? String(sample.open_time) : null,
        closeTime: sample.close_time != null ? String(sample.close_time) : null,
        type: sample.mt5_type != null ? String(sample.mt5_type) : undefined,
        volume: Number(sample.mt5_volume ?? 0),
        price: sample.price != null ? Number(sample.price) : undefined,
        assigns: rows,
        userPlSum: Math.round(userPlSum * 100) / 100,
        userGrossSum: Math.round(userGrossSum * 100) / 100,
        totalSharePct: totalSharePct(rows),
      });
    }
    groups.sort((a, b) => {
      const ta = Date.parse(String((a.isOpen ? a.openTime : a.closeTime) ?? "").replace(" ", "T"));
      const tb = Date.parse(String((b.isOpen ? b.openTime : b.closeTime) ?? "").replace(" ", "T"));
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
    });
    return groups;
  }, [assignsByTicket, liveProfitByTicket]);

  const filteredCopyPl = useMemo(() => {
    const sym = symbolFilter.trim().toLowerCase();
    const ticketQ = ticketFilter.trim();
    return copyPlGroups.filter((g) => {
      if (ticketQ && !g.ticket.includes(ticketQ)) return false;
      if (copyScopeFilter === "open" && !g.isOpen) return false;
      if (copyScopeFilter === "closed" && g.isOpen) return false;
      if (sym && !g.symbol.toLowerCase().includes(sym)) return false;
      if (typeFilter === "buy" && !isBuyType(g.type)) return false;
      if (typeFilter === "sell" && isBuyType(g.type)) return false;
      if (statusFilter !== "all" && g.status !== statusFilter) return false;
      if (profitFilter === "profit" && !(g.masterPl >= 0)) return false;
      if (profitFilter === "loss" && !(g.masterPl < 0)) return false;
      if (dateFrom || dateTo) {
        const fake = { open_time: g.openTime, close_time: g.closeTime, status: g.status };
        if (!tradeInDateRange(fake, dateFrom, dateTo)) return false;
      }
      return true;
    });
  }, [
    copyPlGroups,
    ticketFilter,
    copyScopeFilter,
    symbolFilter,
    typeFilter,
    statusFilter,
    profitFilter,
    dateFrom,
    dateTo,
  ]);

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    trades.forEach((t) => {
      if (t.status) set.add(String(t.status));
    });
    copyPlGroups.forEach((g) => {
      if (g.status) set.add(g.status);
    });
    return Array.from(set).sort();
  }, [trades, copyPlGroups]);

  const openCopyCount = useMemo(
    () => copyPlGroups.filter((g) => g.isOpen).length,
    [copyPlGroups],
  );
  const closedCopyCount = copyPlGroups.length - openCopyCount;

  const filteredTrades = useMemo(() => {
    const sym = symbolFilter.trim().toLowerCase();
    const ticketQ = ticketFilter.trim();
    const volNum = volumeFilter.trim() === "" ? null : Number(volumeFilter);

    return trades.filter((trade) => {
      if (ticketQ && !String(trade.ticket ?? "").includes(ticketQ)) return false;
      if (!tradeInDateRange(trade, dateFrom, dateTo)) return false;
      if (sym && !String(trade.symbol ?? "").toLowerCase().includes(sym)) return false;
      if (typeFilter === "buy" && !isBuyType(trade.type)) return false;
      if (typeFilter === "sell" && isBuyType(trade.type)) return false;
      if (volNum !== null && !Number.isNaN(volNum) && Number(trade.volume) !== volNum) return false;
      if (statusFilter !== "all" && trade.status !== statusFilter) return false;
      const p = Number(trade.profit);
      if (profitFilter === "profit" && !(p >= 0)) return false;
      if (profitFilter === "loss" && !(p < 0)) return false;
      return true;
    });
  }, [trades, symbolFilter, ticketFilter, typeFilter, volumeFilter, statusFilter, profitFilter, dateFrom, dateTo]);

  const listForPagination = tab === "open-pl" ? filteredCopyPl : filteredTrades;
  const { page, setPage, pageItems, totalPages, total: filteredTotal } = useClientPagination(
    listForPagination,
    PAGE_SIZE,
  );

  useEffect(() => {
    setPage(1);
  }, [symbolFilter, ticketFilter, copyScopeFilter, typeFilter, volumeFilter, statusFilter, profitFilter, dateFrom, dateTo, tab, setPage]);

  const filtersActive =
    symbolFilter.trim() !== "" ||
    ticketFilter.trim() !== "" ||
    copyScopeFilter !== "all" ||
    typeFilter !== "all" ||
    volumeFilter.trim() !== "" ||
    statusFilter !== "all" ||
    profitFilter !== "all" ||
    Boolean(dateFrom || dateTo);

  const clearFilters = () => {
    setSymbolFilter("");
    setTicketFilter("");
    setCopyScopeFilter("all");
    setTypeFilter("all");
    setVolumeFilter("");
    setStatusFilter("all");
    setProfitFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  const refreshAll = () => {
    void fetchTrades();
    void fetchAssignments();
  };

  const dialogRows = dialogTicket ? assignsByTicket.get(dialogTicket) ?? [] : [];
  const dialogSymbol = dialogRows[0]?.symbol != null ? String(dialogRows[0].symbol) : undefined;

  const inputCls =
    "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-yellow-500/30";

  const isLoading = tab === "open-pl" ? assignLoading : loading;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Open / Close Trades</h1>
          <p className="text-slate-500 text-sm">
            {tab === "open-pl"
              ? `${copyPlGroups.length} copy ticket${copyPlGroups.length === 1 ? "" : "s"} (${openCopyCount} open · ${closedCopyCount} closed) · ${assignments.length} user slices`
              : `Total MT5 rows: ${count}`}
            {filtersActive && (
              <span className="text-slate-600"> · Showing {filteredTotal} filtered</span>
            )}
            {tab === "open-pl" && socketLive && (
              <span className="ml-2 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                LIVE
              </span>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={refreshAll}
          disabled={isLoading}
          className="px-5 py-2.5 rounded-xl bg-[#FFD700] text-black font-bold hover:bg-[#E6C200] transition flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "master" | "open-pl")} className="mb-6">
        <TabsList className="grid h-11 w-full max-w-md grid-cols-2 rounded-xl bg-slate-100 p-1">
          <TabsTrigger value="open-pl" className="rounded-lg text-sm font-semibold">
            Copy P/L
          </TabsTrigger>
          <TabsTrigger value="master" className="rounded-lg text-sm font-semibold">
            Master MT5
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* FILTERS */}
      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex min-w-[120px] flex-col gap-1">
          <label className="text-xs font-semibold uppercase text-slate-500">Ticket</label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="e.g. 12345"
            value={ticketFilter}
            onChange={(e) => setTicketFilter(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="flex min-w-[140px] flex-1 flex-col gap-1">
          <label className="text-xs font-semibold uppercase text-slate-500">Symbol</label>
          <input
            type="text"
            placeholder="e.g. XAUUSD"
            value={symbolFilter}
            onChange={(e) => setSymbolFilter(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="flex min-w-[120px] flex-col gap-1">
          <label className="text-xs font-semibold uppercase text-slate-500">Type</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as "all" | "buy" | "sell")}
            className={inputCls}
          >
            <option value="all">All</option>
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
          </select>
        </div>
        {tab === "open-pl" && (
          <div className="flex min-w-[120px] flex-col gap-1">
            <label className="text-xs font-semibold uppercase text-slate-500">Scope</label>
            <select
              value={copyScopeFilter}
              onChange={(e) => setCopyScopeFilter(e.target.value as CopyScopeFilter)}
              className={inputCls}
            >
              <option value="all">All</option>
              <option value="open">Open only</option>
              <option value="closed">Closed only</option>
            </select>
          </div>
        )}
        {tab === "master" && (
          <div className="flex w-[110px] flex-col gap-1">
            <label className="text-xs font-semibold uppercase text-slate-500">Volume</label>
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
        )}
        <div className="flex min-w-[130px] flex-col gap-1">
          <label className="text-xs font-semibold uppercase text-slate-500">Status</label>
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
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputCls} />
        </div>
        <div className="flex min-w-[140px] flex-col gap-1">
          <label className="text-xs font-semibold uppercase text-slate-500 flex items-center gap-1">
            <CalendarRange className="h-3.5 w-3.5" />
            Through
          </label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputCls} />
        </div>
        <div className="flex min-w-[140px] flex-col gap-1">
          <label className="text-xs font-semibold uppercase text-slate-500">Profit</label>
          <select
            value={profitFilter}
            onChange={(e) => setProfitFilter(e.target.value as "all" | "profit" | "loss")}
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

      {tab === "open-pl" ? (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl shadow-neutral-900/8">
          <div className="min-h-[260px] divide-y divide-slate-100">
            {assignLoading ? (
              <div className="p-10 text-center text-slate-500">
                <RefreshCw className="mx-auto mb-2 animate-spin text-yellow-800" />
                Loading copy assignments…
              </div>
            ) : pageItems.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                {copyPlGroups.length === 0
                  ? "No copy assignments"
                  : "No tickets match your filters"}
              </div>
            ) : (
              (pageItems as TicketGroup[]).map((g) => {
                const priceRow: UserTradeRowLike = {
                  ticket_id: g.ticket,
                  symbol: g.symbol,
                  price: g.price,
                  mt5_type: g.type,
                  mt5_volume: g.volume,
                  mt5_total_profit: g.masterPl,
                  mt5_status: g.status,
                  close_time: g.closeTime,
                };
                const { buyPrice, sellPrice, buyIsLive, sellIsLive } =
                  resolveMt5BuySellPrices(priceRow);
                const side = formatMt5SideLabel(g.type);
                const isSell = side === "Sell";
                const isBuy = !isSell;
                const entry = isBuy ? buyPrice : sellPrice;
                const exit = isBuy ? sellPrice : buyPrice;
                const exitLive = isBuy ? sellIsLive : buyIsLive;
                const stamp = fmtMt5DateTime(g.isOpen ? g.openTime : g.closeTime);
                const sideCls = isSell ? "text-red-600" : "text-emerald-600";

                return (
                  <div
                    key={g.ticket}
                    onClick={() => setDialogTicket(g.ticket)}
                    className="flex cursor-pointer items-start justify-between gap-3 px-4 py-3 transition hover:bg-yellow-50/40"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 text-[15px] font-bold text-slate-900">
                        <span className="truncate">{g.symbol}</span>
                        {side !== "—" && (
                          <span className={`font-semibold ${sideCls}`}>
                            , {side.toLowerCase()} {fmtLots(g.volume)}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-sm tabular-nums text-slate-500">
                        {entry != null ? fmtMt5Price(entry, g.symbol) : "—"}
                        <span className="mx-1 text-slate-400">→</span>
                        {g.isOpen && exitLive && exit != null ? "~" : ""}
                        {exit != null ? fmtMt5Price(exit, g.symbol) : "—"}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
                        <span className="text-yellow-900">#{g.ticket}</span>
                        <span>· {g.assigns.length} user{g.assigns.length === 1 ? "" : "s"}</span>
                        {g.totalSharePct > 0 && <span>· {g.totalSharePct.toFixed(2)}% pool</span>}
                        <span>· Master {fmtUsd(g.masterPl)}</span>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-[11px] tabular-nums text-slate-400">{stamp}</div>
                      <div className={`mt-1 text-[15px] font-bold tabular-nums ${plTextClass(g.userPlSum)}`}>
                        {g.isOpen ? "~" : ""}
                        {g.userPlSum >= 0 ? "+" : ""}
                        {fmtUsd(g.userPlSum)}
                      </div>
                      <div className="mt-0.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            g.isOpen
                              ? "bg-sky-50 text-sky-700"
                              : "border border-slate-200 bg-slate-100 text-slate-600"
                          }`}
                        >
                          {g.status}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <ListPaginationBar
            page={page}
            totalPages={totalPages}
            total={filteredTotal}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            itemLabel="tickets"
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl shadow-neutral-900/8">
          <div className="min-h-[260px] divide-y divide-slate-100">
            {loading ? (
              <div className="p-10 text-center text-slate-500">
                <RefreshCw className="mx-auto mb-2 animate-spin text-yellow-800" />
                Loading trades...
              </div>
            ) : pageItems.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                {trades.length === 0 ? "No trades" : "No trades match your filters"}
              </div>
            ) : (
              (pageItems as Mt5Trade[]).map((trade, index) => {
                const row: UserTradeRowLike = {
                  ticket_id: trade.ticket,
                  symbol: trade.symbol,
                  price: trade.price,
                  mt5_type: trade.type,
                  mt5_volume: trade.volume,
                  mt5_total_profit: trade.profit,
                  mt5_status: trade.status,
                  close_time: trade.close_time,
                };
                const { buyPrice, sellPrice, buyIsLive, sellIsLive } =
                  resolveMt5BuySellPrices(row);
                const side = formatMt5SideLabel(trade.type);
                const isSell = side === "Sell";
                const isBuy = !isSell;
                const entry = isBuy ? buyPrice : sellPrice;
                const exit = isBuy ? sellPrice : buyPrice;
                const exitLive = isBuy ? sellIsLive : buyIsLive;
                const ticket = String(trade.ticket ?? index);
                const assignCount = assignsByTicket.get(ticket)?.length ?? 0;
                const isOpen = String(trade.status ?? "").toUpperCase() === "OPEN";
                const stamp = fmtMt5DateTime(isOpen ? trade.open_time : trade.close_time);
                const profit = Number(trade.profit);
                const sideCls = isSell ? "text-red-600" : "text-emerald-600";

                return (
                  <div
                    key={`${trade.ticket}-${index}`}
                    className={`flex items-start justify-between gap-3 px-4 py-3 transition hover:bg-yellow-50/40 ${
                      assignCount > 0 ? "cursor-pointer" : ""
                    }`}
                    onClick={() => {
                      if (assignCount > 0) setDialogTicket(ticket);
                    }}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 text-[15px] font-bold text-slate-900">
                        <span className="truncate">{trade.symbol}</span>
                        {side !== "—" && (
                          <span className={`font-semibold ${sideCls}`}>
                            , {side.toLowerCase()} {fmtLots(Number(trade.volume))}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-sm tabular-nums text-slate-500">
                        {entry != null ? fmtMt5Price(entry, trade.symbol) : "—"}
                        <span className="mx-1 text-slate-400">→</span>
                        {!isOpen ? "" : exitLive && exit != null ? "~" : ""}
                        {exit != null ? fmtMt5Price(exit, trade.symbol) : "—"}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
                        <span className={assignCount > 0 ? "text-yellow-900" : ""}>#{trade.ticket}</span>
                        {trade.account && <span>· {trade.account}</span>}
                        {assignCount > 0 && <span>· {assignCount} user{assignCount === 1 ? "" : "s"}</span>}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-[11px] tabular-nums text-slate-400">{stamp}</div>
                      <div className={`mt-1 text-[15px] font-bold tabular-nums ${plTextClass(profit)}`}>
                        {Number.isFinite(profit) && profit >= 0 ? "+" : ""}
                        {Number.isFinite(profit) ? fmtUsd(profit) : "—"}
                      </div>
                      <div className="mt-0.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            isOpen
                              ? "bg-sky-50 text-sky-700"
                              : "border border-slate-200 bg-slate-100 text-slate-600"
                          }`}
                        >
                          {trade.status}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <ListPaginationBar
            page={page}
            totalPages={totalPages}
            total={filteredTotal}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            itemLabel="trades"
          />
        </div>
      )}

      <TicketAssignDialog
        open={dialogTicket != null}
        onOpenChange={(o) => {
          if (!o) setDialogTicket(null);
        }}
        ticketId={dialogTicket}
        symbol={dialogSymbol}
        rows={dialogRows}
        liveProfitByTicket={liveProfitByTicket}
      />
    </div>
  );
};

export default OpenTrades;
