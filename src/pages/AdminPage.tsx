import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw,
  UserPlus,
  MoreHorizontal,
  MapPin,
  History,
  Mail,
  Phone,
} from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

import EditUserModal from '../components/admin/EditUserModal';
import AddUserModal from '../components/admin/AddUserModal';
import WalletModal from '../components/admin/WalletModal';
import AdminVoicePanel from '../components/admin/AdminVoicePanel';
import UserDetailDialog from '../components/admin/UserDetailDialog';
import ExtendSubscriptionModal from '../components/admin/ExtendSubscriptionModal';
import UserLabelsDisplay from '../components/admin/UserLabelsDisplay';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useApp } from "@/context/AppContext";
import { API_BASE, SOCKET_URL } from "@/config/api";
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
  renderRiskBadges,
  userHasMapLink,
  walletBalanceOf,
} from "@/utils/adminUserDisplay";
import { useClientPagination } from "@/hooks/useClientPagination";
import { ListPaginationBar } from "@/components/trades/TradesPaginationBar";
import { useEmployeeAccess } from "@/hooks/useEmployeeAccess";
import { EmployeeGate } from "@/components/auth/EmployeeGate";
import { fetchAllUsedTags, parseUserLabels } from "@/utils/adminUserLabels";

const USER_PAGE_SIZE = 50;

const fmtUsd = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type AdminUsersTotals = {
  sum_wallet_balances_usd: number;
  sum_successful_payments_usd: number;
  sum_successful_recharges_usd: number;
  sum_equity_usd?: number;
  sum_live_pl_usd?: number;
  sum_withdrawable_usd?: number;
  total_open_positions?: number;
};

type Mt5MasterMetrics = {
  balance?: number;
  equity?: number;
  margin?: number;
  free_margin?: number;
  margin_level?: number;
  updated_at?: string;
};

const AdminPage = () => {
  const navigate = useNavigate();

  const [locations, setLocations] = useState<any[]>([]);
  const [totals, setTotals] = useState<AdminUsersTotals | null>(null);
  const [mt5Master, setMt5Master] = useState<Mt5MasterMetrics | null>(null);
  const [liveCount, setLiveCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [labelsVersion, setLabelsVersion] = useState(0);

  const [filterName, setFilterName] = useState('');
  const [filterEmail, setFilterEmail] = useState('');
  const [filterKyc, setFilterKyc] = useState('all');
  const [filterOnline, setFilterOnline] = useState<'all' | 'live'>('all');
  const [filterWallet, setFilterWallet] = useState<'all' | 'with_balance' | 'empty'>('all');
  const [filterTag, setFilterTag] = useState('all');
  const [walletSort, setWalletSort] = useState<'high' | 'low'>('high');
  const [allTags, setAllTags] = useState<string[]>([]);
  const [openRowsByUser, setOpenRowsByUser] = useState<Record<number, UserTradeRowLike[]>>({});
  const [financeOverlay, setFinanceOverlay] = useState<Record<number, AdminFinanceOverlay>>({});

  const { currentUser } = useApp();
  const { can } = useEmployeeAccess();
  const isVoiceAdmin = can("action:users:voice");
  const adminListenerId = Number(currentUser?.userId);
  const [voiceUser, setVoiceUser] = useState<any>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [walletUser, setWalletUser] = useState<any>(null);
  const [walletBalance, setWalletBalance] = useState<number | string>("");
  const [isWalletLoading, setIsWalletLoading] = useState(false);

  const [detailUser, setDetailUser] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const [extendUser, setExtendUser] = useState<{ id: number; name?: string; email?: string } | null>(null);
  const [isExtendOpen, setIsExtendOpen] = useState(false);

  const { toast } = useToast();

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

  const fetchMt5Metrics = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/mt5-metrics`);
      const data = await response.json();
      if (data.success && data.metrics) {
        setMt5Master(data.metrics as Mt5MasterMetrics);
      }
    } catch {
      // optional — master panel card hidden until data arrives
    }
  }, []);

  const fetchLocations = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/admin/users?finance=1`);
      const data = await response.json();
      if (data.success) {
        setLocations(data.users);
        setLiveCount(Number(data.live_count ?? data.totals?.live_users ?? 0));
        if (data.totals) {
          setTotals({
            sum_wallet_balances_usd: Number(data.totals.sum_wallet_balances_usd ?? 0),
            sum_successful_payments_usd: Number(data.totals.sum_successful_payments_usd ?? 0),
            sum_successful_recharges_usd: Number(data.totals.sum_successful_recharges_usd ?? 0),
            sum_equity_usd: Number(data.totals.sum_equity_usd ?? 0),
            sum_live_pl_usd: Number(data.totals.sum_live_pl_usd ?? 0),
            sum_withdrawable_usd: Number(data.totals.sum_withdrawable_usd ?? 0),
            total_open_positions: Number(data.totals.total_open_positions ?? 0),
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
    void fetchLocations();
    void fetchOpenAssignments();
    void fetchMt5Metrics();
    const usersPoll = window.setInterval(() => fetchLocations({ silent: true }), 10_000);
    const openPoll = window.setInterval(() => void fetchOpenAssignments(), 60_000);
    const metricsPoll = window.setInterval(() => void fetchMt5Metrics(), 15_000);
    return () => {
      window.clearInterval(usersPoll);
      window.clearInterval(openPoll);
      window.clearInterval(metricsPoll);
    };
  }, [fetchLocations, fetchOpenAssignments, fetchMt5Metrics]);

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
        Number(loc.equity ?? 0),
      );
    }
    setFinanceOverlay(overlay);
  }, [locations, openRowsByUser]);

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void fetchLocations({ silent: true });
        void fetchMt5Metrics();
      }, 600);
    };

    adminSocket.on("mt5live", scheduleRefresh);
    adminSocket.on("mt5data", scheduleRefresh);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      adminSocket.off("mt5live", scheduleRefresh);
      adminSocket.off("mt5data", scheduleRefresh);
    };
  }, [fetchLocations, fetchMt5Metrics]);

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
        toast({
          title: "Wallet Updated ✅",
          description: `Balance set to $${data.newBalance}`
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

  const filteredLocations = useMemo(() => {
    const filtered = locations.filter((loc) => {
      const nameStr = String(loc.name || "").toLowerCase();
      const emailStr = String(loc.email || "").toLowerCase();

      const matchName = nameStr.includes(filterName.toLowerCase());
      const matchEmail = emailStr.includes(filterEmail.toLowerCase());

      const currentKyc = String(loc.kyc_status ?? "pending").toLowerCase();
      const matchKyc = filterKyc === "all" || currentKyc === filterKyc;
      const matchOnline =
        filterOnline === "all" || Number(loc.is_online) === 1;

      let matchTag = true;
      if (filterTag !== "all") {
        const userTags = parseUserLabels(loc).tags;
        matchTag = userTags.includes(filterTag);
      }

      const bal = walletBalanceOf(loc);
      const matchWallet =
        filterWallet === "all" ||
        (filterWallet === "with_balance" && bal > 0.02) ||
        (filterWallet === "empty" && bal <= 0.02);

      return matchName && matchEmail && matchKyc && matchOnline && matchTag && matchWallet;
    });

    return filtered.sort((a, b) => {
      const diff = walletBalanceOf(b) - walletBalanceOf(a);
      return walletSort === "high" ? diff : -diff;
    });
  }, [locations, filterName, filterEmail, filterKyc, filterOnline, filterWallet, filterTag, walletSort]);

  const totalUserCount = locations.length;
  const filteredUserCount = filteredLocations.length;
  const hasActiveFilters = useMemo(
    () =>
      Boolean(filterName.trim()) ||
      Boolean(filterEmail.trim()) ||
      filterKyc !== "all" ||
      filterOnline !== "all" ||
      filterWallet !== "all" ||
      filterTag !== "all",
    [filterName, filterEmail, filterKyc, filterOnline, filterWallet, filterTag],
  );

  const {
    page: userPage,
    setPage: setUserPage,
    pageItems: pagedLocations,
    totalPages: userTotalPages,
    total: filteredUserTotal,
  } = useClientPagination(filteredLocations, USER_PAGE_SIZE);

  useEffect(() => {
    setUserPage(1);
  }, [filterName, filterEmail, filterKyc, filterOnline, filterWallet, filterTag, walletSort, setUserPage]);

  const filteredFinanceTotals = useMemo(() => {
    let wallet = 0;
    let equity = 0;
    let livePl = 0;
    let openPos = 0;
    for (const loc of filteredLocations) {
      const uid = Number(loc.id);
      const fin = financeOverlay[uid];
      wallet += Number(loc.wallet_balance ?? 0);
      livePl += fin?.live_pl ?? Number(loc.live_pl ?? 0);
      equity += fin?.equity ?? Number(loc.equity ?? loc.wallet_balance ?? 0);
      openPos += Number(loc.open_positions ?? 0);
    }
    return {
      wallet: Math.round(wallet * 100) / 100,
      equity: Math.round(equity * 100) / 100,
      livePl: Math.round(livePl * 100) / 100,
      openPos,
    };
  }, [filteredLocations, financeOverlay]);

  const visibleUserCols = useMemo(
    () =>
      [
        "col:users:name",
        "col:users:labels",
        "col:users:status",
        "col:users:wallet",
        "col:users:equity",
        "col:users:live_pl",
        "col:users:withdrawable",
        "col:users:recharges",
        "col:users:created",
        "col:users:kyc",
        "col:users:profit_pct",
        "col:users:dollar_cut",
        "col:users:risk",
        "col:users:actions",
        "col:users:email",
        "col:users:mobile",
        "col:users:telegram",
        "col:users:location",
      ].filter((k) => can(k)).length,
    [can],
  );

  return (
    <div className="w-full min-w-0 font-sans">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Users
            </h1>
            <EmployeeGate perm="filter:users:online">
              <button
                type="button"
                onClick={() =>
                  setFilterOnline((prev) => (prev === "live" ? "all" : "live"))
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
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-700">
              {hasActiveFilters
                ? `${filteredUserCount.toLocaleString()} of ${totalUserCount.toLocaleString()} users`
                : `${totalUserCount.toLocaleString()} users`}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Manage accounts, wallets, addresses &amp; KYC · sorted by wallet balance
            {hasActiveFilters ? (
              <span className="font-medium text-slate-800">
                {" "}
                · {filteredUserCount.toLocaleString()} match current filters
              </span>
            ) : null}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
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

      <div className="mb-6 grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-8">
        <EmployeeGate perm="filter:users:name">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Search Name
          </label>
          <input
            type="text"
            placeholder="Filter by name..."
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        </EmployeeGate>
        <EmployeeGate perm="filter:users:email">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Search Email
          </label>
          <input
            type="text"
            placeholder="Filter by email..."
            value={filterEmail}
            onChange={(e) => setFilterEmail(e.target.value)}
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
            onChange={(e) => setFilterKyc(e.target.value)}
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
            onChange={(e) => setFilterOnline(e.target.value as "all" | "live")}
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
            onChange={(e) => setFilterWallet(e.target.value as "all" | "with_balance" | "empty")}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="all">All users</option>
            <option value="with_balance">Has balance ({'>'} $0)</option>
            <option value="empty">No balance ($0)</option>
          </select>
        </div>
        </EmployeeGate>
        <EmployeeGate perm="filter:users:tag">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Tag
          </label>
          <select
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="all">All tags</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
        </div>
        </EmployeeGate>
        <EmployeeGate perm="filter:users:wallet_sort">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Wallet sort
          </label>
          <select
            value={walletSort}
            onChange={(e) => setWalletSort(e.target.value as "high" | "low")}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="high">Highest balance first</option>
            <option value="low">Lowest balance first</option>
          </select>
        </div>
        </EmployeeGate>
        <div className="flex items-end sm:col-span-2 lg:col-span-8">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setFilterName('');
              setFilterEmail('');
              setFilterKyc('all');
              setFilterOnline('all');
              setFilterWallet('all');
              setFilterTag('all');
              setWalletSort('high');
            }}
            className="h-[38px] w-full rounded-lg border-slate-300 text-slate-700 hover:bg-slate-100 sm:w-auto sm:px-8"
          >
            Clear Filters
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-100 bg-red-50 p-4 text-red-600">
          {error}
        </div>
      )}

      {totals && (
        <div className="mb-8 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Total received (successful payments)
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
                USD {fmtUsd(totals.sum_successful_payments_usd)}
              </p>
            </div>
            <div className="rounded-2xl border border-yellow-200 bg-[#FFF9E6]/90 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-800">
                Wallet recharges only
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-neutral-900">
                USD {fmtUsd(totals.sum_successful_recharges_usd)}
              </p>
            </div>
            <div className="rounded-2xl border border-yellow-300 bg-yellow-50/60 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-900">
                Total user wallets
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-neutral-900">
                USD {fmtUsd(totals.sum_wallet_balances_usd)}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                Total user equity
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-900">
                USD {fmtUsd(totals.sum_equity_usd ?? 0)}
              </p>
              <p className="mt-1 text-[11px] text-emerald-700">Wallet + live P/L per user</p>
            </div>
            <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">
                Total live P/L (users)
              </p>
              <p
                className={cn(
                  "mt-2 text-2xl font-bold tabular-nums",
                  (totals.sum_live_pl_usd ?? 0) >= 0 ? "text-emerald-700" : "text-red-600",
                )}
              >
                {(totals.sum_live_pl_usd ?? 0) >= 0 ? "+" : ""}
                USD {fmtUsd(totals.sum_live_pl_usd ?? 0)}
              </p>
              <p className="mt-1 text-[11px] text-sky-700">
                {(totals.total_open_positions ?? 0).toLocaleString()} open position
                {(totals.total_open_positions ?? 0) === 1 ? "" : "s"}
              </p>
            </div>
            {mt5Master && (mt5Master.balance != null || mt5Master.equity != null) ? (
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-800">
                  MT5 master account (socket)
                </p>
                {mt5Master.balance != null ? (
                  <p className="mt-2 text-lg font-bold tabular-nums text-indigo-900">
                    Balance USD {fmtUsd(Number(mt5Master.balance))}
                  </p>
                ) : null}
                {mt5Master.equity != null ? (
                  <p className="mt-1 text-lg font-bold tabular-nums text-indigo-900">
                    Equity USD {fmtUsd(Number(mt5Master.equity))}
                  </p>
                ) : null}
                <p className="mt-1 text-[11px] text-indigo-700">
                  Compare with your MT4/MT5 panel
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  MT5 master account (socket)
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Waiting for balance/equity on socket feed
                </p>
              </div>
            )}
          </div>
          {hasActiveFilters ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
              <span className="font-semibold">Filtered view totals: </span>
              wallets USD {fmtUsd(filteredFinanceTotals.wallet)}
              {" · "}
              equity USD {fmtUsd(filteredFinanceTotals.equity)}
              {" · "}
              live P/L{" "}
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  filteredFinanceTotals.livePl >= 0 ? "text-emerald-800" : "text-red-700",
                )}
              >
                {(filteredFinanceTotals.livePl >= 0 ? "+" : "") + fmtUsd(filteredFinanceTotals.livePl)}
              </span>
              {" · "}
              {filteredFinanceTotals.openPos.toLocaleString()} open
            </div>
          ) : null}
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
          {hasActiveFilters ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900">
              Filters active
            </span>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/95">
                {can("col:users:name") && (
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  User
                </th>
                )}
                {can("col:users:labels") && (
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  Label &amp; Tags
                </th>
                )}
                {can("col:users:status") && (
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  Status
                </th>
                )}
                {can("col:users:wallet") && (
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  Wallet
                </th>
                )}
                {can("col:users:equity") && (
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  Equity
                </th>
                )}
                {can("col:users:live_pl") && (
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  Live P/L
                </th>
                )}
                {can("col:users:withdrawable") && (
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  Withdrawable
                </th>
                )}
                {can("col:users:recharges") && (
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  Recharges
                </th>
                )}
                {can("col:users:created") && (
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  Created
                </th>
                )}
                {can("col:users:kyc") && (
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  KYC
                </th>
                )}
                {can("col:users:profit_pct") && (
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  Profit %
                </th>
                )}
                {can("col:users:dollar_cut") && (
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  Dollar cut
                </th>
                )}
                {can("col:users:risk") && (
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  Risk profile
                </th>
                )}
                {can("col:users:actions") && (
                <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  Action
                </th>
                )}
                {can("col:users:email") && (
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  Email
                </th>
                )}
                {can("col:users:mobile") && (
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  Mobile
                </th>
                )}
                {can("col:users:telegram") && (
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  Telegram
                </th>
                )}
                {can("col:users:location") && (
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  Location
                </th>
                )}
              </tr>
            </thead>

            <tbody>
              {pagedLocations.map((loc) => {
                const fin = financeOverlay[Number(loc.id)];
                const walletBal = Number(loc.wallet_balance ?? 0);
                const livePl = fin?.live_pl ?? Number(loc.live_pl ?? 0);
                const equityVal = fin?.equity ?? Number(loc.equity ?? walletBal);
                const withdrawableVal =
                  fin?.withdrawable_equity ?? Number(loc.withdrawable_equity ?? walletBal);
                const openPos = Number(loc.open_positions ?? 0);

                return (
                <tr key={loc.id} className="border-b border-slate-100 transition hover:bg-yellow-50/40">
                  {can("col:users:name") && (
                  <td className="align-top px-4 py-3 sm:px-6 sm:py-4">
                    {can("action:users:view_trades") ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/admin/users/${loc.id}/trades`)}
                      className="text-left font-semibold text-yellow-900 underline-offset-2 hover:underline"
                    >
                      {loc.name}
                    </button>
                    ) : (
                    <span className="font-semibold text-slate-900">{loc.name}</span>
                    )}
                    <div className="mt-0.5 font-mono text-[11px] text-slate-400">#{loc.id}</div>
                  </td>
                  )}

                  {can("col:users:labels") && (
                  <td className="align-top px-4 py-3 sm:px-6 sm:py-4">
                    <UserLabelsDisplay
                      user={loc}
                      compact
                      onClick={() => openDetail(loc)}
                    />
                  </td>
                  )}

                  {can("col:users:status") && (
                  <td className="align-top whitespace-nowrap px-4 py-3 text-sm sm:px-6 sm:py-4">
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className={cn(
                          "inline-block h-2.5 w-2.5 rounded-full",
                          Number(loc.is_online) === 1
                            ? "bg-emerald-500 ring-2 ring-emerald-200"
                            : "bg-slate-300",
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
                  </td>
                  )}

                  {can("col:users:wallet") && (
                  <td className="align-top px-4 py-3 sm:px-6 sm:py-4">
                    <div className="font-semibold tabular-nums text-slate-900">
                      {loc.wallet_currency ?? "USD"}{" "}
                      {Number(loc.wallet_balance ?? 0).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                    {Number(loc.has_wallet) === 0 && (
                      <span className="text-xs text-slate-400">No wallet</span>
                    )}
                  </td>
                  )}

                  {can("col:users:equity") && (
                  <td className="align-top px-4 py-3 sm:px-6 sm:py-4">
                    <div className="font-semibold tabular-nums text-slate-900">
                      USD{" "}
                      {equityVal.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                    {openPos > 0 && (
                      <span className="text-[11px] text-slate-500">{openPos} open</span>
                    )}
                    {loc.soft_bust && (
                      <span className="text-[11px] font-medium text-amber-800">Soft bust</span>
                    )}
                  </td>
                  )}

                  {can("col:users:live_pl") && (
                  <td className="align-top px-4 py-3 sm:px-6 sm:py-4">
                    <span
                      className={`font-semibold tabular-nums ${
                        livePl >= 0 ? "text-emerald-700" : "text-red-700"
                      }`}
                    >
                      {openPos > 0 || loc.live_pl != null
                        ? livePl.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : "—"}
                    </span>
                  </td>
                  )}

                  {can("col:users:withdrawable") && (
                  <td className="align-top px-4 py-3 sm:px-6 sm:py-4">
                    <span className="font-semibold tabular-nums text-slate-900">
                      USD{" "}
                      {withdrawableVal.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </td>
                  )}

                  {can("col:users:recharges") && (
                  <td className="align-top px-4 py-3 sm:px-6 sm:py-4">
                    <div className="space-y-1.5">
                      <div className="font-semibold tabular-nums text-slate-900">
                        {Number(loc.recharge_success_count ?? 0)}×{" "}
                        <span className="font-normal text-slate-600">success</span>
                      </div>
                      <div className="text-xs tabular-nums font-medium text-neutral-800">
                        USD{" "}
                        {Number(loc.recharge_total_usd ?? 0).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        <span className="font-normal text-slate-500">total</span>
                      </div>
                      {Number(loc.recharge_pending_count ?? 0) > 0 && (
                        <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900">
                          {Number(loc.recharge_pending_count)} pending
                        </span>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 px-2 text-xs font-semibold text-neutral-800 hover:bg-yellow-50 hover:text-neutral-900"
                        title="Open recharge history for this user"
                        onClick={() => navigate(`/admin/recharge?userId=${loc.id}`)}
                      >
                        <History className="h-3.5 w-3.5" />
                        History
                      </Button>
                    </div>
                  </td>
                  )}

                  {can("col:users:created") && (
                  <td className="align-top whitespace-nowrap px-4 py-3 text-sm text-slate-600 sm:px-6 sm:py-4">
                    {formatAdminDate(loc.created_at)}
                  </td>
                  )}

                  {can("col:users:kyc") && (
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

                  {can("col:users:profit_pct") && (
                  <td className="align-top px-4 py-3 text-sm text-slate-700 sm:px-6 sm:py-4">
                    {loc.profit_percentage != null && loc.profit_percentage !== ""
                      ? `${loc.profit_percentage}%`
                      : "—"}
                  </td>
                  )}

                  {can("col:users:dollar_cut") && (
                  <td className="align-top px-4 py-3 text-sm text-slate-700 sm:px-6 sm:py-4">
                    {loc.dollar_amount ? `$${loc.dollar_amount}` : "—"}
                  </td>
                  )}

                  {can("col:users:risk") && (
                  <td className="align-top px-4 py-3 text-sm text-slate-700 sm:px-6 sm:py-4">
                    {renderRiskBadges(loc.risk)}
                  </td>
                  )}

                  {can("col:users:actions") && (
                  <td className="align-top px-4 py-3 text-right sm:px-6 sm:py-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 gap-1.5 border-slate-200 bg-white font-semibold text-slate-800 hover:bg-slate-50"
                      onClick={() => openDetail(loc)}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                      Manage
                    </Button>
                  </td>
                  )}

                  {can("col:users:email") && (
                  <td className="align-top px-4 py-3 sm:px-6 sm:py-4">
                    <div className="flex max-w-[200px] items-start gap-2">
                      <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="break-all text-xs text-slate-600">{loc.email || "—"}</span>
                    </div>
                  </td>
                  )}

                  {can("col:users:mobile") && (
                  <td className="align-top whitespace-nowrap px-4 py-3 text-sm sm:px-6 sm:py-4">
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="text-slate-800">{loc.mobile || "—"}</span>
                    </div>
                  </td>
                  )}

                  {can("col:users:telegram") && (
                  <td className="align-top px-4 py-3 text-sm sm:px-6 sm:py-4">
                    {loc.telegram ? (
                      <span className="inline-flex items-center rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-900">
                        @{loc.telegram}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  )}

                  {can("col:users:location") && (
                  <td className="align-top px-4 py-3 sm:px-6 sm:py-4">
                    {userHasMapLink(loc) ? (
                      <button
                        type="button"
                        onClick={() => openUserLocationOnMap(loc)}
                        className="group w-full max-w-[240px] rounded-lg border border-yellow-300 bg-white px-3 py-2 text-left shadow-sm transition hover:border-yellow-400 hover:bg-yellow-50/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500"
                        title="Open Google Maps"
                      >
                        <div className="flex gap-2">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neutral-900" />
                          <div className="min-w-0 flex-1">
                            {loc.address ? (
                              <div className="max-h-20 overflow-y-auto text-xs leading-snug text-slate-800">
                                {loc.address}
                              </div>
                            ) : (
                              <div className="font-mono text-[11px] text-slate-600">
                                {parseCoord(loc.latitude)?.toFixed(5)},{" "}
                                {parseCoord(loc.longitude)?.toFixed(5)}
                              </div>
                            )}
                            <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wide text-neutral-900">
                              Open map
                            </span>
                          </div>
                        </div>
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">No location</span>
                    )}
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
          pageSize={USER_PAGE_SIZE}
          onPageChange={setUserPage}
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
