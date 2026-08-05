/** Human-readable labels for wallet ledger entry_type values. */
export function formatLedgerEntryType(entryType: string | null | undefined): string {
  const raw = String(entryType || "").trim();
  if (!raw) return "—";
  const map: Record<string, string> = {
    admin_settle_share: "Admin Share",
    trade_settlement: "Trade settlement",
    trade_settlement_v2: "Trade settlement",
    trade_fee: "Trading fee",
    assign_fee: "Trading fee",
    recharge: "Recharge",
    recharge_wallet: "Recharge",
    withdrawal: "Withdrawal",
    trading_to_safe: "Trading → Safe",
    safe_to_trading: "Safe → Trading",
    admin_adjust: "Admin adjust",
    admin_wallet_credit: "Admin credit",
    package_purchase: "Package purchase",
  };
  if (map[raw]) return map[raw];
  return raw
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
