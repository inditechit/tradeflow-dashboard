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
  userPlVsDeposit,
} from "@/utils/adminUserDisplay";
import { useClientPagination } from "@/hooks/useClientPagination";
import { ListPaginationBar } from "@/components/trades/TradesPaginationBar";
import {
  fetchAllUsedTags,
  parseUserLabels,
} from "@/utils/adminUserLabels";

const USER_PAGE_SIZE = 50;

const AdminPage = () => {
  const navigate = useNavigate();

  const [locations, setLocations] = useState<any[]>([]);
  const [totals, setTotals] = useState<{
    sum_wallet_balances_usd: number;
    sum_successful_payments_usd: number;
    sum_successful_recharges_usd: number;
  } | null>(null);
  const [liveCount, setLiveCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [labelsVersion, setLabelsVersion] = useState(0);

  const [filterName, setFilterName] = useState('');
  const [filterEmail, setFilterEmail] = useState('');
  const [filterKyc, setFilterKyc] = useState('all');
  const [filterOnline, setFilterOnline] = useState<'all' | 'live'>('all');
  const [filterWallet, setFilterWallet] = useState<'all' | 'with_balance' | 'empty'>('all');
  const [filterPnl, setFilterPnl] = useState<'all' | 'profit' | 'loss'>('all');
  const [filterTag, setFilterTag] = useState('all');
  const [walletSort, setWalletSort] = useState<'high' | 'low'>('high');
  const [allTags, setAllTags] = useState<string[]>([]);
  const [openRowsByUser, setOpenRowsByUser] = useState<Record<number, UserTradeRowLike[]>>({});
  const [financeOverlay, setFinanceOverlay] = useState<Record<number, AdminFinanceOverlay>>({});

  const { currentUser } = useApp();
  const isVoiceAdmin = currentUser?.role === "admin";
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

  const fetchLocations = async (opts?: { silent?: boolean }) => {
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
  };

  useEffect(() => {
    fetchLocations();
    void fetchOpenAssignments();
    const usersPoll = window.setInterval(() => fetchLocations({ silent: true }), 10_000);
    const openPoll = window.setInterval(() => void fetchOpenAssignments(), 60_000);
    return () => {
      window.clearInterval(usersPoll);
      window.clearInterval(openPoll);
    };
  }, [fetchOpenAssignments]);

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

      const plVsDep = userPlVsDeposit(loc);
      const matchPnl =
        filterPnl === "all" ||
        (filterPnl === "profit" && plVsDep > 0.02) ||
        (filterPnl === "loss" && plVsDep < -0.02);

      return matchName && matchEmail && matchKyc && matchOnline && matchTag && matchWallet && matchPnl;
    });

    return filtered.sort((a, b) => {
      const diff = walletBalanceOf(b) - walletBalanceOf(a);
      return walletSort === "high" ? diff : -diff;
    });
  }, [locations, filterName, filterEmail, filterKyc, filterOnline, filterWallet, filterPnl, filterTag, walletSort]);

  const {
    page: userPage,
    setPage: setUserPage,
    pageItems: pagedLocations,
    totalPages: userTotalPages,
    total: filteredUserTotal,
  } = useClientPagination(filteredLocations, USER_PAGE_SIZE);

  useEffect(() => {
    setUserPage(1);
  }, [filterName, filterEmail, filterKyc, filterOnline, filterWallet, filterPnl, filterTag, walletSort, setUserPage]);

  return (
    <div className="w-full min-w-0 font-sans">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Users
            </h1>
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
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Manage accounts, wallets, addresses &amp; KYC · sorted by wallet balance
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
          <Button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="gap-2 rounded-xl bg-slate-800 text-white hover:bg-slate-900"
          >
            <UserPlus size={18} />
            Add User
          </Button>

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
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            P/L vs deposit
          </label>
          <select
            value={filterPnl}
            onChange={(e) => setFilterPnl(e.target.value as "all" | "profit" | "loss")}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="all">All users</option>
            <option value="profit">In profit</option>
            <option value="loss">In loss</option>
          </select>
        </div>
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
              setFilterPnl('all');
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
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Total received (successful payments)
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
              USD {totals.sum_successful_payments_usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="rounded-2xl border border-yellow-200 bg-[#FFF9E6]/90 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-800">
              Wallet recharges only
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-neutral-900">
              USD {totals.sum_successful_recharges_usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="rounded-2xl border border-yellow-300 bg-yellow-50/60 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-900">
              Total in user wallets now
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-neutral-900">
              USD {totals.sum_wallet_balances_usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/95">
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  User
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  Label &amp; Tags
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  Status
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  Wallet
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  Equity
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  Live P/L
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  Withdrawable
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  Recharges
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  Created
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  KYC
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  Profit %
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  Dollar cut
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  Risk profile
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  Action
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  Email
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  Mobile
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  Telegram
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  Location
                </th>
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
                  {/* User name */}
                  <td className="align-top px-4 py-3 sm:px-6 sm:py-4">
                    <button
                      type="button"
                      onClick={() => navigate(`/admin/users/${loc.id}/trades`)}
                      className="text-left font-semibold text-yellow-900 underline-offset-2 hover:underline"
                    >
                      {loc.name}
                    </button>
                    <div className="mt-0.5 font-mono text-[11px] text-slate-400">#{loc.id}</div>
                  </td>

                  {/* Label & tags */}
                  <td className="align-top px-4 py-3 sm:px-6 sm:py-4">
                    <UserLabelsDisplay
                      user={loc}
                      compact
                      onClick={() => openDetail(loc)}
                    />
                  </td>

                  {/* Status */}
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

                  {/* Wallet */}
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

                  <td className="align-top px-4 py-3 sm:px-6 sm:py-4">
                    <span className="font-semibold tabular-nums text-slate-900">
                      USD{" "}
                      {withdrawableVal.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </td>

                  {/* Recharges */}
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

                  {/* Created */}
                  <td className="align-top whitespace-nowrap px-4 py-3 text-sm text-slate-600 sm:px-6 sm:py-4">
                    {formatAdminDate(loc.created_at)}
                  </td>

                  {/* KYC */}
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

                  {/* Profit % */}
                  <td className="align-top px-4 py-3 text-sm text-slate-700 sm:px-6 sm:py-4">
                    {loc.profit_percentage != null && loc.profit_percentage !== ""
                      ? `${loc.profit_percentage}%`
                      : "—"}
                  </td>

                  {/* Dollar cut */}
                  <td className="align-top px-4 py-3 text-sm text-slate-700 sm:px-6 sm:py-4">
                    {loc.dollar_amount ? `$${loc.dollar_amount}` : "—"}
                  </td>

                  {/* Risk */}
                  <td className="align-top px-4 py-3 text-sm text-slate-700 sm:px-6 sm:py-4">
                    {renderRiskBadges(loc.risk)}
                  </td>

                  {/* Action */}
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

                  {/* Email — end columns */}
                  <td className="align-top px-4 py-3 sm:px-6 sm:py-4">
                    <div className="flex max-w-[200px] items-start gap-2">
                      <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="break-all text-xs text-slate-600">{loc.email || "—"}</span>
                    </div>
                  </td>

                  {/* Mobile */}
                  <td className="align-top whitespace-nowrap px-4 py-3 text-sm sm:px-6 sm:py-4">
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="text-slate-800">{loc.mobile || "—"}</span>
                    </div>
                  </td>

                  {/* Telegram */}
                  <td className="align-top px-4 py-3 text-sm sm:px-6 sm:py-4">
                    {loc.telegram ? (
                      <span className="inline-flex items-center rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-900">
                        @{loc.telegram}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>

                  {/* Location */}
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
                </tr>
              );
              })}
              {filteredLocations.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={18} className="px-6 py-8 text-center text-slate-500">
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
