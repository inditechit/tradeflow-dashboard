/** Min lifetime deposit to count as a funded trader on the admin map. */
export const MAP_PROFITABLE_MIN_DEPOSIT_USD = 10;

export type MapUserFinanceRow = {
  recharge_total_usd?: unknown;
  total_deposited_usd?: unknown;
  trading_wallet_usd?: unknown;
  safe_wallet_usd?: unknown;
  wallet_balance?: unknown;
  total_withdrawn_usd?: unknown;
  completed_withdraw_usd?: unknown;
  deposit_baseline_usd?: unknown;
  live_pl?: unknown;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function mapUserDepositedUsd(u: MapUserFinanceRow): number {
  return Number(u.total_deposited_usd ?? u.recharge_total_usd ?? 0);
}

export function mapUserTradingUsd(u: MapUserFinanceRow): number {
  return Number(u.trading_wallet_usd ?? u.wallet_balance ?? 0);
}

export function mapUserSafeUsd(u: MapUserFinanceRow): number {
  return Number(u.safe_wallet_usd ?? 0);
}

export function mapUserWithdrawnUsd(u: MapUserFinanceRow): number {
  return Number(u.total_withdrawn_usd ?? u.completed_withdraw_usd ?? 0);
}

/** Trading + safe + completed withdrawals (lifetime value extracted from the platform). */
export function mapUserLifetimeValueUsd(u: MapUserFinanceRow): number {
  return mapUserTradingUsd(u) + mapUserSafeUsd(u) + mapUserWithdrawnUsd(u);
}

/**
 * Net P/L vs deposits: wallets + withdrawn + open live P/L − total deposited.
 * Positive = user is ahead; negative = net loss (e.g. −$14k).
 */
export function mapUserNetPlUsd(u: MapUserFinanceRow): number {
  const deposited = mapUserDepositedUsd(u);
  const livePl = Number(u.live_pl ?? 0);
  return round2(mapUserLifetimeValueUsd(u) + livePl - deposited);
}

/** Funded trader with net lifetime profit (not merely still holding balance after deposits). */
export function isMapProfitableUser(u: MapUserFinanceRow): boolean {
  const deposited = mapUserDepositedUsd(u);
  if (deposited < MAP_PROFITABLE_MIN_DEPOSIT_USD) return false;
  return mapUserNetPlUsd(u) > 0.02;
}

/** Lifetime value (trading + safe + withdrawn) above stored deposit baseline. */
export function isMapAboveBaselineUser(u: MapUserFinanceRow): boolean {
  const baseline = Number(u.deposit_baseline_usd ?? 0);
  if (baseline <= 0.01) return false;
  return mapUserLifetimeValueUsd(u) > baseline;
}

export function normalizeCountryLabel(country: unknown): string {
  const s = String(country ?? "").trim();
  return s || "Unknown";
}
