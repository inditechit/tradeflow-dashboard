import { API_BASE } from "@/config/api";
import type { UserTradeRowLike } from "@/utils/userTradePl";

export type UserTradesCycle = {
  since_last_recharge?: boolean;
  last_recharge_at?: string | null;
  trade_filter_at?: string | null;
  cycle_deposit_usd?: number | null;
  pinned_baseline?: boolean;
  wallet_correction?: boolean;
};

export type TradeAbsenceRow = {
  ticket_id: string;
  mt5_open_time: string | null;
  reason: string;
  created_at?: string | null;
};

export type FetchAllUserTradesResult = {
  success: true;
  trades: UserTradeRowLike[];
  total: number;
  current_trade_count?: number;
  archived_trade_count?: number;
  cycle?: UserTradesCycle;
  fee_per_lot_usd?: number;
  trade_absences?: TradeAbsenceRow[];
  absence_count?: number;
};

type FetchOpts = {
  /** When false (default), returns every assign row in the DB. */
  sinceLastRecharge?: boolean;
  pageSize?: number;
  /** Admin user-trades page: full history, no settle-on-read side effects. */
  admin?: boolean;
};

/**
 * Load every trade_assign row for a user by walking API pages.
 * Avoids the 500-row default cap and the since_last_recharge cycle filter.
 */
export async function fetchAllUserTrades(
  userId: number | string,
  opts: FetchOpts = {},
): Promise<FetchAllUserTradesResult> {
  const sinceLastRecharge = opts.sinceLastRecharge ?? false;
  const admin = opts.admin === true;
  const pageSize = Math.min(Math.max(opts.pageSize ?? 500, 1), 5000);
  const sinceParam = sinceLastRecharge ? "1" : "0";

  const allTrades: UserTradeRowLike[] = [];
  let total = 0;
  let page = 1;
  let cycle: UserTradesCycle | undefined;
  let feePerLot: number | undefined;
  let tradeAbsences: TradeAbsenceRow[] | undefined;
  let absenceCount: number | undefined;

  let archivedTradeCount: number | undefined;
  let currentTradeCount: number | undefined;

  while (true) {
    const qs = new URLSearchParams({
      since_last_recharge: sinceParam,
      limit: String(pageSize),
      page: String(page),
    });
    if (admin) qs.set("admin", "1");
    const res = await fetch(`${API_BASE}/user/trades/${userId}?${qs.toString()}`);
    const data = await res.json();
    if (!data?.success) {
      throw new Error(data?.error || "Failed to load trades");
    }

    const batch = Array.isArray(data.trades) ? (data.trades as UserTradeRowLike[]) : [];
    allTrades.push(...batch);
    total = Number(data.total ?? allTrades.length);
    if (data.archived_trade_count != null) {
      archivedTradeCount = Number(data.archived_trade_count);
    }
    if (data.current_trade_count != null) {
      currentTradeCount = Number(data.current_trade_count);
    }
    if (data.cycle) cycle = data.cycle as UserTradesCycle;
    if (data.fee_per_lot_usd != null) feePerLot = Number(data.fee_per_lot_usd);
    if (page === 1 && Array.isArray(data.trade_absences)) {
      tradeAbsences = data.trade_absences as TradeAbsenceRow[];
      absenceCount = Number(data.absence_count ?? tradeAbsences.length);
    }

    if (batch.length < pageSize || allTrades.length >= total) break;
    page += 1;
  }

  return {
    success: true,
    trades: allTrades,
    total,
    current_trade_count: currentTradeCount,
    archived_trade_count: archivedTradeCount,
    cycle,
    fee_per_lot_usd: feePerLot,
    trade_absences: tradeAbsences,
    absence_count: absenceCount,
  };
}
