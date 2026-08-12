export const ADMIN_USER_TRADES_COLUMNS_STORAGE_KEY =
  "tradeflow.admin.userTrades.tableColumns.v1";

export type AdminUserTradesColumnId =
  | "ticket"
  | "symbol"
  | "side"
  | "opened"
  | "closed"
  | "volume"
  | "buy_price"
  | "sell_price"
  | "fee"
  | "gross_pl"
  | "user_exposure"
  | "admin_risk"
  | "risk_pl"
  | "admin_share"
  | "wallet_pl"
  | "status";

export type AdminUserTradesColumnDef = {
  id: AdminUserTradesColumnId;
  label: string;
  defaultVisible: boolean;
  headerClassName?: string;
  title?: string;
};

export const ADMIN_USER_TRADES_TABLE_COLUMNS: AdminUserTradesColumnDef[] = [
  { id: "ticket", label: "Ticket", defaultVisible: true },
  { id: "symbol", label: "Symbol", defaultVisible: true },
  { id: "side", label: "Side", defaultVisible: true },
  { id: "opened", label: "Opened", defaultVisible: true },
  { id: "closed", label: "Closed", defaultVisible: true },
  { id: "volume", label: "Vol.", defaultVisible: true },
  { id: "buy_price", label: "Buy price", defaultVisible: true },
  { id: "sell_price", label: "Sell price", defaultVisible: true },
  { id: "fee", label: "Fee", defaultVisible: true },
  { id: "gross_pl", label: "Gross P/L", defaultVisible: true },
  { id: "user_exposure", label: "User exp.", defaultVisible: true },
  { id: "admin_risk", label: "Admin risk", defaultVisible: true },
  { id: "risk_pl", label: "Risk P/L", defaultVisible: true },
  {
    id: "admin_share",
    label: "Admin share",
    defaultVisible: true,
    title: "Positive = admin claim on profit; negative = admin loss clawback",
  },
  { id: "wallet_pl", label: "Wallet P/L", defaultVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
];

export type AdminUserTradesColumnVisibility = Record<AdminUserTradesColumnId, boolean>;

export function defaultAdminUserTradesColumnVisibility(): AdminUserTradesColumnVisibility {
  return Object.fromEntries(
    ADMIN_USER_TRADES_TABLE_COLUMNS.map((c) => [c.id, c.defaultVisible]),
  ) as AdminUserTradesColumnVisibility;
}

export function loadAdminUserTradesColumnVisibility(): AdminUserTradesColumnVisibility {
  const defaults = defaultAdminUserTradesColumnVisibility();
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(ADMIN_USER_TRADES_COLUMNS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return defaults;
    const next = { ...defaults };
    for (const col of ADMIN_USER_TRADES_TABLE_COLUMNS) {
      if (typeof parsed[col.id] === "boolean") {
        next[col.id] = parsed[col.id] as boolean;
      }
    }
    return next;
  } catch {
    return defaults;
  }
}

export function saveAdminUserTradesColumnVisibility(
  visibility: AdminUserTradesColumnVisibility,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ADMIN_USER_TRADES_COLUMNS_STORAGE_KEY, JSON.stringify(visibility));
  } catch {
    // ignore quota / private mode
  }
}
