import type { RiskId } from "@/constants/riskProfiles";
import { VALID_RISK_IDS } from "@/constants/riskProfiles";

export const ADMIN_USERS_DEFAULT_PAGE_SIZE = 10;
export const ADMIN_USERS_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export type AdminUsersSortMode =
  | "wallet_high"
  | "wallet_low"
  | "joined_new"
  | "joined_old"
  | "trading_wallet_high"
  | "safe_wallet_high"
  | "assignments_high";

/** Default sort on first visit (no `sort` query param). */
export const ADMIN_USERS_INITIAL_SORT: AdminUsersSortMode = "assignments_high";

export type AdminUsersOpenTradesFilter = "all" | "with_open";

/** Default: sort users with open trades to the top (does not hide anyone). */
export const ADMIN_USERS_INITIAL_OPEN_TRADES: AdminUsersOpenTradesFilter = "with_open";

/** Default package filter on first visit (no `pkg` query param). */
export const ADMIN_USERS_INITIAL_PACKAGES = ["active"] as const;

export type AdminUsersUrlState = {
  filterSelectedUserIds: string[];
  filterEmail: string;
  filterUserId: string;
  filterKyc: string;
  filterOnline: "all" | "live";
  filterWallet: "all" | "with_balance" | "empty";
  filterPackages: string[];
  filterTrading: "all" | "active" | "stopped";
  filterOpenPl: "all" | "profit" | "loss";
  filterOpenTrades: AdminUsersOpenTradesFilter;
  filterReferrer: string;
  filterTag: string;
  filterRisks: Array<"none" | RiskId>;
  filterJoinFrom: string;
  filterJoinTo: string;
  userSort: AdminUsersSortMode;
  page: number;
  pageSize: number;
};

const SORT_MODES = new Set<AdminUsersSortMode>([
  "wallet_high",
  "wallet_low",
  "joined_new",
  "joined_old",
  "trading_wallet_high",
  "safe_wallet_high",
  "assignments_high",
]);

const RISK_IDS = new Set<RiskId>(VALID_RISK_IDS);

export function defaultAdminUsersUrlState(): AdminUsersUrlState {
  return {
    filterSelectedUserIds: [],
    filterEmail: "",
    filterUserId: "",
    filterKyc: "all",
    filterOnline: "all",
    filterWallet: "all",
    filterPackages: [...ADMIN_USERS_INITIAL_PACKAGES],
    filterTrading: "all",
    filterOpenPl: "all",
    filterOpenTrades: "all",
    filterReferrer: "all",
    filterTag: "all",
    filterRisks: [],
    filterJoinFrom: "",
    filterJoinTo: "",
    userSort: "wallet_high",
    page: 1,
    pageSize: ADMIN_USERS_DEFAULT_PAGE_SIZE,
  };
}

function parseCsv(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseRisks(raw: string | null): Array<"none" | RiskId> {
  const out: Array<"none" | RiskId> = [];
  for (const part of parseCsv(raw)) {
    if (part === "none") out.push("none");
    else if (RISK_IDS.has(part as RiskId)) out.push(part as RiskId);
  }
  return out;
}

export function parseAdminUsersUrlState(params: URLSearchParams): AdminUsersUrlState {
  const defaults = defaultAdminUsersUrlState();
  const page = Math.max(1, Number.parseInt(params.get("page") || "1", 10) || 1);
  const pageSizeRaw = Number(params.get("pageSize"));
  const pageSize = ADMIN_USERS_PAGE_SIZE_OPTIONS.includes(
    pageSizeRaw as (typeof ADMIN_USERS_PAGE_SIZE_OPTIONS)[number],
  )
    ? pageSizeRaw
    : defaults.pageSize;

  const onlineRaw = params.get("online");
  const filterOnline: AdminUsersUrlState["filterOnline"] =
    onlineRaw === "live" ? "live" : "all";

  const walletRaw = params.get("wallet");
  const filterWallet: AdminUsersUrlState["filterWallet"] =
    walletRaw === "with_balance" || walletRaw === "empty" ? walletRaw : "all";

  const tradingRaw = params.get("trading");
  const filterTrading: AdminUsersUrlState["filterTrading"] =
    tradingRaw === "active" || tradingRaw === "stopped" ? tradingRaw : "all";

  const openPlRaw = params.get("openPl");
  const filterOpenPl: AdminUsersUrlState["filterOpenPl"] =
    openPlRaw === "profit" || openPlRaw === "loss" ? openPlRaw : "all";

  const sortRaw = params.has("sort") ? params.get("sort") : ADMIN_USERS_INITIAL_SORT;
  const userSort: AdminUsersSortMode = SORT_MODES.has(sortRaw as AdminUsersSortMode)
    ? (sortRaw as AdminUsersSortMode)
    : ADMIN_USERS_INITIAL_SORT;

  const openTradesRaw = params.has("openTrades") ? params.get("openTrades") : null;
  const filterOpenTrades: AdminUsersOpenTradesFilter =
    openTradesRaw === "all" ? "all" : openTradesRaw === "with_open" ? "with_open" : ADMIN_USERS_INITIAL_OPEN_TRADES;

  const filterUserId = (params.get("userId") || "").replace(/[^\d]/g, "");

  const filterPackages = !params.has("pkg")
    ? [...ADMIN_USERS_INITIAL_PACKAGES]
    : params.get("pkg") === "_none"
      ? []
      : parseCsv(params.get("pkg"));

  return {
    filterSelectedUserIds: parseCsv(params.get("names")),
    filterEmail: params.get("email") || "",
    filterUserId,
    filterKyc: params.get("kyc") || defaults.filterKyc,
    filterOnline,
    filterWallet,
    filterPackages,
    filterTrading,
    filterOpenPl,
    filterOpenTrades,
    filterReferrer: params.get("referrer") || defaults.filterReferrer,
    filterTag: params.get("tag") || defaults.filterTag,
    filterRisks: parseRisks(params.get("risks")),
    filterJoinFrom: params.get("joinFrom") || "",
    filterJoinTo: params.get("joinTo") || "",
    userSort,
    page,
    pageSize,
  };
}

export function serializeAdminUsersUrlState(state: AdminUsersUrlState): URLSearchParams {
  const defaults = defaultAdminUsersUrlState();
  const params = new URLSearchParams();

  if (state.filterSelectedUserIds.length) {
    params.set("names", state.filterSelectedUserIds.join(","));
  }
  if (state.filterEmail.trim()) params.set("email", state.filterEmail.trim());
  if (state.filterUserId.trim()) params.set("userId", state.filterUserId.trim());
  if (state.filterKyc !== defaults.filterKyc) params.set("kyc", state.filterKyc);
  if (state.filterOnline !== defaults.filterOnline) params.set("online", state.filterOnline);
  if (state.filterWallet !== defaults.filterWallet) params.set("wallet", state.filterWallet);
  if (state.filterPackages.length === 0) {
    params.set("pkg", "_none");
  } else {
    const pkgJoined = state.filterPackages.join(",");
    if (pkgJoined === ADMIN_USERS_INITIAL_PACKAGES.join(",")) {
      params.set("pkg", "active");
    } else {
      params.set("pkg", pkgJoined);
    }
  }
  if (state.filterTrading !== defaults.filterTrading) params.set("trading", state.filterTrading);
  if (state.filterOpenPl !== defaults.filterOpenPl) params.set("openPl", state.filterOpenPl);
  if (state.filterOpenTrades === "with_open") {
    params.set("openTrades", "with_open");
  } else {
    params.set("openTrades", "all");
  }
  if (state.filterReferrer !== defaults.filterReferrer) {
    params.set("referrer", state.filterReferrer);
  }
  if (state.filterTag !== defaults.filterTag) params.set("tag", state.filterTag);
  if (state.filterRisks.length) params.set("risks", state.filterRisks.join(","));
  if (state.filterJoinFrom) params.set("joinFrom", state.filterJoinFrom);
  if (state.filterJoinTo) params.set("joinTo", state.filterJoinTo);
  if (state.userSort !== defaults.userSort) params.set("sort", state.userSort);
  if (state.page > 1) params.set("page", String(state.page));
  if (state.pageSize !== defaults.pageSize) params.set("pageSize", String(state.pageSize));

  return params;
}

export const ADMIN_USERS_LIST_STATE_KEY = "tradeflow.admin.users.listState";

export function adminUsersListStateStorageKey(adminUserId?: number | string | null): string {
  const id = Number(adminUserId);
  if (id > 0) return `${ADMIN_USERS_LIST_STATE_KEY}.${id}`;
  return ADMIN_USERS_LIST_STATE_KEY;
}

/** Persisted list filters (query-string form) — survives refresh and navigation until admin changes them. */
export function loadAdminUsersListState(adminUserId?: number | string | null): AdminUsersUrlState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(adminUsersListStateStorageKey(adminUserId));
    if (!raw?.trim()) return null;
    const qs = raw.startsWith("?") ? raw.slice(1) : raw;
    return parseAdminUsersUrlState(new URLSearchParams(qs));
  } catch {
    return null;
  }
}

export function saveAdminUsersListState(
  state: AdminUsersUrlState,
  adminUserId?: number | string | null,
): void {
  if (typeof window === "undefined") return;
  try {
    const qs = serializeAdminUsersUrlState(state).toString();
    window.localStorage.setItem(adminUsersListStateStorageKey(adminUserId), qs);
  } catch {
    // ignore quota / private mode
  }
}
