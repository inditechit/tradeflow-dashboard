/**
 * User net P/L per trade — same rules as My Trades (fee + profit % on positive net).
 */

export type UserTradeRowLike = {
  ticket_id?: unknown;
  symbol?: unknown;
  mt5_status?: unknown;
  mt5_volume?: unknown;
  total_trade_volume?: unknown;
  allocated_volume?: unknown;
  user_volume_share?: unknown;
  user_investment_amount?: unknown;
  user_bal?: unknown;
  amt_invested?: unknown;
  sum_user_investment?: unknown;
  proportional_fee?: unknown;
  admin_profit_percentage?: unknown;
  snapshot_pct?: unknown;
  user_pct?: unknown;
  wallet_settled_at?: unknown;
  final_profit_loss?: unknown;
  mt5_total_profit?: unknown;
  user_net_pl?: unknown;
  user_raw_pl?: unknown;
  user_estimated_net_pl?: unknown;
  price?: unknown;
  mt5_type?: unknown;
  close_time?: unknown;
};

const FEE_PER_LOT_USD = 30;

export function parseMt5Price(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function fmtMt5Price(n: number, symbol?: unknown): string {
  const sym = String(symbol ?? "").toUpperCase();
  let digits = 2;
  if (sym.startsWith("XAU") || sym.startsWith("GOLD") || sym.includes("BTC")) {
    digits = 2;
  } else if (sym.length >= 6 && sym.length <= 7) {
    digits = 5;
  }
  return n.toFixed(digits);
}

export function isTradeClosed(
  r: UserTradeRowLike & { close_time?: unknown }
): boolean {
  if (r.wallet_settled_at != null) return true;
  const st = String(r.mt5_status ?? "").toUpperCase();
  if (st.includes("CLOSE")) return true;
  const ct = r.close_time;
  if (
    ct != null &&
    String(ct).trim() !== "" &&
    String(ct) !== "0000-00-00 00:00:00"
  ) {
    return true;
  }
  return false;
}

function isMt5BuyType(type: unknown): boolean {
  const t = String(type ?? "").toUpperCase();
  if (!t) return true;
  if (t.includes("SELL")) return false;
  return t.includes("BUY");
}

/** MT5 contract size per lot (broker default for XAU / FX). */
export function contractSizeForSymbol(symbol?: unknown): number {
  const sym = String(symbol ?? "").toUpperCase();
  if (sym.startsWith("XAU") || sym.startsWith("GOLD")) return 100;
  if (sym.length >= 6 && sym.length <= 7) return 100_000;
  return 100;
}

/**
 * Back-calculate entry from close price + MT5 profit.
 * Long: profit = (close − open) × lots × contractSize → open = close − profit/(lots×size)
 */
export function deriveEntryPriceFromMt5(
  closePrice: number,
  profit: number,
  volumeLots: number,
  symbol?: unknown,
  type?: unknown
): number | null {
  if (!(closePrice > 0) || !(volumeLots > 0) || !Number.isFinite(profit)) return null;
  const divisor = volumeLots * contractSizeForSymbol(symbol);
  if (!(divisor > 0)) return null;
  const move = profit / divisor;
  if (!Number.isFinite(move)) return null;
  const entry = isMt5BuyType(type) ? closePrice - move : closePrice + move;
  return entry > 0 && Number.isFinite(entry) ? entry : null;
}

/**
 * Buy price = where you bought; sell price = where you sold.
 * Long: buy at open, sell at close. Short: sell at open, buy at close.
 */
export function resolveMt5BuySellPrices(
  r: UserTradeRowLike,
  entryByTicket?: Record<string, number>
): {
  buyPrice: number | null;
  sellPrice: number | null;
  buyIsLive: boolean;
  sellIsLive: boolean;
} {
  const exit = parseMt5Price(r.price);
  const closed = isTradeClosed(r);
  const isLong = isMt5BuyType(r.mt5_type);
  const ticket = String(r.ticket_id ?? "");
  const cached =
    ticket && entryByTicket?.[ticket] != null && entryByTicket[ticket] > 0
      ? entryByTicket[ticket]
      : null;

  const volumeLots = Number(r.mt5_volume || r.total_trade_volume || 0);
  const mt5Profit = Number(r.mt5_total_profit ?? 0);

  let entry = cached;
  if (entry == null && exit != null && volumeLots > 0 && Number.isFinite(mt5Profit)) {
    entry = deriveEntryPriceFromMt5(
      exit,
      mt5Profit,
      volumeLots,
      r.symbol,
      r.mt5_type
    );
  }

  if (!exit && entry == null) {
    return { buyPrice: null, sellPrice: null, buyIsLive: false, sellIsLive: false };
  }

  if (isLong) {
    return {
      buyPrice: entry,
      sellPrice: exit,
      buyIsLive: false,
      sellIsLive: !closed && exit != null,
    };
  }

  return {
    buyPrice: exit,
    sellPrice: entry,
    buyIsLive: !closed && exit != null,
    sellIsLive: false,
  };
}

/** Match backend /api/user/trades volume + fee + % resolution. */
export function resolveEffectiveSlice(r: UserTradeRowLike) {
  const V = Number(r.mt5_volume || r.total_trade_volume || 0);
  const allocated = Number(r.allocated_volume || 0);
  const storedShare = Number(r.user_volume_share || 0);
  const userInv =
    Number(r.user_investment_amount || 0) > 0
      ? Number(r.user_investment_amount)
      : Number(r.user_bal || 0);
  const sumInv = Number(r.sum_user_investment || 0);
  const derivedShare = sumInv > 0 ? userInv / sumInv : 0;
  const effectiveShare = storedShare > 0 ? storedShare : derivedShare;
  let v_i =
    allocated > 0 ? allocated : V > 0 && effectiveShare > 0 ? V * effectiveShare : 0;
  if (V > 0 && v_i > V) v_i = V;
  const fee =
    r.proportional_fee != null && Number(r.proportional_fee) > 0
      ? Number(r.proportional_fee)
      : v_i * FEE_PER_LOT_USD;
  const snapshotPct = Number(r.snapshot_pct ?? 0);
  const storedPct = Number(r.admin_profit_percentage ?? 0);
  const userPct = Number(r.user_pct ?? 0);
  // Snapshot/admin field can be 0 in DB — fall back to live user %, then 50 (DB default).
  let pct = snapshotPct > 0 ? snapshotPct : storedPct > 0 ? storedPct : userPct;
  if (!(pct > 0)) pct = 50;
  return { v_i, V, fee, pct, effectiveShare };
}

export function applyUserRules(rawPl: number, fee: number, pct: number): number {
  if (!Number.isFinite(rawPl)) return 0;
  if (rawPl <= 0) return rawPl;
  const net = rawPl - fee;
  if (net <= 0) return net;
  return net * (pct / 100);
}

function volumeShare(r: UserTradeRowLike): { v_i: number; V: number } {
  const { v_i, V } = resolveEffectiveSlice(r);
  return { v_i, V };
}

/** Net P/L for one assignment row (settled wallet delta or live estimate). */
export function rowNetPl(
  r: UserTradeRowLike,
  liveMt5Profit?: number
): number {
  const { v_i, V, fee, pct } = resolveEffectiveSlice(r);
  const P =
    liveMt5Profit != null && Number.isFinite(liveMt5Profit)
      ? liveMt5Profit
      : Number(r.mt5_total_profit || 0);

  const apiNet = r.user_net_pl == null ? null : Number(r.user_net_pl);
  if (apiNet != null && Number.isFinite(apiNet)) {
    return apiNet;
  }

  if (r.wallet_settled_at != null) {
    const settled = Number(r.final_profit_loss ?? 0);
    if (!(V > 0 && v_i > 0) || Math.abs(P) < 0.0001) {
      return settled;
    }
    const userRaw = P * (v_i / V);
    const recomputed = applyUserRules(userRaw, fee, pct);
    if (Math.abs(settled - recomputed) > 0.02) {
      return recomputed;
    }
    return settled;
  }

  if (!(V > 0 && v_i > 0)) return 0;

  const userRaw = P * (v_i / V);
  const computed = applyUserRules(userRaw, fee, pct);

  if (liveMt5Profit != null && Number.isFinite(liveMt5Profit)) {
    return computed;
  }

  const estimatedNet =
    r.user_estimated_net_pl == null ? null : Number(r.user_estimated_net_pl);
  if (estimatedNet != null && Number.isFinite(estimatedNet)) {
    return estimatedNet;
  }

  return computed;
}

/** Sum net P/L across all user trade rows (no signup-date filter). */
export function sumUserTradeNetPl(
  rows: UserTradeRowLike[],
  liveProfitByTicket?: Record<string, number>
): number {
  let sum = 0;
  for (const r of rows) {
    const ticket = String(r.ticket_id ?? "");
    const live = ticket ? liveProfitByTicket?.[ticket] : undefined;
    sum += rowNetPl(r, live);
  }
  return sum;
}

export function isOpenTrade(r: UserTradeRowLike): boolean {
  if (r.wallet_settled_at != null) return false;
  const st = String(r.mt5_status ?? "").toUpperCase();
  return st.includes("OPEN");
}

/** Split live (open, unsettled) P/L into profit and loss buckets. */
export function sumLiveProfitLoss(
  rows: UserTradeRowLike[],
  liveProfitByTicket?: Record<string, number>
): { profit: number; loss: number; net: number } {
  let profit = 0;
  let loss = 0;
  for (const r of rows) {
    if (!isOpenTrade(r)) continue;
    const ticket = String(r.ticket_id ?? "");
    const live = ticket ? liveProfitByTicket?.[ticket] : undefined;
    const pl = rowNetPl(r, live);
    if (pl >= 0) profit += pl;
    else loss += pl;
  }
  return { profit, loss, net: profit + loss };
}
