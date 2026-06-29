import React, { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  formatMt5SideLabel,
  resolveMt5BuySellPrices,
  resolveEffectiveSlice,
  fmtMt5Price,
  isOpenTrade,
  isTradeClosed,
  type UserTradeRowLike,
} from "@/utils/userTradePl";
import { plTextClass } from "@/utils/plColors";
import { resolveRowAdminUserPl } from "@/utils/adminLiveFinance";
import { startOfDayMs, endOfDayMs } from "@/utils/mt5TradeDates";
import { useClientPagination } from "@/hooks/useClientPagination";
import { ListPaginationBar } from "@/components/trades/TradesPaginationBar";

export type Mt5HistoryRow = UserTradeRowLike & {
  open_time?: string | null;
  close_time?: string | null;
  assignment_created_at?: string | null;
};

type PeriodKey = "today" | "week" | "month" | "all" | "custom";

/** MT5-style account summary shown under the list (English labels). */
export type Mt5AccountSummary = {
  /** Optional: footer "Profit" is derived from the visible rows (period-aware), like MT5. */
  profit?: number;
  credit?: number;
  deposit: number;
  /** Pass as a negative number to render like MT5 (e.g. -6000). */
  withdrawal: number;
  balance: number;
  equity?: number;
};

type Props = {
  trades: Mt5HistoryRow[];
  /** User-facing P/L for one row (wallet share after fee + profit rules). */
  getRowPl: (row: Mt5HistoryRow) => number;
  loading?: boolean;
  currency?: string;
  /** Cached open-trade entry prices keyed by ticket (for live open rows). */
  entryByTicket?: Record<string, number>;
  emptyMessage?: string;
  pageSize?: number;
  /** When set, renders the MT5-style account totals instead of the period total. */
  accountSummary?: Mt5AccountSummary;
  /** Admin: show user/admin profit split and frozen user %. */
  showProfitShare?: boolean;
  /** Admin: show assign fee debited from user wallet per trade. */
  showTradeFee?: boolean;
};

const DAY_MS = 86_400_000;

const PERIOD_TABS: Array<{ key: PeriodKey; label: string }> = [
  { key: "today", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "all", label: "All" },
  { key: "custom", label: "Custom" },
];

function fmtMoney(n: number, currency = "USD"): string {
  const code = String(currency || "USD").toUpperCase();
  const safe = /^[A-Z]{3}$/.test(code) ? code : "USD";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: safe,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${safe} ${n.toFixed(2)}`;
  }
}

function fmtLots(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return "—";
  return v >= 0.01 ? v.toFixed(2) : v.toFixed(4);
}

function rowEventMs(r: Mt5HistoryRow): number | null {
  const closed = isTradeClosed(r);
  const raw = closed
    ? r.close_time ?? r.open_time ?? r.assignment_created_at
    : r.open_time ?? r.assignment_created_at;
  if (!raw) return null;
  const ms = Date.parse(String(raw).replace(" ", "T"));
  return Number.isFinite(ms) ? ms : null;
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

export function Mt5TradeHistoryList({
  trades,
  getRowPl,
  loading = false,
  currency = "USD",
  entryByTicket,
  emptyMessage = "No trades yet",
  pageSize = 50,
  accountSummary,
  showProfitShare = false,
  showTradeFee = false,
}: Props) {
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const filtered = useMemo(() => {
    const now = Date.now();
    let fromMs: number | null = null;
    let toMs: number | null = null;
    if (period === "today") {
      fromMs = startOfDayMs(new Date().toISOString().slice(0, 10));
    } else if (period === "week") {
      fromMs = now - 7 * DAY_MS;
    } else if (period === "month") {
      fromMs = now - 30 * DAY_MS;
    } else if (period === "custom") {
      fromMs = customFrom ? startOfDayMs(customFrom) : null;
      toMs = customTo ? endOfDayMs(customTo) : null;
    }

    const list = trades.filter((r) => {
      if (period === "all") return true;
      const ms = rowEventMs(r);
      if (ms == null) return false;
      if (fromMs != null && ms < fromMs) return false;
      if (toMs != null && ms > toMs) return false;
      return true;
    });

    return [...list].sort((a, b) => (rowEventMs(b) ?? 0) - (rowEventMs(a) ?? 0));
  }, [trades, period, customFrom, customTo]);

  const { page, setPage, pageItems, totalPages, total } = useClientPagination(
    filtered,
    pageSize,
  );

  const periodNetPl = useMemo(
    () => filtered.reduce((sum, r) => sum + (Number(getRowPl(r)) || 0), 0),
    [filtered, getRowPl],
  );

  const periodShareTotals = useMemo(() => {
    if (!showProfitShare) return null;
    let userSum = 0;
    let adminSum = 0;
    for (const r of filtered) {
      const ticket = String(r.ticket_id ?? "");
      const split = resolveRowAdminUserPl(r, ticket);
      userSum += split.userShare;
      adminSum += split.adminShare;
    }
    return {
      userSum: Math.round(userSum * 100) / 100,
      adminSum: Math.round(adminSum * 100) / 100,
    };
  }, [filtered, showProfitShare]);

  const periodFeeTotal = useMemo(() => {
    if (!showTradeFee) return 0;
    let fees = 0;
    for (const r of filtered) {
      const fee = resolveEffectiveSlice(r).fee;
      if (fee > 0) fees += fee;
    }
    return Math.round(fees * 100) / 100;
  }, [filtered, showTradeFee]);

  const activeLabel = PERIOD_TABS.find((t) => t.key === period)?.label ?? "All";

  // MT5-style: "Profit" reflects the trades currently shown (period-filtered),
  // not a fixed realised total — so it always matches the rows above it.
  const summaryProfit = periodNetPl;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl shadow-neutral-900/8">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
        {PERIOD_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setPeriod(t.key);
              setPage(1);
            }}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              period === t.key
                ? "bg-[#FFD700] text-black"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
        {period === "custom" && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => {
                setCustomFrom(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-700"
            />
            <span className="text-slate-400">→</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => {
                setCustomTo(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-700"
            />
          </div>
        )}
      </div>

      <div className="min-h-[260px] divide-y divide-slate-100">
        {loading && filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-500">
            <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-yellow-800" />
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500">{emptyMessage}</div>
        ) : (
          pageItems.map((r, i) => {
            const ticket = String(r.ticket_id ?? "");
            const side = formatMt5SideLabel(r.mt5_type);
            const isSell = side === "Sell";
            const isBuy = !isSell;
            const { buyPrice, sellPrice } = resolveMt5BuySellPrices(
              r,
              entryByTicket,
            );
            const entry = isBuy ? buyPrice : sellPrice;
            const exit = isBuy ? sellPrice : buyPrice;
            const slice = resolveEffectiveSlice(r);
            const tradeFee = showTradeFee ? Math.max(0, slice.fee) : 0;
            const vol = slice.v_i > 0 ? slice.v_i : Number(r.allocated_volume || 0);
            const open = isOpenTrade(r);
            const pl = Number(getRowPl(r)) || 0;
            const isProfit = pl >= 0;
            const split = showProfitShare
              ? resolveRowAdminUserPl(r, ticket)
              : null;
            const stamp = fmtMt5DateTime(
              open
                ? r.open_time ?? r.assignment_created_at
                : r.close_time ?? r.wallet_settled_at ?? r.open_time,
            );
            const sideCls = isSell ? "text-red-600" : "text-emerald-600";

            return (
              <div
                key={ticket || i}
                className="flex items-start justify-between gap-3 px-4 py-3 transition hover:bg-yellow-50/40"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1 text-[15px] font-bold text-slate-900">
                    <span className="truncate">{String(r.symbol || "—")}</span>
                    {side !== "—" && (
                      <span className={`font-semibold ${sideCls}`}>
                        , {side.toLowerCase()} {fmtLots(vol)}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-sm tabular-nums text-slate-500">
                    {entry != null ? fmtMt5Price(entry, r.symbol) : "—"}
                    <span className="mx-1 text-slate-400">→</span>
                    {open && exit != null ? "~" : ""}
                    {exit != null ? fmtMt5Price(exit, r.symbol) : "—"}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
                    <span>#{ticket}</span>
                    {showProfitShare && split && (
                      <span>
                        · {split.userSharePct}% user /{" "}
                        {Math.round((100 - split.userSharePct) * 100) / 100}% admin
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-[11px] tabular-nums text-slate-400">{stamp}</div>
                  {showProfitShare && split ? (
                    <>
                      <div
                        className={`mt-1 text-sm font-bold tabular-nums ${plTextClass(
                          split.adminShare,
                        )}`}
                      >
                        {open || split.estimate ? "~" : ""}
                        Admin {split.adminShare >= 0 ? "+" : ""}
                        {fmtMoney(split.adminShare, currency)}
                      </div>
                      <div
                        className={`mt-0.5 text-sm font-semibold tabular-nums ${plTextClass(
                          split.userShare,
                        )}`}
                      >
                        {open || split.estimate ? "~" : ""}
                        User {split.userShare >= 0 ? "+" : ""}
                        {fmtMoney(split.userShare, currency)}
                      </div>
                      {showTradeFee && (
                        <div className="mt-0.5 text-xs tabular-nums text-slate-500">
                          Fee {fmtMoney(tradeFee, currency)}
                        </div>
                      )}
                    </>
                  ) : (
                    <div
                      className={`mt-1 text-[15px] font-bold tabular-nums ${plTextClass(
                        isProfit ? 1 : -1,
                      )}`}
                    >
                      {open ? "~" : ""}
                      {isProfit ? "+" : ""}
                      {fmtMoney(pl, currency)}
                    </div>
                  )}
                  {!showProfitShare && showTradeFee && (
                    <div className="mt-0.5 text-xs tabular-nums text-slate-500">
                      Fee {fmtMoney(tradeFee, currency)}
                    </div>
                  )}
                  <div className="mt-0.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        open
                          ? "bg-sky-50 text-sky-700"
                          : "border border-slate-200 bg-slate-100 text-slate-600"
                      }`}
                    >
                      {open ? (r.mt5_status ? String(r.mt5_status) : "Open") : "Closed"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {accountSummary ? (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
          <dl className="space-y-1.5">
            <div className="flex items-center justify-between">
              <dt className="text-sm font-semibold text-slate-600">Profit</dt>
              <dd
                className={`text-sm font-bold tabular-nums ${plTextClass(
                  summaryProfit,
                )}`}
              >
                {summaryProfit >= 0 ? "+" : ""}
                {fmtMoney(summaryProfit, currency)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-sm font-semibold text-slate-600">Credit</dt>
              <dd className="text-sm tabular-nums text-slate-700">
                {fmtMoney(accountSummary.credit ?? 0, currency)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-sm font-semibold text-slate-600">Deposit</dt>
              <dd className="text-sm tabular-nums text-slate-700">
                {fmtMoney(accountSummary.deposit, currency)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-sm font-semibold text-slate-600">Withdrawal</dt>
              <dd
                className={`text-sm tabular-nums ${
                  accountSummary.withdrawal < 0 ? "text-red-600" : "text-slate-700"
                }`}
              >
                {fmtMoney(accountSummary.withdrawal, currency)}
              </dd>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-1.5">
              <dt className="text-sm font-bold text-slate-800">Balance</dt>
              <dd className="text-sm font-bold tabular-nums text-slate-900">
                {fmtMoney(accountSummary.balance, currency)}
              </dd>
            </div>
            {accountSummary.equity != null && (
              <div className="flex items-center justify-between">
                <dt className="text-sm font-bold text-slate-800">Equity</dt>
                <dd className="text-sm font-bold tabular-nums text-slate-900">
                  {fmtMoney(accountSummary.equity, currency)}
                </dd>
              </div>
            )}
          </dl>
        </div>
      ) : filtered.length > 0 ? (
        <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {total} trade{total === 1 ? "" : "s"} · {activeLabel}
          </span>
          <div className="flex flex-col items-end gap-1 sm:items-end">
            {showProfitShare && periodShareTotals ? (
              <>
                <span
                  className={`text-sm font-bold tabular-nums ${plTextClass(
                    periodShareTotals.adminSum,
                  )}`}
                >
                  Admin {periodShareTotals.adminSum >= 0 ? "+" : ""}
                  {fmtMoney(periodShareTotals.adminSum, currency)}
                </span>
                <span
                  className={`text-sm font-semibold tabular-nums ${plTextClass(
                    periodShareTotals.userSum,
                  )}`}
                >
                  User {periodShareTotals.userSum >= 0 ? "+" : ""}
                  {fmtMoney(periodShareTotals.userSum, currency)}
                </span>
                {showTradeFee && (
                  <span className="text-xs font-semibold tabular-nums text-slate-600">
                    Total fees {fmtMoney(periodFeeTotal, currency)}
                  </span>
                )}
              </>
            ) : (
              <>
                <span
                  className={`text-sm font-bold tabular-nums ${plTextClass(periodNetPl)}`}
                >
                  Total P/L {periodNetPl >= 0 ? "+" : ""}
                  {fmtMoney(periodNetPl, currency)}
                </span>
                {showTradeFee && (
                  <span className="text-xs font-semibold tabular-nums text-slate-600">
                    Total fees {fmtMoney(periodFeeTotal, currency)}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      ) : null}

      <ListPaginationBar
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        onPageChange={setPage}
      />
    </div>
  );
}

export default Mt5TradeHistoryList;
