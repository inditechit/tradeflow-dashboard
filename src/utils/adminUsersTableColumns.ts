import {
  resolveRowAdminUserPl,
  type AdminOpenAssignRow,
} from "@/utils/adminLiveFinance";
import { isTradeClosed } from "@/utils/userTradePl";

export const ADMIN_USERS_COLUMNS_STORAGE_KEY = "tradeflow.admin.users.tableColumns.v2";

export type AdminUsersColumnId =
  | "name"
  | "status"
  | "wallet"
  | "equity"
  | "live_pl"
  | "admin_share"
  | "kyc"
  | "email"
  | "mobile"
  | "telegram"
  | "joined"
  | "package"
  | "referrer"
  | "risk"
  | "tags"
  | "label"
  | "deposit_baseline"
  | "open_positions"
  | "withdrawable"
  | "equity_pl"
  | "country"
  | "experience"
  | "profit_pct"
  | "fee_lot"
  | "recharge_total"
  | "trading";

export type AdminUsersColumnDef = {
  id: AdminUsersColumnId;
  label: string;
  /** Shown on first visit / after reset */
  defaultVisible: boolean;
  /** Existing employee permission gate (admins always pass) */
  perm?: string;
  headerClassName?: string;
};

/** Catalog order = table column order. Defaults match the previous table + Admin Share. */
export const ADMIN_USERS_TABLE_COLUMNS: AdminUsersColumnDef[] = [
  { id: "name", label: "User", defaultVisible: true, perm: "col:users:name" },
  { id: "status", label: "Status", defaultVisible: true, perm: "col:users:status" },
  { id: "wallet", label: "Wallet", defaultVisible: true, perm: "col:users:wallet" },
  {
    id: "equity",
    label: "Equity (wallet + open P/L)",
    defaultVisible: true,
    perm: "col:users:equity",
  },
  {
    id: "live_pl",
    label: "Open P/L (unrealized)",
    defaultVisible: true,
    perm: "col:users:live_pl",
  },
  { id: "admin_share", label: "Admin Share", defaultVisible: true },
  { id: "kyc", label: "KYC", defaultVisible: true, perm: "col:users:kyc" },
  { id: "email", label: "Email", defaultVisible: false },
  { id: "mobile", label: "Mobile", defaultVisible: false },
  { id: "telegram", label: "Telegram", defaultVisible: false },
  { id: "joined", label: "Joined", defaultVisible: false },
  { id: "package", label: "Package", defaultVisible: false },
  { id: "referrer", label: "Referred by", defaultVisible: false },
  { id: "risk", label: "Risk", defaultVisible: false },
  { id: "label", label: "Label", defaultVisible: false },
  { id: "tags", label: "Tags", defaultVisible: false },
  { id: "deposit_baseline", label: "Deposit baseline", defaultVisible: true },
  { id: "open_positions", label: "Open positions", defaultVisible: false },
  { id: "withdrawable", label: "Withdrawable", defaultVisible: false },
  { id: "equity_pl", label: "P/L vs baseline", defaultVisible: false },
  { id: "country", label: "Country", defaultVisible: false },
  { id: "experience", label: "Experience", defaultVisible: false },
  { id: "profit_pct", label: "Profit %", defaultVisible: false },
  { id: "fee_lot", label: "Fee / lot", defaultVisible: false },
  { id: "recharge_total", label: "Recharge total", defaultVisible: false },
  { id: "trading", label: "Trade status", defaultVisible: false },
];

export type AdminUsersColumnVisibility = Record<AdminUsersColumnId, boolean>;

export function defaultAdminUsersColumnVisibility(): AdminUsersColumnVisibility {
  return Object.fromEntries(
    ADMIN_USERS_TABLE_COLUMNS.map((c) => [c.id, c.defaultVisible]),
  ) as AdminUsersColumnVisibility;
}

export function loadAdminUsersColumnVisibility(): AdminUsersColumnVisibility {
  const defaults = defaultAdminUsersColumnVisibility();
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(ADMIN_USERS_COLUMNS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return defaults;
    const next = { ...defaults };
    for (const col of ADMIN_USERS_TABLE_COLUMNS) {
      if (typeof parsed[col.id] === "boolean") {
        next[col.id] = parsed[col.id] as boolean;
      }
    }
    return next;
  } catch {
    return defaults;
  }
}

export function saveAdminUsersColumnVisibility(visibility: AdminUsersColumnVisibility): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ADMIN_USERS_COLUMNS_STORAGE_KEY, JSON.stringify(visibility));
  } catch {
    // ignore quota / private mode
  }
}

/** Estimated admin share on open assignments for one user (frontend-only). */
export function sumOpenAdminShareUsd(rows: AdminOpenAssignRow[] | undefined): number {
  if (!rows?.length) return 0;
  let sum = 0;
  for (const r of rows) {
    if (isTradeClosed(r)) continue;
    const ticket = String(r.ticket_id ?? "");
    sum += resolveRowAdminUserPl(r, ticket).adminShare;
  }
  return Math.round(sum * 100) / 100;
}

export function fmtUsdCell(value: number | null | undefined, empty = "—"): string {
  if (value == null || !Number.isFinite(value)) return empty;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
