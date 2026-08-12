import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  RefreshCw,
  UserPlus,
  ChevronDown,
  Download,
  PauseCircle,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

import EditUserModal from '../components/admin/EditUserModal';
import AddUserModal from '../components/admin/AddUserModal';
import WalletModal from '../components/admin/WalletModal';
import AdminVoicePanel from '../components/admin/AdminVoicePanel';
import UserDetailDialog from '../components/admin/UserDetailDialog';
import ExtendSubscriptionModal from '../components/admin/ExtendSubscriptionModal';
import { FilterCheckboxDropdown } from '../components/admin/FilterCheckboxDropdown';
import { AdminUserTradesLink } from '../components/admin/AdminUserTradesLink';
import { AdminUsersColumnPicker } from '../components/admin/AdminUsersColumnPicker';
import { MaskedPii, useAdminPiiReveal, piiDisplay } from '../components/admin/AdminPiiReveal';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useApp } from "@/context/AppContext";
import { API_BASE, SOCKET_URL } from "@/config/api";
import { beginAdminImpersonation } from "@/utils/adminImpersonation";
import { SUBSCRIPTION_PACKAGES, packageDisplayName } from "@/constants/packages";
import { RISK_PROFILES, type RiskId } from "@/constants/riskProfiles";
import { parseUserRiskIds } from "@/utils/userRiskProfile";
import {
  buildFinanceOverlay,
  groupOpenRowsByUser,
  type AdminFinanceOverlay,
  type AdminOpenAssignRow,
} from "@/utils/adminLiveFinance";
import type { UserTradeRowLike } from "@/utils/userTradePl";

const adminSocket = io(SOCKET_URL, { transports: ["websocket"] });
import {
  formatAdminDate,
  kycBadgeStyles,
  lastSeenLabel,
  parseCoord,
  parseUserJoinMs,
  compareUsersByJoin,
  referrerDisplayLabel,
  renderRiskBadges,
  walletBalanceOf,
} from "@/utils/adminUserDisplay";
import { endOfDayMs, startOfDayMs } from "@/utils/mt5TradeDates";
import { useClientPagination } from "@/hooks/useClientPagination";
import { ListPaginationBar } from "@/components/trades/TradesPaginationBar";
import { useEmployeeAccess } from "@/hooks/useEmployeeAccess";
import { exportUsersToExcel } from "@/utils/exportUsersExcel";
import { EmployeeGate } from "@/components/auth/EmployeeGate";
import { fetchAllUsedTags, parseUserLabels, tagColorClass } from "@/utils/adminUserLabels";
import { markAdminUsersSeen } from "@/utils/adminSidebarSeen";
import {
  fetchReferrerByUserIdMap,
  mergeUserReferrerFields,
} from "@/utils/adminReferrerEnrichment";
import {
  ADMIN_USERS_TABLE_COLUMNS,
  fmtUsdCell,
  loadAdminUsersColumnVisibility,
  saveAdminUsersColumnVisibility,
  sumOpenAdminShareUsd,
  type AdminUsersColumnId,
  type AdminUsersColumnVisibility,
} from "@/utils/adminUsersTableColumns";
import { useAdminUsersFiltersCollapsed } from "@/utils/adminUsersFiltersCollapsed";
import { withAdminReturn } from "@/utils/adminNavigation";
import {
  ADMIN_USERS_DEFAULT_PAGE_SIZE,
  ADMIN_USERS_PAGE_SIZE_OPTIONS,
  defaultAdminUsersUrlState,
  parseAdminUsersUrlState,
  serializeAdminUsersUrlState,
  type AdminUsersSortMode,
  type AdminUsersUrlState,
} from "@/utils/adminUsersListUrlState";

const USER_PAGE_SIZE_OPTIONS = ADMIN_USERS_PAGE_SIZE_OPTIONS;
const DEFAULT_USER_PAGE_SIZE = ADMIN_USERS_DEFAULT_PAGE_SIZE;

type UserSortMode = AdminUsersSortMode;

const WALLET_COLUMN_SORT_MIN_USD = 0.02;

function tradingWalletUsd(loc: {
  trading_wallet_usd?: unknown;
  wallet_balance?: unknown;
}): number {
  return Number(loc.trading_wallet_usd ?? loc.wallet_balance ?? 0);
}

function safeWalletUsd(loc: { safe_wallet_usd?: unknown }): number {
  return Number(loc.safe_wallet_usd ?? 0);
}

/** Paid packs matched by the Package filter "Active plan" shortcut. */
const ACTIVE_PLAN_PACKAGE_IDS = new Set(
  SUBSCRIPTION_PACKAGES.filter((pkg) => !pkg.isTrial).map((pkg) => pkg.id),
);

const ADMIN_OVERRIDE_PACKAGE_ID = "admin-override";

/** Default: show users without an active paid plan (hide active + admin override). */
const DEFAULT_FILTER_PACKAGES: string[] = [];

function isDefaultPackageFilter(packages: string[]): boolean {
  return packages.length === 0;
}

function userHasActivePaidOrOverridePlan(loc: {
  active_package_id?: unknown;
}): boolean {
  const activePkg = String(loc.active_package_id ?? "").trim();
  if (!activePkg) return false;
  return ACTIVE_PLAN_PACKAGE_IDS.has(activePkg) || activePkg === ADMIN_OVERRIDE_PACKAGE_ID;
}

/** Whole days remaining until a package end date (null if no/invalid date). */
function daysLeftUntil(value: unknown): number | null {
  if (!value) return null;
  const end = new Date(String(value)).getTime();
  if (Number.isNaN(end)) return null;
  return Math.ceil((end - Date.now()) / (1000 * 60 * 60 * 24));
}

function isTradeActive(loc: { trading_active?: unknown }): boolean {
  return Number(loc.trading_active ?? 1) !== 0;
}

function rowLivePl(
  loc: { id?: unknown; live_pl?: unknown },
  overlay: Record<number, AdminFinanceOverlay>,
): number {
  const uid = Number(loc.id);
  if (uid && overlay[uid]?.live_pl != null) return Number(overlay[uid].live_pl);
  return Number(loc.live_pl ?? 0);
}

function rowEquity(
  loc: { id?: unknown; wallet_balance?: unknown; equity?: unknown },
  overlay: Record<number, AdminFinanceOverlay>,
): number {
  const uid = Number(loc.id);
  const wallet = Number(loc.wallet_balance ?? 0);
  if (uid && overlay[uid]?.equity != null) return Number(overlay[uid].equity);
  return Number(loc.equity ?? wallet);
}

/** Equity minus deposit baseline — same basis as admin P/L report. */
function rowPlVsBaseline(
  loc: {
    id?: unknown;
    wallet_balance?: unknown;
    equity?: unknown;
    deposit_baseline?: unknown;
    equity_pl?: unknown;
  },
  overlay: Record<number, AdminFinanceOverlay>,
): number {
  const fromApi = Number(loc.equity_pl);
  if (Number.isFinite(fromApi) && loc.equity_pl != null && loc.equity_pl !== "") {
    return fromApi;
  }
  const baseline = Number(loc.deposit_baseline ?? 0);
  const equity = rowEquity(loc, overlay);
  return Math.round((equity - baseline) * 100) / 100;
}

function userPackageExpired(loc: { active_package_id?: unknown; package_expired?: unknown; last_package_end_at?: unknown }): boolean {
  if (loc.package_expired === true || loc.package_expired === 1 || loc.package_expired === "1") {
    return true;
  }
  const activePkg = String(loc.active_package_id ?? "").trim();
  if (activePkg) return false;
  const lastEnd = loc.last_package_end_at;
  if (!lastEnd) return false;
  const endMs = new Date(String(lastEnd)).getTime();
  return Number.isFinite(endMs) && endMs <= Date.now();
}

/** Tailwind classes for the days-left pill based on urgency. */
function daysLeftBadgeClass(days: number): string {
  if (days <= 0) return "border-red-200 bg-red-100 text-red-700";
  if (days <= 3) return "border-red-200 bg-red-50 text-red-700";
  if (days <= 7) return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

const AdminPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const listState = useMemo(() => parseAdminUsersUrlState(searchParams), [searchParams]);
  const {
    filterSelectedUserIds,
    filterEmail,
    filterUserId,
    filterKyc,
    filterOnline,
    filterWallet,
    filterPackages,
    filterTrading,
    filterOpenPl,
    filterReferrer,
    filterTag,
    filterRisks,
    filterJoinFrom,
    filterJoinTo,
    userSort,
    page: userPage,
    pageSize: userPageSize,
  } = listState;

  const patchListState = useCallback(
    (patch: Partial<AdminUsersUrlState>, opts?: { resetPage?: boolean }) => {
      const next = { ...listState, ...patch };
      if (opts?.resetPage) next.page = 1;
      const nextParams = serializeAdminUsersUrlState(next);
      if (nextParams.toString() !== searchParams.toString()) {
        setSearchParams(nextParams, { replace: true });
      }
    },
    [listState, searchParams, setSearchParams],
  );

  const [locations, setLocations] = useState<any[]>([]);
  const [totals, setTotals] = useState<{
    sum_trading_wallet_usd: number;
    sum_safe_wallet_usd: number;
    sum_total_withdraw_usd: number;
  } | null>(null);
  const [liveCount, setLiveCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [labelsVersion, setLabelsVersion] = useState(0);

  const [allTags, setAllTags] = useState<string[]>([]);
  const [openRowsByUser, setOpenRowsByUser] = useState<Record<number, UserTradeRowLike[]>>({});
  const [financeOverlay, setFinanceOverlay] = useState<Record<number, AdminFinanceOverlay>>({});
  const [columnVisibility, setColumnVisibility] = useState<AdminUsersColumnVisibility>(() =>
    loadAdminUsersColumnVisibility(),
  );

  const { currentUser, setCurrentUser } = useApp();
  const { can, isAdmin } = useEmployeeAccess();
  const { filtersCollapsed } = useAdminUsersFiltersCollapsed();
  const { revealed: piiRevealed } = useAdminPiiReveal();

  const canShowColumn = useCallback(
    (id: AdminUsersColumnId) => {
      const def = ADMIN_USERS_TABLE_COLUMNS.find((c) => c.id === id);
      if (!def) return false;
      if (def.perm && !can(def.perm)) return false;
      return true;
    },
    [can],
  );

  const showCol = useCallback(
    (id: AdminUsersColumnId) => canShowColumn(id) && columnVisibility[id] === true,
    [canShowColumn, columnVisibility],
  );

  const handleColumnVisibilityChange = useCallback((next: AdminUsersColumnVisibility) => {
    setColumnVisibility(next);
    saveAdminUsersColumnVisibility(next);
  }, []);
  const isVoiceAdmin = can("action:users:voice");
  const adminListenerId = Number(currentUser?.userId);
  const [voiceUser, setVoiceUser] = useState<any>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [walletUser, setWalletUser] = useState<any>(null);
  const toggleWalletColumnSort = useCallback((mode: "trading_wallet_high" | "safe_wallet_high") => {
    patchListState(
      { userSort: userSort === mode ? "wallet_high" : mode },
      { resetPage: true },
    );
  }, [patchListState, userSort]);
  const [walletBalance, setWalletBalance] = useState<number | string>("");
  const [isWalletLoading, setIsWalletLoading] = useState(false);

  const [detailUser, setDetailUser] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const [extendUser, setExtendUser] = useState<{ id: number; name?: string; email?: string } | null>(null);
  const [isExtendOpen, setIsExtendOpen] = useState(false);

  const { toast } = useToast();

  const tableTopRef = useRef<HTMLDivElement>(null);
  const prevUserCountRef = useRef(0);

  const handleMagicLogin = useCallback(
    async (loc: Record<string, unknown>) => {
      const targetId = Number(loc.id);
      const adminId = Number(currentUser?.userId);
      if (!isAdmin || !adminId || !targetId) {
        toast({
          title: "Magic login unavailable",
          description: "Only admins can open a user account this way.",
          variant: "destructive",
        });
        return;
      }
      if (!currentUser) return;
      try {
        const res = await fetch(`${API_BASE}/admin/impersonate/${targetId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ adminUserId: adminId }),
        });
        const data = await res.json();
        if (!data?.success || !data?.user?.userId) {
          throw new Error(data?.error || "Could not start magic login");
        }
        const next = beginAdminImpersonation(currentUser, {
          userId: String(data.user.userId),
          name: data.user.name ?? undefined,
          email: data.user.email ?? undefined,
          telegram: data.user.telegram ?? undefined,
          role: "user",
          createdAt: data.user.createdAt,
        });
        setCurrentUser(next);
        toast({
          title: "Viewing as user",
          description: "Location will not be updated. Use Back to admin when done.",
        });
        navigate("/user/dashboard");
      } catch (err) {
        toast({
          title: "Magic login failed",
          description: err instanceof Error ? err.message : "Could not open user account",
          variant: "destructive",
        });
      }
    },
    [currentUser, isAdmin, navigate, setCurrentUser, toast],
  );

  const fetchOpenAssignments = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/open-assignments`);
      const data = await response.json();
      if (data.success && Array.isArray(data.assignments)) {
        setOpenRowsByUser(groupOpenRowsByUser(data.assignments as AdminOpenAssignRow[]));
      }
    } catch {
      // best-effort — table still shows polled wallet/live_pl
    }
  }, []);

  const fetchLocations = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) setIsLoading(true);
    setError('');

    try {
      const [usersRes, referrerMap] = await Promise.all([
        fetch(`${API_BASE}/admin/users?finance=1`),
        fetchReferrerByUserIdMap(),
      ]);
      const data = await usersRes.json();
      if (data.success) {
        const users = mergeUserReferrerFields(data.users ?? [], referrerMap);
        setLocations(users);
        setLiveCount(Number(data.live_count ?? data.totals?.live_users ?? 0));
        if (data.totals) {
          setTotals({
            sum_trading_wallet_usd: Number(
              data.totals.sum_trading_wallet_usd ?? data.totals.sum_wallet_balances_usd ?? 0,
            ),
            sum_safe_wallet_usd: Number(data.totals.sum_safe_wallet_usd ?? 0),
            sum_total_withdraw_usd: Number(data.totals.sum_total_withdraw_usd ?? 0),
          });
        } else {
          setTotals(null);
        }
      } else {
        if (!silent) setError(data.error || 'Failed to fetch data.');
      }
    } catch (err) {
      if (!silent) setError('Server connection error.');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    markAdminUsersSeen();
  }, []);

  useEffect(() => {
    void fetchLocations();
    void fetchOpenAssignments();
    const usersPoll = window.setInterval(() => void fetchLocations({ silent: true }), 10_000);
    const openPoll = window.setInterval(() => void fetchOpenAssignments(), 60_000);
    return () => {
      window.clearInterval(usersPoll);
      window.clearInterval(openPoll);
    };
  }, [fetchLocations, fetchOpenAssignments]);

  useEffect(() => {
    const onNewUser = () => {
      patchListState({ userSort: "joined_new" }, { resetPage: true });
      void fetchLocations({ silent: true });
    };
    window.addEventListener("admin-new-user-registered", onNewUser);
    return () => window.removeEventListener("admin-new-user-registered", onNewUser);
  }, [fetchLocations, patchListState]);

  useEffect(() => {
    const prev = prevUserCountRef.current;
    const next = locations.length;
    if (next > prev && userSort === "joined_new") {
      requestAnimationFrame(() => {
        tableTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    prevUserCountRef.current = next;
  }, [locations.length, userSort]);

  useEffect(() => {
    const overlay: Record<number, AdminFinanceOverlay> = {};
    for (const loc of locations) {
      const uid = Number(loc.id);
      if (!uid) continue;
      const wallet = Number(loc.wallet_balance ?? 0);
      const baseline = Number(loc.deposit_baseline ?? 0);
      const rows = openRowsByUser[uid] ?? [];
      overlay[uid] = buildFinanceOverlay(
        wallet,
        baseline,
        rows,
        Number(loc.live_pl ?? 0),
      );
    }
    setFinanceOverlay(overlay);
  }, [locations, openRowsByUser]);

  useEffect(() => {
    const applyLive = (payload: { ticket?: unknown; profit?: unknown }) => {
      const ticket = String(payload.ticket ?? "");
      const raw = Number(payload.profit);
      if (!ticket || !Number.isFinite(raw)) return;

      setOpenRowsByUser((prev) => {
        let any = false;
        const next: Record<number, UserTradeRowLike[]> = { ...prev };
        for (const [uidKey, rows] of Object.entries(prev)) {
          let userTouched = false;
          const updated = rows.map((r) => {
            if (String(r.ticket_id ?? "") !== ticket) return r;
            userTouched = true;
            return { ...r, mt5_total_profit: raw };
          });
          if (userTouched) {
            any = true;
            next[Number(uidKey)] = updated;
          }
        }
        return any ? next : prev;
      });
    };

    const onLive = (payload: { ticket?: unknown; profit?: unknown }) => applyLive(payload);
    adminSocket.on("mt5live", onLive);
    adminSocket.on("mt5data", onLive);
    return () => {
      adminSocket.off("mt5live", onLive);
      adminSocket.off("mt5data", onLive);
    };
  }, []);

  const refreshTags = async () => {
    const tags = await fetchAllUsedTags();
    setAllTags(tags);
  };

  useEffect(() => {
    void refreshTags();
  }, [labelsVersion]);

  const openUserLocationOnMap = (loc: Record<string, unknown>) => {
    const lat = parseCoord(loc.latitude);
    const lng = parseCoord(loc.longitude);
    if (lat != null && lng != null) {
      window.open(
        `https://www.google.com/maps?q=${lat},${lng}&z=16`,
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }
    const addr = loc.address != null ? String(loc.address).trim() : "";
    if (addr) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`,
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }
    toast({
      title: "No location",
      description: "This user has no coordinates or address on file.",
      variant: "destructive",
    });
  };

  const handleAddUser = async (newUser: any) => {
    try {
      const res = await fetch(`${API_BASE}/admin/add-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });

      const data = await res.json();
      if (data.success) {
        setIsAddModalOpen(false);
        fetchLocations();
        toast({ title: "User Added ✅", description: "New user created successfully" });
      } else {
        toast({ title: "Add Failed ❌", description: data.error || "Failed to add user" });
      }
    } catch (err) {
      toast({ title: "Add Failed ❌", description: "Something went wrong" });
    }
  };

  const handleUpdate = async (updatedUser: any) => {
    try {
      if (!updatedUser?.id) return alert("User ID missing ❌");
      const payload: any = {};
      const allowedFields = [
        "password", "email", "photo", "name", "mobile", "telegram",
        "country", "state", "city", "pincode", "profit_percentage", "dollar_amount"
      ];

      allowedFields.forEach((field) => {
        if (updatedUser[field] !== undefined) payload[field] = updatedUser[field];
      });

      const res = await fetch(`${API_BASE}/admin/update-user/${updatedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        fetchLocations();
        toast({ title: "User Updated ✅", description: "Changes applied successfully" });
      } else {
        toast({ title: "Update Failed ❌", description: data.error || "Update failed" });
      }
    } catch (err) {
      toast({ title: "Update Failed ❌", description: "Something went wrong" });
    }
  };

  const handleOpenWalletModal = async (user: any) => {
    setWalletUser(user);
    setIsWalletModalOpen(true);
    setIsWalletLoading(true);

    try {
      const res = await fetch(`${API_BASE}/admin/wallet/${user.id}`);
      const data = await res.json();

      if (data.success && data.wallet) {
        setWalletBalance(data.wallet.balance);
      } else {
        setWalletBalance("");
      }
    } catch (err) {
      console.error("Fetch Wallet Error:", err);
      setWalletBalance("");
    } finally {
      setIsWalletLoading(false);
    }
  };

  const handleUpdateWallet = async (newBalance: string) => {
    try {
      const res = await fetch(`${API_BASE}/admin/wallet/${walletUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ balance: newBalance }),
      });

      const data = await res.json();

      if (data.success) {
        const baselineNote =
          data.deposit_baseline_usd != null
            ? ` · Deposit baseline $${Number(data.deposit_baseline_usd).toFixed(2)}`
            : "";
        toast({
          title: "Wallet Updated ✅",
          description: `Balance set to $${data.newBalance}${baselineNote}`,
        });
        setIsWalletModalOpen(false);
        fetchLocations();
      } else {
        toast({ title: "Update Failed ❌", description: data.error || "Failed to update wallet" });
      }
    } catch (err) {
      toast({ title: "Update Failed ❌", description: "Something went wrong" });
    }
  };

  const openDetail = (user: any) => {
    setDetailUser(user);
    setIsDetailOpen(true);
  };

  const handleLabelsUpdated = () => {
    setLabelsVersion((v) => v + 1);
    fetchLocations({ silent: true });
  };

  const toggleFilterPackage = useCallback((value: string) => {
    const next = filterPackages.includes(value)
      ? filterPackages.filter((v) => v !== value)
      : [...filterPackages, value];
    patchListState({ filterPackages: next }, { resetPage: true });
  }, [filterPackages, patchListState]);

  const toggleFilterRisk = useCallback((value: 'none' | RiskId) => {
    const next = filterRisks.includes(value)
      ? filterRisks.filter((v) => v !== value)
      : [...filterRisks, value];
    patchListState({ filterRisks: next }, { resetPage: true });
  }, [filterRisks, patchListState]);

  const toggleFilterUser = useCallback((value: string) => {
    const next = filterSelectedUserIds.includes(value)
      ? filterSelectedUserIds.filter((v) => v !== value)
      : [...filterSelectedUserIds, value];
    patchListState({ filterSelectedUserIds: next }, { resetPage: true });
  }, [filterSelectedUserIds, patchListState]);

  const userNameFilterOptions = useMemo(() => {
    return [...locations]
      .map((loc) => {
        const id = String(loc.id ?? "");
        const nameRaw = String(loc.name || "").trim() || `User #${id}`;
        const name = piiDisplay(nameRaw, "name", piiRevealed);
        return { value: id, label: `${name} (#${id})` };
      })
      .filter((opt) => opt.value)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [locations, piiRevealed]);

  const packageFilterOptions = useMemo(
    () => [
      { value: "none", label: "No active plan" },
      { value: "active", label: "Active plan (+ admin override)" },
      { value: "expired", label: "Expired plan" },
      ...SUBSCRIPTION_PACKAGES.map((pkg) => ({ value: pkg.id, label: pkg.name })),
    ],
    [],
  );

  const riskFilterOptions = useMemo(
    () => [
      { value: "none", label: "No risk set" },
      ...RISK_PROFILES.map((risk) => ({ value: risk.id, label: risk.title })),
    ],
    [],
  );

  const referrerFilterOptions = useMemo(() => {
    const byId = new Map<number, { id: number; label: string }>();
    for (const loc of locations) {
      const rid = Number(loc.referrer_id);
      if (!Number.isFinite(rid) || rid <= 0) continue;
      if (byId.has(rid)) continue;
      byId.set(rid, { id: rid, label: referrerDisplayLabel(loc) });
    }
    return Array.from(byId.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [locations]);

  const filteredLocations = useMemo(() => {
    const selectedUserIdSet = new Set(filterSelectedUserIds);
    const filtered = locations.filter((loc) => {
      const emailStr = String(loc.email || "").toLowerCase();

      const matchName =
        selectedUserIdSet.size === 0 || selectedUserIdSet.has(String(loc.id));
      const matchEmail = emailStr.includes(filterEmail.toLowerCase());
      const matchUserId =
        !filterUserId.trim() || String(loc.id) === filterUserId.trim();

      const currentKyc = String(loc.kyc_status ?? "pending").toLowerCase();
      const matchKyc = filterKyc === "all" || currentKyc === filterKyc;
      const matchOnline =
        filterOnline === "all" || Number(loc.is_online) === 1;

      let matchTag = true;
      if (filterTag !== "all") {
        const userTags = parseUserLabels(loc).tags;
        matchTag = userTags.includes(filterTag);
      }

      const userRisks = parseUserRiskIds(loc.risk);
      const matchRisk =
        filterRisks.length === 0 ||
        filterRisks.some((selected) =>
          selected === "none" ? userRisks.length === 0 : userRisks.includes(selected),
        );

      const bal = walletBalanceOf(loc);
      const matchWallet =
        filterWallet === "all" ||
        (filterWallet === "with_balance" && bal > 0.02) ||
        (filterWallet === "empty" && bal <= 0.02);

      const matchTradingWalletColumn =
        userSort !== "trading_wallet_high" ||
        tradingWalletUsd(loc) > WALLET_COLUMN_SORT_MIN_USD;
      const matchSafeWalletColumn =
        userSort !== "safe_wallet_high" || safeWalletUsd(loc) > WALLET_COLUMN_SORT_MIN_USD;

      const activePkg = String(loc.active_package_id ?? "").trim();
      const matchPackage =
        filterPackages.length === 0
          ? !userHasActivePaidOrOverridePlan(loc)
          : filterPackages.some((selected) => {
              if (selected === "none") return !activePkg;
              if (selected === "active") return userHasActivePaidOrOverridePlan(loc);
              if (selected === "expired") return userPackageExpired(loc);
              return activePkg === selected;
            });

      const copyActive = isTradeActive(loc);
      const matchTrading =
        filterTrading === "all" ||
        (filterTrading === "active" && copyActive) ||
        (filterTrading === "stopped" && !copyActive);

      const plVsBaseline = rowPlVsBaseline(loc, financeOverlay);
      const matchOpenPl =
        filterOpenPl === "all" ||
        (filterOpenPl === "profit" && plVsBaseline > 0.01) ||
        (filterOpenPl === "loss" && plVsBaseline < -0.01);

      const refId = Number(loc.referrer_id);
      const matchReferrer =
        filterReferrer === "all" ||
        (filterReferrer === "none" && (!Number.isFinite(refId) || refId <= 0)) ||
        refId === Number(filterReferrer);

      let matchJoinDate = true;
      if (filterJoinFrom || filterJoinTo) {
        const joinMs = parseUserJoinMs(loc.created_at);
        if (joinMs == null) {
          matchJoinDate = false;
        } else {
          if (filterJoinFrom && joinMs < startOfDayMs(filterJoinFrom)) matchJoinDate = false;
          if (filterJoinTo && joinMs > endOfDayMs(filterJoinTo)) matchJoinDate = false;
        }
      }

      return (
        matchName &&
        matchEmail &&
        matchUserId &&
        matchKyc &&
        matchOnline &&
        matchTag &&
        matchRisk &&
        matchWallet &&
        matchTradingWalletColumn &&
        matchSafeWalletColumn &&
        matchPackage &&
        matchTrading &&
        matchOpenPl &&
        matchReferrer &&
        matchJoinDate
      );
    });

    return filtered.sort((a, b) => {
      if (filterOpenPl === "profit") {
        const plDiff =
          rowPlVsBaseline(b, financeOverlay) - rowPlVsBaseline(a, financeOverlay);
        if (plDiff !== 0) return plDiff;
      } else if (filterOpenPl === "loss") {
        const plDiff =
          rowPlVsBaseline(a, financeOverlay) - rowPlVsBaseline(b, financeOverlay);
        if (plDiff !== 0) return plDiff;
      }

      if (userSort === "joined_new" || userSort === "joined_old") {
        return compareUsersByJoin(a, b, userSort);
      }

      if (userSort === "trading_wallet_high") {
        const diff = tradingWalletUsd(b) - tradingWalletUsd(a);
        if (diff !== 0) return diff;
        return Number(b.id) - Number(a.id);
      }

      if (userSort === "safe_wallet_high") {
        const diff = safeWalletUsd(b) - safeWalletUsd(a);
        if (diff !== 0) return diff;
        return Number(b.id) - Number(a.id);
      }

      const diff = walletBalanceOf(b) - walletBalanceOf(a);
      const primary = userSort === "wallet_high" ? diff : -diff;
      if (primary !== 0) return primary;
      return Number(b.id) - Number(a.id);
    });
  }, [
    locations,
    filterSelectedUserIds,
    filterEmail,
    filterUserId,
    filterKyc,
    filterOnline,
    filterWallet,
    filterPackages,
    filterTrading,
    filterOpenPl,
    filterReferrer,
    filterTag,
    filterRisks,
    filterJoinFrom,
    filterJoinTo,
    userSort,
    financeOverlay,
  ]);

  const totalUserCount = locations.length;
  const filteredUserCount = filteredLocations.length;
  const stoppedWithOpenPlCount = useMemo(
    () =>
      locations.filter((loc) => {
        if (isTradeActive(loc)) return false;
        const openPos = Number(loc.open_positions ?? 0);
        const livePl = Math.abs(Number(loc.live_pl ?? 0));
        return openPos > 0 || livePl > 0.01;
      }).length,
    [locations],
  );
  const stoppedTradingCount = useMemo(
    () => locations.filter((loc) => !isTradeActive(loc)).length,
    [locations],
  );
  const inProfitCount = useMemo(
    () =>
      locations.filter((loc) => rowPlVsBaseline(loc, financeOverlay) > 0.01).length,
    [locations, financeOverlay],
  );
  const inLossCount = useMemo(
    () =>
      locations.filter((loc) => rowPlVsBaseline(loc, financeOverlay) < -0.01).length,
    [locations, financeOverlay],
  );
  const hasActiveFilters = useMemo(
    () =>
      filterSelectedUserIds.length > 0 ||
      Boolean(filterEmail.trim()) ||
      Boolean(filterUserId.trim()) ||
      filterKyc !== "all" ||
      filterOnline !== "all" ||
      filterWallet !== "all" ||
      !isDefaultPackageFilter(filterPackages) ||
      filterTrading !== "all" ||
      filterOpenPl !== "all" ||
      filterReferrer !== "all" ||
      filterTag !== "all" ||
      filterRisks.length > 0 ||
      Boolean(filterJoinFrom) ||
      Boolean(filterJoinTo) ||
      userSort !== "wallet_high",
    [
      filterSelectedUserIds,
      filterEmail,
      filterUserId,
      filterKyc,
      filterOnline,
      filterWallet,
      filterPackages,
      filterTrading,
      filterOpenPl,
      filterReferrer,
      filterTag,
      filterRisks,
      filterJoinFrom,
      filterJoinTo,
      userSort,
    ],
  );

  const sortLabel = useMemo(() => {
    switch (userSort) {
      case "wallet_low":
        return "wallet balance (low → high)";
      case "joined_new":
        return "join date (newest first)";
      case "joined_old":
        return "join date (oldest first)";
      case "trading_wallet_high":
        return "trading wallet (high → low, hide $0)";
      case "safe_wallet_high":
        return "safe wallet (high → low, hide $0)";
      default:
        return "wallet balance (high → low)";
    }
  }, [userSort]);

  const handleExportExcel = () => {
    if (!isAdmin) return;
    if (!filteredLocations.length) {
      toast({
        title: "Nothing to export",
        description: "No users match the current filters.",
        variant: "destructive",
      });
      return;
    }
    try {
      exportUsersToExcel(filteredLocations, financeOverlay, {
        filenamePrefix: hasActiveFilters ? "tradeflow-users-filtered" : "tradeflow-users",
      });
      toast({
        title: "Excel downloaded",
        description: `${filteredLocations.length.toLocaleString()} user(s) exported.`,
      });
    } catch (err) {
      toast({
        title: "Export failed",
        description: err instanceof Error ? err.message : "Could not create Excel file.",
        variant: "destructive",
      });
    }
  };

  const {
    pageItems: pagedLocations,
    totalPages: userTotalPages,
    total: filteredUserTotal,
  } = useClientPagination(filteredLocations, userPageSize, {
    page: userPage,
    onPageChange: (p) => patchListState({ page: p }),
  });

  const visibleUserCols = useMemo(
    () => ADMIN_USERS_TABLE_COLUMNS.filter((c) => showCol(c.id)).length,
    [showCol],
  );

  return (
    <div className="w-full min-w-0 font-sans">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Users
            </h1>
            {!filtersCollapsed ? (
              <>
            <EmployeeGate perm="filter:users:online">
              <button
                type="button"
                onClick={() =>
                  patchListState(
                    { filterOnline: filterOnline === "live" ? "all" : "live" },
                    { resetPage: true },
                  )
                }
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition ${
                  filterOnline === "live"
                    ? "border-emerald-400 bg-emerald-100 text-emerald-900 ring-2 ring-emerald-200"
                    : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                }`}
                title="Click to show live users only (online within last 90s)"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                {liveCount} live
                {filterOnline === "live" ? " · filtered" : ""}
              </button>
            </EmployeeGate>
            {stoppedWithOpenPlCount > 0 && (
              <button
                type="button"
                onClick={() =>
                  patchListState(
                    { filterTrading: filterTrading === "stopped" ? "all" : "stopped" },
                    { resetPage: true },
                  )
                }
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition ${
                  filterTrading === "stopped"
                    ? "border-amber-400 bg-amber-100 text-amber-900 ring-2 ring-amber-200"
                    : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                }`}
                title="Trade stopped — click to show stopped users (with open P/L pinned near top)"
              >
                <PauseCircle className="h-3 w-3" />
                {stoppedWithOpenPlCount} trade stop
                {filterTrading === "stopped" ? " · filtered" : ""}
              </button>
            )}
            {stoppedTradingCount > stoppedWithOpenPlCount && filterTrading !== "stopped" && (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-medium text-slate-600">
                {stoppedTradingCount} stopped total
              </span>
            )}
            <EmployeeGate perm="filter:users:pnl">
              <button
                type="button"
                onClick={() =>
                  patchListState(
                    { filterOpenPl: filterOpenPl === "profit" ? "all" : "profit" },
                    { resetPage: true },
                  )
                }
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition ${
                  filterOpenPl === "profit"
                    ? "border-emerald-400 bg-emerald-100 text-emerald-900 ring-2 ring-emerald-200"
                    : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                }`}
                title="Equity above deposit baseline — click to filter"
              >
                <TrendingUp className="h-3 w-3" />
                {inProfitCount} above baseline
                {filterOpenPl === "profit" ? " · filtered" : ""}
              </button>
              <button
                type="button"
                onClick={() =>
                  patchListState(
                    { filterOpenPl: filterOpenPl === "loss" ? "all" : "loss" },
                    { resetPage: true },
                  )
                }
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition ${
                  filterOpenPl === "loss"
                    ? "border-red-400 bg-red-100 text-red-900 ring-2 ring-red-200"
                    : "border-red-200 bg-red-50 text-red-800 hover:bg-red-100"
                }`}
                title="Equity below deposit baseline — click to filter"
              >
                <TrendingDown className="h-3 w-3" />
                {inLossCount} below baseline
                {filterOpenPl === "loss" ? " · filtered" : ""}
              </button>
            </EmployeeGate>
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-700">
              {hasActiveFilters
                ? `${filteredUserCount.toLocaleString()} of ${totalUserCount.toLocaleString()} users`
                : `${totalUserCount.toLocaleString()} users`}
            </span>
              </>
            ) : null}
          </div>
          {!filtersCollapsed ? (
          <p className="mt-1 text-sm text-slate-600">
            Manage accounts, wallets, addresses &amp; KYC · sorted by {sortLabel}
            {filterOpenPl === "profit"
              ? " · above baseline (highest P/L first)"
              : filterOpenPl === "loss"
                ? " · below baseline (deepest loss first)"
                : null}
            {hasActiveFilters ? (
              <span className="font-medium text-slate-800">
                {" "}
                · {filteredUserCount.toLocaleString()} match current filters
              </span>
            ) : null}
          </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
          {isAdmin && (
            <Button
              type="button"
              variant="outline"
              onClick={handleExportExcel}
              disabled={isLoading || !filteredLocations.length}
              className="gap-2 rounded-xl border-slate-300 text-slate-800 hover:bg-slate-50"
            >
              <Download size={18} />
              Export Excel
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/admin/wallet-rebuild-doc")}
            className="rounded-xl border-slate-300 text-slate-800 hover:bg-slate-50"
          >
            Wallet rebuild doc
          </Button>
          <EmployeeGate perm="action:users:add">
            <Button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="gap-2 rounded-xl bg-slate-800 text-white hover:bg-slate-900"
            >
              <UserPlus size={18} />
              Add User
            </Button>
          </EmployeeGate>

          <Button
            type="button"
            variant="secondary"
            onClick={() => fetchLocations()}
            disabled={isLoading}
            className="gap-2 rounded-xl bg-[#FFD700] text-black hover:bg-[#E6C200] disabled:opacity-70"
          >
            <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
            Refresh
          </Button>
        </div>
      </div>

      {!filtersCollapsed ? (
      <div className="mb-6 grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-8">
        <EmployeeGate perm="filter:users:name">
        <FilterCheckboxDropdown
          label="Search Name"
          options={userNameFilterOptions}
          selected={filterSelectedUserIds}
          onToggle={toggleFilterUser}
          onClear={() => patchListState({ filterSelectedUserIds: [] }, { resetPage: true })}
          searchable
          searchPlaceholder="Search users…"
          emptyLabel="All users"
          contentClassName="min-w-[280px]"
        />
        </EmployeeGate>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            User ID
          </label>
          <div className="flex gap-1">
            <input
              type="text"
              inputMode="numeric"
              placeholder="e.g. 147"
              value={filterUserId}
              onChange={(e) =>
                patchListState(
                  { filterUserId: e.target.value.replace(/[^\d]/g, "") },
                  { resetPage: true },
                )
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            {filterUserId && (
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-2 text-xs text-slate-600 hover:bg-slate-50"
                onClick={() => patchListState({ filterUserId: "" }, { resetPage: true })}
              >
                Clear
              </button>
            )}
          </div>
        </div>
        <EmployeeGate perm="filter:users:email">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Search Email
          </label>
          <input
            type="text"
            placeholder="Filter by email..."
            value={filterEmail}
            onChange={(e) => patchListState({ filterEmail: e.target.value }, { resetPage: true })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        </EmployeeGate>
        <EmployeeGate perm="filter:users:kyc">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            KYC Status
          </label>
          <select
            value={filterKyc}
            onChange={(e) => patchListState({ filterKyc: e.target.value }, { resetPage: true })}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="submitted">Submitted</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        </EmployeeGate>
        <EmployeeGate perm="filter:users:online">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Platform status
          </label>
          <select
            value={filterOnline}
            onChange={(e) =>
              patchListState(
                { filterOnline: e.target.value as "all" | "live" },
                { resetPage: true },
              )
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="all">All users</option>
            <option value="live">Live on platform</option>
          </select>
        </div>
        </EmployeeGate>
        <EmployeeGate perm="filter:users:wallet">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Wallet balance
          </label>
          <select
            value={filterWallet}
            onChange={(e) =>
              patchListState(
                { filterWallet: e.target.value as "all" | "with_balance" | "empty" },
                { resetPage: true },
              )
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="all">All users</option>
            <option value="with_balance">Funded</option>
            <option value="empty">Non Funded</option>
          </select>
        </div>
        </EmployeeGate>
        <FilterCheckboxDropdown
          label="Package"
          options={packageFilterOptions}
          selected={filterPackages}
          onToggle={toggleFilterPackage}
          onClear={() => patchListState({ filterPackages: [] }, { resetPage: true })}
          emptyLabel="Default (hide active plans)"
          className="sm:col-span-2"
        />
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Trade
          </label>
          <select
            value={filterTrading}
            onChange={(e) =>
              patchListState(
                { filterTrading: e.target.value as "all" | "active" | "stopped" },
                { resetPage: true },
              )
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="all">All users</option>
            <option value="active">Trade active</option>
            <option value="stopped">Trade stopped</option>
          </select>
        </div>
        <EmployeeGate perm="filter:users:tag">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Tag
          </label>
          <select
            value={filterTag}
            onChange={(e) => patchListState({ filterTag: e.target.value }, { resetPage: true })}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="all">All tags</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
        </div>
        </EmployeeGate>
        <EmployeeGate perm="filter:users:risk">
        <FilterCheckboxDropdown
          label="Risk"
          options={riskFilterOptions}
          selected={filterRisks}
          onToggle={(value) => toggleFilterRisk(value as "none" | RiskId)}
          onClear={() => patchListState({ filterRisks: [] }, { resetPage: true })}
          emptyLabel="All risks"
          className="sm:col-span-2"
        />
        </EmployeeGate>
        <EmployeeGate perm="filter:users:referrer">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Referred by
          </label>
          <select
            value={filterReferrer}
            onChange={(e) => patchListState({ filterReferrer: e.target.value }, { resetPage: true })}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="all">All referrers</option>
            <option value="none">No referrer (direct)</option>
            {referrerFilterOptions.map((ref) => (
              <option key={ref.id} value={String(ref.id)}>
                {ref.label} (#{ref.id})
              </option>
            ))}
          </select>
        </div>
        </EmployeeGate>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Joined from
          </label>
          <input
            type="date"
            value={filterJoinFrom}
            onChange={(e) => patchListState({ filterJoinFrom: e.target.value }, { resetPage: true })}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Joined to
          </label>
          <input
            type="date"
            value={filterJoinTo}
            onChange={(e) => patchListState({ filterJoinTo: e.target.value }, { resetPage: true })}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <EmployeeGate perm="filter:users:wallet_sort">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Sort users
          </label>
          <select
            value={userSort}
            onChange={(e) =>
              patchListState({ userSort: e.target.value as UserSortMode }, { resetPage: true })
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="wallet_high">Wallet — highest first</option>
            <option value="wallet_low">Wallet — lowest first</option>
            <option value="joined_new">Join date — newest first</option>
            <option value="joined_old">Join date — oldest first</option>
          </select>
        </div>
        </EmployeeGate>
        <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-8">
          <Button
            type="button"
            variant={userSort === "joined_new" ? "default" : "outline"}
            onClick={() =>
              patchListState(
                { userSort: userSort === "joined_new" ? "wallet_high" : "joined_new" },
                { resetPage: true },
              )
            }
            className={`h-[38px] rounded-lg px-4 ${
              userSort === "joined_new"
                ? "bg-slate-900 text-white hover:bg-slate-800"
                : "border-slate-300 text-slate-700 hover:bg-slate-100"
            }`}
          >
            {userSort === "joined_new" ? "Join date (newest)" : "Sort by join date"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setSearchParams(serializeAdminUsersUrlState(defaultAdminUsersUrlState()), {
                replace: true,
              })
            }
            className="h-[38px] rounded-lg border-slate-300 text-slate-700 hover:bg-slate-100 sm:px-8"
          >
            Clear Filters
          </Button>
        </div>
      </div>
      ) : null}

      {error && (
        <div className="mb-6 rounded-xl border border-red-100 bg-red-50 p-4 text-red-600">
          {error}
        </div>
      )}

      {totals && (
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <button
            type="button"
            onClick={() => toggleWalletColumnSort("trading_wallet_high")}
            className={cn(
              "rounded-2xl border p-5 text-left shadow-sm transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400",
              userSort === "trading_wallet_high"
                ? "border-amber-400 bg-amber-100 ring-2 ring-amber-300/60"
                : "border-amber-200 bg-amber-50/50",
            )}
            title="Sort users by trading wallet (high → low). Hides $0 balances. Click again to reset."
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
              Trading Wallet total
              {userSort === "trading_wallet_high" ? (
                <span className="ml-1 normal-case text-[10px] font-bold">· sorted</span>
              ) : null}
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
              USD{" "}
              {totals.sum_trading_wallet_usd.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </button>
          <button
            type="button"
            onClick={() => toggleWalletColumnSort("safe_wallet_high")}
            className={cn(
              "rounded-2xl border p-5 text-left shadow-sm transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
              userSort === "safe_wallet_high"
                ? "border-emerald-400 bg-emerald-100 ring-2 ring-emerald-300/60"
                : "border-emerald-200 bg-emerald-50/50",
            )}
            title="Sort users by safe wallet (high → low). Hides $0 balances. Click again to reset."
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900">
              Safe Wallet total
              {userSort === "safe_wallet_high" ? (
                <span className="ml-1 normal-case text-[10px] font-bold">· sorted</span>
              ) : null}
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
              USD{" "}
              {totals.sum_safe_wallet_usd.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </button>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Total withdraw
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
              USD{" "}
              {totals.sum_total_withdraw_usd.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/90 px-4 py-3 sm:px-6">
          <p className="text-sm font-semibold text-slate-800">
            {hasActiveFilters ? (
              <>
                Showing{" "}
                <span className="tabular-nums text-emerald-800">{filteredUserCount.toLocaleString()}</span>
                {" of "}
                <span className="tabular-nums">{totalUserCount.toLocaleString()}</span> users
              </>
            ) : (
              <>
                <span className="tabular-nums">{totalUserCount.toLocaleString()}</span> users total
              </>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <AdminUsersColumnPicker
              visibility={columnVisibility}
              onChange={handleColumnVisibilityChange}
              canShowColumn={canShowColumn}
            />
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              Rows
              <select
                value={userPageSize}
                onChange={(e) =>
                  patchListState({ pageSize: Number(e.target.value) }, { resetPage: true })
                }
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {USER_PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            {hasActiveFilters ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900">
                Filters active
              </span>
            ) : null}
          </div>
        </div>
        <div ref={tableTopRef} className="max-h-[min(70vh,52rem)] overflow-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200">
                {ADMIN_USERS_TABLE_COLUMNS.filter((c) => showCol(c.id)).map((col) => {
                  const isTradingWalletCol = col.id === "wallet";
                  const isSafeWalletCol = col.id === "safe_wallet";

                  return (
                  <th
                    key={col.id}
                    className={cn(
                      "sticky top-0 z-10 whitespace-nowrap bg-slate-50 px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 shadow-[inset_0_-1px_0_0_rgb(226_232_240)] sm:px-6 sm:py-4",
                      (isTradingWalletCol || isSafeWalletCol) &&
                        "cursor-pointer select-none hover:bg-slate-100",
                      isTradingWalletCol &&
                        userSort === "trading_wallet_high" &&
                        "bg-amber-50 text-amber-900",
                      isSafeWalletCol &&
                        userSort === "safe_wallet_high" &&
                        "bg-emerald-50 text-emerald-900",
                    )}
                    onClick={
                      isTradingWalletCol
                        ? () => toggleWalletColumnSort("trading_wallet_high")
                        : isSafeWalletCol
                          ? () => toggleWalletColumnSort("safe_wallet_high")
                          : undefined
                    }
                    title={
                      isTradingWalletCol
                        ? "Sort by trading wallet (high → low). Hides $0. Click again to reset."
                        : isSafeWalletCol
                          ? "Sort by safe wallet (high → low). Hides $0. Click again to reset."
                          : undefined
                    }
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {isTradingWalletCol && userSort === "trading_wallet_high" ? (
                        <span className="text-[10px] font-bold normal-case text-amber-800">↓</span>
                      ) : null}
                      {isSafeWalletCol && userSort === "safe_wallet_high" ? (
                        <span className="text-[10px] font-bold normal-case text-emerald-800">↓</span>
                      ) : null}
                    </span>
                  </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {pagedLocations.map((loc) => {
                const uid = Number(loc.id);
                const fin = financeOverlay[uid];
                const walletBal = Number(loc.wallet_balance ?? 0);
                const livePl = fin?.live_pl ?? Number(loc.live_pl ?? 0);
                const equityVal = fin?.equity ?? Number(loc.equity ?? walletBal);
                const withdrawableVal =
                  fin?.withdrawable_equity ?? Number(loc.withdrawable_equity ?? walletBal);
                const openPos = Number(loc.open_positions ?? 0);
                const adminShare = sumOpenAdminShareUsd(
                  (openRowsByUser[uid] ?? []) as AdminOpenAssignRow[],
                );
                const equityPl = rowPlVsBaseline(loc, financeOverlay);
                const labels = parseUserLabels(loc);

                return (
                <tr
                  key={loc.id}
                  className={cn(
                    "border-b border-slate-100 transition hover:bg-yellow-50/40",
                    !isTradeActive(loc) &&
                      openPos > 0 &&
                      "bg-amber-50/40",
                  )}
                >
                  {showCol("name") && (
                  <td className="align-top px-4 py-3 sm:px-6 sm:py-4">
                    <div className="flex items-start gap-0.5">
                      <AdminUserTradesLink
                        userId={loc.id}
                        className="inline-flex max-w-[calc(100%-1.25rem)] truncate font-semibold"
                      >
                        <MaskedPii value={loc.name} kind="name" />
                      </AdminUserTradesLink>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="shrink-0 rounded p-0.5 text-yellow-900 opacity-70 hover:opacity-100"
                            aria-label="User actions"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-56 border-slate-200 bg-white shadow-lg">
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={() => navigate(`/admin/recharge?userId=${loc.id}`)}
                        >
                          View recharge
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={() => navigate(`/admin/transactions?userId=${loc.id}`)}
                        >
                          View package purchase
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={() =>
                            navigate(`/admin/withdrawals?userId=${loc.id}&status=all`)
                          }
                        >
                          View withdraw
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={() => navigate(`/admin/capital-statement?userId=${loc.id}`)}
                        >
                          Capital statement
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-slate-200" />
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={() => handleOpenWalletModal(loc)}
                        >
                          Edit wallet
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={() => openDetail(loc)}
                        >
                          See details
                        </DropdownMenuItem>
                        {can("action:users:view_trades") && (
                          <DropdownMenuItem
                            className="cursor-pointer"
                            onClick={() =>
                              navigate(withAdminReturn(`/admin/users/${loc.id}/trades`))
                            }
                          >
                            Account Statement
                          </DropdownMenuItem>
                        )}
                        {isAdmin && (
                          <DropdownMenuItem
                            className="cursor-pointer text-amber-900 focus:bg-amber-50 focus:text-amber-950"
                            onClick={() => void handleMagicLogin(loc)}
                          >
                            Magic login (as user)
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    </div>
                    <AdminUserTradesLink
                      userId={loc.id}
                      className="mt-0.5 font-mono text-[11px] font-normal text-slate-400 hover:text-yellow-900"
                    >
                      #{loc.id}
                    </AdminUserTradesLink>
                    {!showCol("package") && loc.active_package_id ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-medium text-slate-600">
                          {packageDisplayName(String(loc.active_package_id))}
                        </span>
                        {(() => {
                          const days = daysLeftUntil(loc.package_expires_at);
                          if (days == null) return null;
                          return (
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                                daysLeftBadgeClass(days),
                              )}
                              title={`Package ends ${formatAdminDate(loc.package_expires_at)}`}
                            >
                              {days <= 0 ? "Expired" : `${days}d left`}
                            </span>
                          );
                        })()}
                      </div>
                    ) : !showCol("package") ? (
                      <div className="mt-1.5 text-[11px] font-medium text-slate-400">
                        No active plan
                      </div>
                    ) : null}
                  </td>
                  )}

                  {showCol("status") && (
                  <td className="align-top whitespace-nowrap px-4 py-3 text-sm sm:px-6 sm:py-4">
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className={cn(
                          "inline-block h-2.5 w-2.5 rounded-full",
                          Number(loc.is_online) === 1
                            ? "bg-emerald-500 ring-2 ring-emerald-200"
                            : "bg-red-500 ring-2 ring-red-200",
                        )}
                      />
                      <span
                        className={cn(
                          "font-medium",
                          Number(loc.is_online) === 1 ? "text-emerald-700" : "text-slate-500",
                        )}
                      >
                        {lastSeenLabel(loc.last_seen_at, loc.is_online)}
                      </span>
                    </div>
                    {!showCol("trading") ? (
                      <p
                        className={cn(
                          "mt-1 text-[11px] font-medium",
                          isTradeActive(loc) ? "text-emerald-600" : "text-amber-700",
                        )}
                      >
                        Trade: {isTradeActive(loc) ? "Active" : "Stop"}
                      </p>
                    ) : null}
                  </td>
                  )}

                  {showCol("wallet") && (
                  <td className="align-top px-4 py-3 sm:px-6 sm:py-4">
                    <button
                      type="button"
                      onClick={() => toggleWalletColumnSort("trading_wallet_high")}
                      className={cn(
                        "text-left font-semibold tabular-nums text-slate-900 underline-offset-2 hover:text-amber-900 hover:underline",
                        userSort === "trading_wallet_high" && "text-amber-900",
                      )}
                      title="Sort by trading wallet (high → low)"
                    >
                      {loc.wallet_currency ?? "USD"}{" "}
                      {fmtUsdCell(tradingWalletUsd(loc))}
                    </button>
                    {Number(loc.has_wallet) === 0 && (
                      <span className="text-xs text-slate-400">No wallet</span>
                    )}
                  </td>
                  )}

                  {showCol("safe_wallet") && (
                  <td className="align-top px-4 py-3 sm:px-6 sm:py-4">
                    <button
                      type="button"
                      onClick={() => toggleWalletColumnSort("safe_wallet_high")}
                      className={cn(
                        "text-left font-semibold tabular-nums text-slate-900 underline-offset-2 hover:text-emerald-800 hover:underline",
                        userSort === "safe_wallet_high" && "text-emerald-800",
                      )}
                      title="Sort by safe wallet (high → low)"
                    >
                      {loc.wallet_currency ?? "USD"}{" "}
                      {fmtUsdCell(safeWalletUsd(loc))}
                    </button>
                  </td>
                  )}

                  {showCol("equity") && (
                  <td className="align-top px-4 py-3 sm:px-6 sm:py-4">
                    <div className="font-semibold tabular-nums text-slate-900">
                      USD {fmtUsdCell(equityVal)}
                    </div>
                    {openPos > 0 && (
                      <span className="text-[11px] text-slate-500">{openPos} open</span>
                    )}
                    {loc.soft_bust && (
                      <span className="text-[11px] font-medium text-amber-800">Soft bust</span>
                    )}
                  </td>
                  )}

                  {showCol("live_pl") && (
                  <td className="align-top px-4 py-3 sm:px-6 sm:py-4">
                    <span
                      className={`font-semibold tabular-nums ${
                        livePl >= 0 ? "text-emerald-700" : "text-red-700"
                      }`}
                    >
                      {openPos > 0 || loc.live_pl != null ? fmtUsdCell(livePl) : "—"}
                    </span>
                  </td>
                  )}

                  {showCol("admin_share") && (
                  <td className="align-top px-4 py-3 sm:px-6 sm:py-4">
                    <span
                      className={`font-semibold tabular-nums ${
                        adminShare > 0.01
                          ? "text-emerald-700"
                          : adminShare < -0.01
                            ? "text-red-700"
                            : "text-slate-500"
                      }`}
                      title="Estimated admin share on open trades (frontend)"
                    >
                      {openPos > 0 || Math.abs(adminShare) > 0.005
                        ? fmtUsdCell(adminShare)
                        : "—"}
                    </span>
                  </td>
                  )}

                  {showCol("kyc") && (
                  <td className="align-top px-4 py-3 sm:px-6 sm:py-4">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${
                        loc.kyc_status === "verified"
                          ? "border-green-200 bg-green-100 text-green-700"
                          : kycBadgeStyles(loc.kyc_status)
                      }`}
                    >
                      {loc.kyc_status ?? "pending"}
                    </span>
                  </td>
                  )}

                  {showCol("email") && (
                  <td className="align-top px-4 py-3 text-sm text-slate-700 sm:px-6 sm:py-4">
                    <MaskedPii value={loc.email} kind="email" className="break-all" />
                  </td>
                  )}

                  {showCol("mobile") && (
                  <td className="align-top whitespace-nowrap px-4 py-3 text-sm tabular-nums text-slate-700 sm:px-6 sm:py-4">
                    <MaskedPii value={loc.mobile} kind="mobile" />
                  </td>
                  )}

                  {showCol("telegram") && (
                  <td className="align-top whitespace-nowrap px-4 py-3 text-sm text-slate-700 sm:px-6 sm:py-4">
                    {String(loc.telegram ?? "—")}
                  </td>
                  )}

                  {showCol("joined") && (
                  <td className="align-top whitespace-nowrap px-4 py-3 text-sm text-slate-700 sm:px-6 sm:py-4">
                    {formatAdminDate(String(loc.created_at ?? ""))}
                  </td>
                  )}

                  {showCol("package") && (
                  <td className="align-top px-4 py-3 sm:px-6 sm:py-4">
                    {loc.active_package_id ? (
                      <div>
                        <div className="text-sm font-medium text-slate-800">
                          {packageDisplayName(String(loc.active_package_id))}
                        </div>
                        {(() => {
                          const days = daysLeftUntil(loc.package_expires_at);
                          if (days == null) return null;
                          return (
                            <span
                              className={cn(
                                "mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                                daysLeftBadgeClass(days),
                              )}
                            >
                              {days <= 0 ? "Expired" : `${days}d left`}
                            </span>
                          );
                        })()}
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">No active plan</span>
                    )}
                  </td>
                  )}

                  {showCol("referrer") && (
                  <td className="align-top px-4 py-3 text-sm text-slate-700 sm:px-6 sm:py-4">
                    {Number(loc.referrer_id) > 0 ? (
                      <div>
                        <div className="font-medium">{referrerDisplayLabel(loc)}</div>
                        <div className="font-mono text-[11px] text-slate-400">
                          #{loc.referrer_id}
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  )}

                  {showCol("risk") && (
                  <td className="align-top px-4 py-3 sm:px-6 sm:py-4">
                    {renderRiskBadges(loc.risk)}
                  </td>
                  )}

                  {showCol("label") && (
                  <td className="align-top px-4 py-3 text-sm text-slate-700 sm:px-6 sm:py-4">
                    {labels.label ? labels.label : <span className="text-slate-400">—</span>}
                  </td>
                  )}

                  {showCol("tags") && (
                  <td className="align-top px-4 py-3 sm:px-6 sm:py-4">
                    {labels.tags.length ? (
                      <div className="flex flex-wrap gap-1">
                        {labels.tags.map((tag) => (
                          <span
                            key={tag}
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                              tagColorClass(tag),
                            )}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">—</span>
                    )}
                  </td>
                  )}

                  {showCol("deposit_baseline") && (
                  <td className="align-top px-4 py-3 font-semibold tabular-nums text-slate-900 sm:px-6 sm:py-4">
                    {fmtUsdCell(Number(loc.deposit_baseline ?? NaN))}
                  </td>
                  )}

                  {showCol("open_positions") && (
                  <td className="align-top px-4 py-3 tabular-nums text-slate-800 sm:px-6 sm:py-4">
                    {openPos}
                  </td>
                  )}

                  {showCol("withdrawable") && (
                  <td className="align-top px-4 py-3 font-semibold tabular-nums text-slate-900 sm:px-6 sm:py-4">
                    {fmtUsdCell(withdrawableVal)}
                  </td>
                  )}

                  {showCol("equity_pl") && (
                  <td className="align-top px-4 py-3 sm:px-6 sm:py-4">
                    <span
                      className={`font-semibold tabular-nums ${
                        equityPl >= 0 ? "text-emerald-700" : "text-red-700"
                      }`}
                    >
                      {fmtUsdCell(equityPl)}
                    </span>
                  </td>
                  )}

                  {showCol("country") && (
                  <td className="align-top px-4 py-3 text-sm text-slate-700 sm:px-6 sm:py-4">
                    {[loc.city, loc.state, loc.country]
                      .map((v) => (v != null ? String(v).trim() : ""))
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </td>
                  )}

                  {showCol("experience") && (
                  <td className="align-top px-4 py-3 text-sm text-slate-700 sm:px-6 sm:py-4">
                    {String(loc.experience ?? "—")}
                  </td>
                  )}

                  {showCol("profit_pct") && (
                  <td className="align-top px-4 py-3 tabular-nums text-slate-800 sm:px-6 sm:py-4">
                    {loc.profit_percentage != null && Number.isFinite(Number(loc.profit_percentage))
                      ? `${Number(loc.profit_percentage).toFixed(2)}%`
                      : "—"}
                  </td>
                  )}

                  {showCol("fee_lot") && (
                  <td className="align-top px-4 py-3 tabular-nums text-slate-800 sm:px-6 sm:py-4">
                    {fmtUsdCell(Number(loc.dollar_amount ?? NaN))}
                  </td>
                  )}

                  {showCol("recharge_total") && (
                  <td className="align-top px-4 py-3 tabular-nums text-slate-800 sm:px-6 sm:py-4">
                    {fmtUsdCell(Number(loc.recharge_total_usd ?? NaN))}
                  </td>
                  )}

                  {showCol("trading") && (
                  <td className="align-top px-4 py-3 sm:px-6 sm:py-4">
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                        isTradeActive(loc)
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-amber-200 bg-amber-50 text-amber-800",
                      )}
                    >
                      {isTradeActive(loc) ? "Active" : "Stop"}
                    </span>
                  </td>
                  )}
                </tr>
              );
              })}
              {filteredLocations.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={Math.max(visibleUserCols, 1)} className="px-6 py-8 text-center text-slate-500">
                    No users match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <ListPaginationBar
          page={userPage}
          totalPages={userTotalPages}
          total={filteredUserTotal}
          pageSize={userPageSize}
          onPageChange={(p) => patchListState({ page: p })}
          itemLabel="users"
        />
      </div>

      <UserDetailDialog
        user={detailUser}
        open={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        isVoiceAdmin={isVoiceAdmin}
        adminListenerId={adminListenerId}
        onProfile={(u) => navigate(`/admin/user-profile/${u.id}`)}
        onWallet={handleOpenWalletModal}
        onEdit={(u) => {
          setSelectedUser(u);
          setIsModalOpen(true);
        }}
        onVoice={setVoiceUser}
        onRechargeHistory={(userId) => navigate(`/admin/recharge?userId=${userId}`)}
        onOpenMap={openUserLocationOnMap}
        onLabelsUpdated={handleLabelsUpdated}
        onExtendPackage={(u) => {
          setExtendUser({
            id: Number(u.id),
            name: u.name != null ? String(u.name) : undefined,
            email: u.email != null ? String(u.email) : undefined,
          });
          setIsExtendOpen(true);
        }}
        onTradingReopened={() => void fetchLocations({ silent: true })}
      />

      <ExtendSubscriptionModal
        open={isExtendOpen}
        onClose={() => {
          setIsExtendOpen(false);
          setExtendUser(null);
        }}
        user={extendUser}
      />

      <EditUserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        user={selectedUser}
        onUpdate={handleUpdate}
      />

      <AddUserModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddUser}
      />

      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        user={walletUser}
        initialBalance={walletBalance}
        onUpdate={handleUpdateWallet}
        isLoading={isWalletLoading}
      />

      {isVoiceAdmin && voiceUser && Number.isFinite(adminListenerId) && (
        <AdminVoicePanel
          apiBase={API_BASE}
          adminUserId={adminListenerId}
          user={{ id: Number(voiceUser.id), name: voiceUser.name, email: voiceUser.email }}
          onClose={() => setVoiceUser(null)}
        />
      )}
    </div>
  );
};

export default AdminPage;
