export const STATEMENT_BASELINE_COLUMNS_STORAGE_KEY =
  "tradeflow.admin.statement.baselineColumns.v1";
export const STATEMENT_ENTRIES_COLUMNS_STORAGE_KEY =
  "tradeflow.admin.statement.entriesColumns.v1";
export const STATEMENT_TRADING_COLUMNS_STORAGE_KEY =
  "tradeflow.admin.statement.tradingColumns.v1";

export type StatementBaselineColumnId = "from" | "to" | "baseline" | "reason";
export type StatementEntriesColumnId =
  | "date"
  | "entry"
  | "amount"
  | "capital"
  | "from_profit"
  | "withdrawn"
  | "cash";
export type StatementTradingColumnId =
  | "settled"
  | "ticket"
  | "symbol"
  | "user_share"
  | "admin_share"
  | "master_profit"
  | "status"
  | "note";

export type StatementColumnDef<T extends string> = {
  id: T;
  label: string;
  defaultVisible: boolean;
  headerClassName?: string;
};

export const STATEMENT_BASELINE_COLUMNS: StatementColumnDef<StatementBaselineColumnId>[] = [
  { id: "from", label: "From", defaultVisible: true },
  { id: "to", label: "To", defaultVisible: true },
  { id: "baseline", label: "Baseline", defaultVisible: true, headerClassName: "text-right" },
  { id: "reason", label: "Why it changed", defaultVisible: true },
];

export const STATEMENT_ENTRIES_COLUMNS: StatementColumnDef<StatementEntriesColumnId>[] = [
  { id: "date", label: "Date", defaultVisible: true },
  { id: "entry", label: "Entry", defaultVisible: true },
  { id: "amount", label: "Amount", defaultVisible: true, headerClassName: "text-right" },
  { id: "capital", label: "Capital", defaultVisible: true, headerClassName: "text-right" },
  { id: "from_profit", label: "From profit", defaultVisible: false, headerClassName: "text-right" },
  { id: "withdrawn", label: "Withdrawn", defaultVisible: false, headerClassName: "text-right" },
  { id: "cash", label: "Cash (running)", defaultVisible: false, headerClassName: "text-right" },
];

export const STATEMENT_TRADING_COLUMNS: StatementColumnDef<StatementTradingColumnId>[] = [
  { id: "settled", label: "Settled", defaultVisible: true },
  { id: "ticket", label: "Ticket", defaultVisible: true },
  { id: "symbol", label: "Symbol", defaultVisible: false },
  { id: "user_share", label: "User share", defaultVisible: true, headerClassName: "text-right" },
  { id: "admin_share", label: "Admin share", defaultVisible: true, headerClassName: "text-right" },
  {
    id: "master_profit",
    label: "Master P/L",
    defaultVisible: false,
    headerClassName: "text-right",
  },
  { id: "status", label: "Status", defaultVisible: false },
  { id: "note", label: "Note", defaultVisible: false },
];

export type StatementColumnVisibility<T extends string> = Record<T, boolean>;

export function defaultStatementColumnVisibility<T extends string>(
  columns: StatementColumnDef<T>[],
): StatementColumnVisibility<T> {
  return Object.fromEntries(columns.map((c) => [c.id, c.defaultVisible])) as StatementColumnVisibility<T>;
}

export function loadStatementColumnVisibility<T extends string>(
  storageKey: string,
  columns: StatementColumnDef<T>[],
): StatementColumnVisibility<T> {
  const defaults = defaultStatementColumnVisibility(columns);
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return defaults;
    const next = { ...defaults };
    for (const col of columns) {
      if (typeof parsed[col.id] === "boolean") {
        next[col.id] = parsed[col.id] as boolean;
      }
    }
    return next;
  } catch {
    return defaults;
  }
}

export function saveStatementColumnVisibility<T extends string>(
  storageKey: string,
  visibility: StatementColumnVisibility<T>,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(visibility));
  } catch {
    // ignore quota / private mode
  }
}
