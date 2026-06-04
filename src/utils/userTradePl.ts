/**
 * User P/L per trade:
 * - Live/open: estimate only (wallet unchanged until MT5 position closes).
 * - Closed/settled: final_profit_loss = actual wallet credit (baseline waterfall).
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
  raw_proportional_pl?: unknown;
  user_display_pl?: unknown;
  user_wallet_pl?: unknown;
  user_wallet_credit?: unknown;
  mt5_total_profit?: unknown;
  user_net_pl?: unknown;
  user_raw_pl?: unknown;
  user_estimated_net_pl?: unknown;
  user_facing_pl?: unknown;
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

export function contractSizeForSymbol(symbol?: unknown): number {
  const sym = String(symbol ?? "").toUpperCase();
  if (sym.startsWith("XAU") || sym.startsWith("GOLD")) return 100;
  if (sym.length >= 6 && sym.length <= 7) return 100_000;
  return 100;
}

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

/** Volume slice: prefer global pool share from allocation, not ticket-only headcount. */
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
  let v_i = allocated > 0 ? allocated : 0;
  if (v_i <= 0 && V > 0 && storedShare > 0) {
    v_i = V * storedShare;
  } else if (v_i <= 0 && V > 0 && effectiveShare > 0) {
    v_i = V * effectiveShare;
  }
  if (V > 0 && v_i > V) v_i = V;
  const fee =
    r.proportional_fee != null && Number(r.proportional_fee) > 0
      ? Number(r.proportional_fee)
      : v_i * FEE_PER_LOT_USD;
  const snapshotPct = Number(r.snapshot_pct ?? 0);
  const storedPct = Number(r.admin_profit_percentage ?? 0);
  const userPct = Number(r.user_pct ?? 0);
  let pct = snapshotPct > 0 ? snapshotPct : storedPct > 0 ? storedPct : userPct;
  if (!(pct > 0)) pct = 50;
  return { v_i, V, fee, pct, effectiveShare };
}

export function applyUserRules(rawPl: number, fee: number, pct: number): number {
  if (!Number.isFinite(rawPl)) return 0;
  const feeUsd = Math.max(0, Number(fee) || 0);
  if (rawPl <= 0) return rawPl - feeUsd;
  const net = rawPl - feeUsd;
  if (net <= 0) return net;
  return net * (pct / 100);
}

/** Matches backend baseline waterfall — user $ credited if trade closed now. */
export function estimateUserSharePl(
  rawPl: number,
  fee: number,
  pct: number,
  walletBefore: number,
  depositBaseline: number,
  /** Wallet + other open gross P/L (excludes this trade). Defaults to wallet. */
  equityBefore?: number,
): number {
  const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
  const baseline = round2(depositBaseline);
  let wallet = round2(walletBefore);
  const equity = round2(equityBefore != null ? equityBefore : walletBefore);
  const gross = round2(rawPl);
  const feeUsd = round2(Math.max(0, fee));

  if (gross <= 0) return round2(Math.max(-wallet, gross - feeUsd));

  let net = round2(gross - feeUsd);
  if (net <= 0) return round2(Math.max(-wallet, net));

  const gap = round2(Math.max(0, baseline - equity));
  if (gap > 0) {
    const recovery = round2(Math.min(net, gap));
    wallet = round2(wallet + recovery);
    net = round2(net - recovery);
  }

  if (net > 0) {
    const p = Math.min(100, Math.max(0, Number(pct) || 0));
    wallet = round2(wallet + (net * p) / 100);
  }

  return round2(wallet - walletBefore);
}

export type UserShareContext = {
  walletBefore: number;
  depositBaseline: number;
  /** Wallet + other open gross P/L (excludes this trade). */
  equityBefore?: number;
  useBaseline?: boolean;
};

/** P/L shown to user (their wallet share, not full proportional pool slice). */
export function rowUserSharePl(
  r: UserTradeRowLike,
  liveMt5Profit?: number,
  ctx?: UserShareContext,
): number {
  const raw = proportionalRawPl(r, liveMt5Profit);
  const { fee, pct } = resolveEffectiveSlice(r);
  if (ctx && ctx.useBaseline !== false && ctx.depositBaseline > 0) {
    return estimateUserSharePl(
      raw,
      fee,
      pct,
      ctx.walletBefore,
      ctx.depositBaseline,
      ctx.equityBefore,
    );
  }
  if (ctx) {
    return applyUserRules(raw, fee, pct);
  }
  return applyUserRules(raw, fee, pct);
}

export function proportionalRawPl(
  r: UserTradeRowLike,
  liveMt5Profit?: number
): number {
  const { v_i, V } = resolveEffectiveSlice(r);
  const P =
    liveMt5Profit != null && Number.isFinite(liveMt5Profit)
      ? liveMt5Profit
      : Number(r.mt5_total_profit || 0);
  if (!(V > 0 && v_i > 0)) return 0;
  return P * (v_i / V);
}

/** Full share P/L shown in UI (your slice of the trade). */
export function rowDisplayPl(
  r: UserTradeRowLike,
  liveMt5Profit?: number
): number {
  const apiDisplay =
    r.user_display_pl != null
      ? Number(r.user_display_pl)
      : r.user_raw_pl != null
        ? Number(r.user_raw_pl)
        : r.user_net_pl != null
          ? Number(r.user_net_pl)
          : null;
  if (apiDisplay != null && Number.isFinite(apiDisplay) && liveMt5Profit == null) {
    return apiDisplay;
  }
  if (r.wallet_settled_at != null) {
    if (r.raw_proportional_pl != null && liveMt5Profit == null) {
      return Number(r.raw_proportional_pl);
    }
    if (apiDisplay != null && Number.isFinite(apiDisplay)) {
      return apiDisplay;
    }
  }
  return proportionalRawPl(r, liveMt5Profit);
}

/** Wallet credit after fee + your profit % (withdraw / settlement). */
export function rowWalletPl(
  r: UserTradeRowLike,
  liveMt5Profit?: number
): number {
  const apiWallet =
    r.user_wallet_pl != null
      ? Number(r.user_wallet_pl)
      : r.user_wallet_credit != null
        ? Number(r.user_wallet_credit)
        : null;
  if (apiWallet != null && Number.isFinite(apiWallet) && liveMt5Profit == null) {
    return apiWallet;
  }
  if (r.wallet_settled_at != null) {
    const settled = Number(r.final_profit_loss ?? apiWallet ?? 0);
    if (liveMt5Profit == null && Number.isFinite(settled)) {
      return settled;
    }
  }
  const { fee, pct } = resolveEffectiveSlice(r);
  return applyUserRules(proportionalRawPl(r, liveMt5Profit), fee, pct);
}

/** Home / P&L: closed = wallet impact; open = estimated user share. */
export function rowUserFacingPl(
  r: UserTradeRowLike,
  liveMt5Profit?: number,
  ctx?: UserShareContext,
): number {
  const apiFacing = r.user_facing_pl != null ? Number(r.user_facing_pl) : NaN;
  if (Number.isFinite(apiFacing)) return apiFacing;

  if (isTradeClosed(r) || r.wallet_settled_at != null) {
    const settled = Number(
      r.final_profit_loss ?? r.user_wallet_credit ?? r.user_wallet_pl ?? NaN,
    );
    if (Number.isFinite(settled) && !(settled === 0 && !r.wallet_settled_at)) {
      return settled;
    }
    const walletPl = Number(r.user_wallet_pl ?? NaN);
    if (Number.isFinite(walletPl) && walletPl !== 0) return walletPl;
    const display = Number(r.user_display_pl ?? r.raw_proportional_pl ?? NaN);
    if (Number.isFinite(display) && liveMt5Profit == null) return display;
  }
  return rowUserSharePl(r, liveMt5Profit, ctx);
}

/** Gross proportional share of master P/L (before lot fee). */
export function rowGrossPl(
  r: UserTradeRowLike,
  liveMt5Profit?: number,
): number {
  if (liveMt5Profit == null && r.raw_proportional_pl != null) {
    return Number(r.raw_proportional_pl);
  }
  if (liveMt5Profit == null && r.user_raw_pl != null) {
    return Number(r.user_raw_pl);
  }
  return rowDisplayPl(r, liveMt5Profit);
}

/** Wallet credit after fee (and profit-share rules on wins). */
export function rowFinalWalletPl(
  r: UserTradeRowLike,
  liveMt5Profit?: number,
  ctx?: UserShareContext,
): number {
  return rowWalletPl(r, liveMt5Profit) ?? rowUserFacingPl(r, liveMt5Profit, ctx);
}

/** @deprecated Use rowFinalWalletPl */
export function rowNetPl(
  r: UserTradeRowLike,
  liveMt5Profit?: number,
  ctx?: UserShareContext,
): number {
  return rowUserFacingPl(r, liveMt5Profit, ctx);
}

export function sumUserTradeNetPl(
  rows: UserTradeRowLike[],
  liveProfitByTicket?: Record<string, number>
): number {
  let sum = 0;
  for (const r of rows) {
    const ticket = String(r.ticket_id ?? "");
    const live = ticket ? liveProfitByTicket?.[ticket] : undefined;
    sum += rowDisplayPl(r, live);
  }
  return sum;
}

export function isOpenTrade(r: UserTradeRowLike): boolean {
  const st = String(r.mt5_status ?? "").toUpperCase();
  if (st.includes("CLOSE")) return false;
  const ct = r.close_time;
  const hasClose =
    ct != null &&
    String(ct).trim() !== "" &&
    String(ct) !== "0000-00-00 00:00:00";
  if (hasClose) return false;
  if (st.includes("OPEN")) return true;
  if (r.wallet_settled_at != null) return false;
  return true;
}

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
    const pl = rowDisplayPl(r, live);
    if (pl >= 0) profit += pl;
    else loss += pl;
  }
  return { profit, loss, net: profit + loss };
}
