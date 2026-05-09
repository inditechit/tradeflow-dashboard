import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw,
  UserPlus,
  Wallet,
  User,
  Pencil,
  MapPin,
  History,
} from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

import EditUserModal from '../components/admin/EditUserModal';
import AddUserModal from '../components/admin/AddUserModal';
import WalletModal from '../components/admin/WalletModal';
import { Button } from "@/components/ui/button";

const API_BASE = 'https://mt5api.inditechit.com/api';

function kycBadgeStyles(status: string | undefined | null) {
  const s = String(status ?? "pending").toLowerCase();
  if (s === "verified") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (s === "submitted") return "border-amber-200 bg-amber-50 text-amber-900";
  if (s === "rejected") return "border-red-200 bg-red-50 text-red-900";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function parseCoord(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

function userHasMapLink(loc: { latitude?: unknown; longitude?: unknown; address?: unknown }): boolean {
  const lat = parseCoord(loc.latitude);
  const lng = parseCoord(loc.longitude);
  if (lat != null && lng != null) return true;
  const addr = loc.address != null ? String(loc.address).trim() : "";
  return addr.length > 0;
}

const AdminPage = () => {
  const navigate = useNavigate();

  const [locations, setLocations] = useState<any[]>([]);
  const [totals, setTotals] = useState<{
    sum_wallet_balances_usd: number;
    sum_successful_payments_usd: number;
    sum_successful_recharges_usd: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // USER MODAL STATES 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // ✅ WALLET MODAL STATES
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [walletUser, setWalletUser] = useState<any>(null);
  const [walletBalance, setWalletBalance] = useState<number | string>("");
  const [isWalletLoading, setIsWalletLoading] = useState(false);

  const { toast } = useToast();

  const fetchLocations = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/admin/users`);
      const data = await response.json();
      if (data.success) {
        setLocations(data.users);
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
        setError(data.error || 'Failed to fetch data.');
      }
    } catch (err) {
      setError('Server connection error.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleString();
  };

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

  // ADD USER LOGIC
  const handleAddUser = async (newUser: any) => {
    try {
      const res = await fetch(`${API_BASE}/admin/add-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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

  // UPDATE USER LOGIC
  const handleUpdate = async (updatedUser: any) => {
    try {
      if (!updatedUser?.id) return alert("User ID missing ❌");
      const payload: any = {};
      const allowedFields = [
        "password", "email", "photo", "name", "mobile", "telegram", 
        "country", "state", "city", "pincode", "profit_percentage" , "dollar_amount"
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

  // ✅ OPEN WALLET MODAL & FETCH CURRENT BALANCE
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
        setWalletBalance(""); // Default to empty/0 if no wallet found
      }
    } catch (err) {
      console.error("Fetch Wallet Error:", err);
      setWalletBalance("");
    } finally {
      setIsWalletLoading(false);
    }
  };

  // ✅ SAVE WALLET BALANCE
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

  

  return (
    <div className="w-full min-w-0 font-sans">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Users
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Manage accounts, wallets, addresses &amp; KYC
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
              onClick={fetchLocations}
              disabled={isLoading}
              className="gap-2 rounded-xl bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-70"
            >
              <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600">
            {error}
          </div>
        )}

        {/* Totals */}
        {totals && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Total received (successful payments)
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
                USD {totals.sum_successful_payments_usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                All completed payment rows (recharges, packages, tours).
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                Wallet recharges only
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-900">
                USD {totals.sum_successful_recharges_usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="mt-1 text-xs text-emerald-800/80">
                Successful top-ups to user wallets.
              </p>
            </div>
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50/60 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-800">
                Total in user wallets now
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-cyan-900">
                USD {totals.sum_wallet_balances_usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="mt-1 text-xs text-cyan-800/80">
                Sum of current balances across all users.
              </p>
            </div>
          </div>
        )}

        {/* TABLE */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">

              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/95">
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                    Contact
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                    Wallet
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                    Recharges
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                    Location
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                    Created
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                    KYC
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                    Profit %
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                    Dollar cut
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {locations.map((loc, i) => (
                  <tr key={i} className="border-b border-slate-100 transition hover:bg-cyan-50/40">

                    {/* Username */}
                    <td className="align-top px-4 py-3 sm:px-6 sm:py-4">
                      <div className="font-semibold text-slate-900">{loc.name}</div>
                      <div className="break-all text-xs text-slate-500">{loc.email}</div>
                    </td>

                    {/* Contact */}
                    <td className="align-top px-4 py-3 text-sm text-slate-600 sm:px-6 sm:py-4">
                      <div className="text-slate-800">{loc.mobile}</div>
                      <div className="text-xs text-cyan-700">@{loc.telegram}</div>
                    </td>

                    {/* Wallet balance */}
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

                    {/* Recharge stats (successful wallet top-ups) */}
                    <td className="align-top px-4 py-3 sm:px-6 sm:py-4">
                      <div className="space-y-1.5">
                        <div className="font-semibold tabular-nums text-slate-900">
                          {Number(loc.recharge_success_count ?? 0)}×{" "}
                          <span className="font-normal text-slate-600">success</span>
                        </div>
                        <div className="text-xs tabular-nums font-medium text-emerald-800">
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
                          className="h-8 gap-1 px-2 text-xs font-semibold text-cyan-700 hover:bg-cyan-50 hover:text-cyan-900"
                          title="Open recharge history for this user"
                          onClick={() => navigate(`/admin/recharge?userId=${loc.id}`)}
                        >
                          <History className="h-3.5 w-3.5" />
                          History
                        </Button>
                      </div>
                    </td>

                    {/* Location — click opens Google Maps (pin from lat/lng, else search by address) */}
                    <td className="align-top px-4 py-3 sm:px-6 sm:py-4">
                      {userHasMapLink(loc) ? (
                        <button
                          type="button"
                          onClick={() => openUserLocationOnMap(loc)}
                          className="group w-full max-w-full rounded-lg border border-cyan-200 bg-white px-3 py-2 text-left shadow-sm transition hover:border-cyan-400 hover:bg-cyan-50/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-1 sm:max-w-[260px]"
                          title="Open Google Maps with this location marked"
                        >
                          <div className="flex gap-2">
                            <MapPin
                              className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600 group-hover:text-cyan-700"
                              aria-hidden
                            />
                            <div className="min-w-0 flex-1">
                              {loc.address ? (
                                <div className="max-h-24 overflow-y-auto text-xs leading-snug text-slate-800">
                                  {loc.address}
                                </div>
                              ) : (
                                <div className="text-xs">
                                  <span className="font-medium text-cyan-900">Saved coordinates</span>
                                  <span className="mt-0.5 block font-mono text-[11px] text-slate-600">
                                    {parseCoord(loc.latitude)?.toFixed(5)},{" "}
                                    {parseCoord(loc.longitude)?.toFixed(5)}
                                  </span>
                                </div>
                              )}
                              <span className="mt-1.5 block text-[10px] font-semibold uppercase tracking-wide text-cyan-600">
                                Open map
                              </span>
                            </div>
                          </div>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">No location</span>
                      )}
                    </td>

                    {/* Created */}
                    <td className="align-top whitespace-nowrap px-4 py-3 text-sm text-slate-600 sm:px-6 sm:py-4">
                      {formatDate(loc.created_at)}
                    </td>

                    {/* KYC */}
                    <td className="align-top px-4 py-3 sm:px-6 sm:py-4">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${kycBadgeStyles(loc.kyc_status)}`}
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

                    {/* Dollar Cut */}
                    <td className="align-top px-4 py-3 text-sm text-slate-700 sm:px-6 sm:py-4">
                      {loc.dollar_amount ? `$${loc.dollar_amount}` : "—"}
                    </td>

                    {/* Actions */}
                    <td className="align-top px-4 py-3 text-right sm:px-6 sm:py-4">
                      <div className="flex flex-col items-stretch justify-end gap-1.5 sm:flex-row sm:flex-wrap sm:justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 gap-1.5 border-slate-200 bg-white font-semibold text-slate-800 hover:bg-slate-50"
                          title="Profile & KYC"
                          onClick={() => navigate(`/admin/user-profile/${loc.id}`)}
                        >
                          <User className="h-4 w-4" />
                          Profile
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 gap-1.5 border-emerald-200 bg-emerald-50 font-semibold text-emerald-800 hover:bg-emerald-100"
                          title="Manage wallet balance"
                          onClick={() => handleOpenWalletModal(loc)}
                        >
                          <Wallet className="h-4 w-4" />
                          Wallet
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 gap-1.5 border-amber-200 bg-amber-50 font-semibold text-amber-900 hover:bg-amber-100"
                          onClick={() => {
                            setSelectedUser(loc);
                            setIsModalOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Button>
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>

            </table>
          </div>
        </div>

        {/* MODALS */}
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

        {/* WALLET MODAL */}
        <WalletModal
          isOpen={isWalletModalOpen}
          onClose={() => setIsWalletModalOpen(false)}
          user={walletUser}
          initialBalance={walletBalance}
          onUpdate={handleUpdateWallet}
          isLoading={isWalletLoading}
        />

    </div>
  );
};

export default AdminPage;