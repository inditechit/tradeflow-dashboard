import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw,
  UserPlus,
  MoreHorizontal,
} from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

import EditUserModal from '../components/admin/EditUserModal';
import AddUserModal from '../components/admin/AddUserModal';
import WalletModal from '../components/admin/WalletModal';
import AdminVoicePanel from '../components/admin/AdminVoicePanel';
import UserDetailDialog from '../components/admin/UserDetailDialog';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useApp } from "@/context/AppContext";
import { API_BASE } from "@/config/api";
import {
  formatAdminDate,
  kycBadgeStyles,
  parseCoord,
  walletBalanceOf,
} from "@/utils/adminUserDisplay";
import {
  getAllUsedTags,
  getUserLabels,
  tagColorClass,
} from "@/utils/adminUserLabels";

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
  const [filterTag, setFilterTag] = useState('all');
  const [walletSort, setWalletSort] = useState<'high' | 'low'>('high');

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

  const { toast } = useToast();

  const fetchLocations = async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/admin/users`);
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
    const id = window.setInterval(() => fetchLocations({ silent: true }), 30_000);
    return () => window.clearInterval(id);
  }, []);

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

  const allTags = useMemo(() => getAllUsedTags(), [labelsVersion]);

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
        const userTags = getUserLabels(loc.id).tags;
        matchTag = userTags.includes(filterTag);
      }

      return matchName && matchEmail && matchKyc && matchOnline && matchTag;
    });

    return filtered.sort((a, b) => {
      const diff = walletBalanceOf(b) - walletBalanceOf(a);
      return walletSort === "high" ? diff : -diff;
    });
  }, [locations, filterName, filterEmail, filterKyc, filterOnline, filterTag, walletSort, labelsVersion]);

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
            Sorted by wallet balance · click Manage for full details
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

      <div className="mb-6 grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-6">
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
        <div className="flex items-end sm:col-span-2 lg:col-span-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setFilterName('');
              setFilterEmail('');
              setFilterKyc('all');
              setFilterOnline('all');
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
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  Wallet
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  Recharge
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  Created
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  KYC
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredLocations.map((loc) => {
                const userLabels = getUserLabels(loc.id);
                return (
                  <tr key={loc.id} className="border-b border-slate-100 transition hover:bg-yellow-50/40">
                    <td className="align-top px-4 py-3 sm:px-6 sm:py-4">
                      <div className="font-semibold text-slate-900">{loc.name}</div>
                      <div className="break-all text-xs text-slate-500">{loc.email}</div>
                      {userLabels.label && (
                        <p className="mt-1 text-xs font-medium text-indigo-700">{userLabels.label}</p>
                      )}
                      {userLabels.tags.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {userLabels.tags.map((tag) => (
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
                      )}
                    </td>

                    <td className="align-top px-4 py-3 sm:px-6 sm:py-4">
                      <div className="font-semibold tabular-nums text-slate-900">
                        {loc.wallet_currency ?? "USD"}{" "}
                        {Number(loc.wallet_balance ?? 0).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </td>

                    <td className="align-top px-4 py-3 sm:px-6 sm:py-4">
                      <div className="font-semibold tabular-nums text-slate-900">
                        {Number(loc.recharge_success_count ?? 0)}×
                      </div>
                      <div className="text-xs tabular-nums text-slate-600">
                        USD{" "}
                        {Number(loc.recharge_total_usd ?? 0).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </td>

                    <td className="align-top whitespace-nowrap px-4 py-3 text-sm text-slate-600 sm:px-6 sm:py-4">
                      {formatAdminDate(loc.created_at)}
                    </td>

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
                  </tr>
                );
              })}
              {filteredLocations.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    No users match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
        onLabelsUpdated={() => setLabelsVersion((v) => v + 1)}
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
