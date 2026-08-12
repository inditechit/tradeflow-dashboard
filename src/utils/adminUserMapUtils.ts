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
};

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

/** Deposited ≥ $10 and trading + safe + withdrawn > $10. */
export function isMapProfitableUser(u: MapUserFinanceRow): boolean {
  const deposited = mapUserDepositedUsd(u);
  const total =
    mapUserTradingUsd(u) + mapUserSafeUsd(u) + mapUserWithdrawnUsd(u);
  return deposited >= MAP_PROFITABLE_MIN_DEPOSIT_USD && total > MAP_PROFITABLE_MIN_DEPOSIT_USD;
}

/** Lifetime value (trading + safe + withdrawn) above stored deposit baseline. */
export function isMapAboveBaselineUser(u: MapUserFinanceRow): boolean {
  const baseline = Number(u.deposit_baseline_usd ?? 0);
  if (baseline <= 0.01) return false;
  const total =
    mapUserTradingUsd(u) + mapUserSafeUsd(u) + mapUserWithdrawnUsd(u);
  return total > baseline;
}

export function normalizeCountryLabel(country: unknown): string {
  const s = String(country ?? "").trim();
  return s || "Unknown";
}
