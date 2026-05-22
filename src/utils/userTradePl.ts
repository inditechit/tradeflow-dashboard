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
  sum_user_investment?: unknown;
  proportional_fee?: unknown;
  admin_profit_percentage?: unknown;
  snapshot_pct?: unknown;
  user_pct?: unknown;
  wallet_settled_at?: unknown;
  final_profit_loss?: unknown;
  mt5_total_profit?: unknown;
  user_estimated_net_pl?: unknown;
};

const FEE_PER_LOT_USD = 30;

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
  const v_i =
    allocated > 0 ? allocated : V > 0 && effectiveShare > 0 ? V * effectiveShare : 0;
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

  if (r.wallet_settled_at != null) {
    const settled = Number(r.final_profit_loss ?? 0);
    if (settled !== 0 || !(V > 0 && v_i > 0) || Math.abs(P) < 0.0001) {
      return settled;
    }
  }

  if (!(V > 0 && v_i > 0)) return 0;

  const userRaw = P * (v_i / V);
  const computed = applyUserRules(userRaw, fee, pct);

  if (liveMt5Profit != null && Number.isFinite(liveMt5Profit)) {
    return computed;
  }

  const apiNet =
    r.user_estimated_net_pl == null ? null : Number(r.user_estimated_net_pl);
  if (apiNet != null && Number.isFinite(apiNet) && r.wallet_settled_at == null) {
    return apiNet;
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
