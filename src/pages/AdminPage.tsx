import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin, ArrowLeft, RefreshCw, AlertTriangle, UserPlus, Wallet
} from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { useApp } from '@/context/AppContext'; // Imported from your context

import EditUserModal from '../components/admin/EditUserModal';
import AddUserModal from '../components/admin/AddUserModal';
import WalletModal from '../components/admin/WalletModal'; 

const API_BASE = 'https://mt5api.inditechit.com/api';

const AdminPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useApp(); // Accessing context if needed

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
      console.log(data.users)
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
        "country", "state", "city", "pincode", "profit_percentage"
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
    <>
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Admin Panel
            </h1>
            <p className="text-slate-500 text-sm">
              Manage system data & monitoring
            </p>
          </div>

          <div className="flex gap-3 items-center">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-slate-800 text-white font-bold hover:bg-slate-900 transition flex items-center gap-2"
            >
              <UserPlus size={18} />
              Add User
            </button>

            <button
              onClick={fetchLocations}
              disabled={isLoading}
              className="px-5 py-2.5 rounded-xl bg-cyan-600 text-white font-bold hover:bg-cyan-700 transition flex items-center gap-2"
            >
              <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
              Refresh
            </button>
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
                <tr className="bg-slate-50 border-b">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500">Username</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500">Contact</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500">Wallet</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500">Location</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500">Created</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500">Profit %</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 text-right">Action</th>
                </tr>
              </thead>

              <tbody>
                {locations.map((loc, i) => (
                  <tr key={i} className="hover:bg-cyan-50/30 transition">

                    {/* Username */}
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">{loc.name}</div>
                      <div className="text-xs text-slate-500">{loc.email}</div>
                    </td>

                    {/* Contact */}
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <div>{loc.mobile}</div>
                      <div className="text-xs text-cyan-600">@{loc.telegram}</div>
                    </td>

                    {/* Wallet balance */}
                    <td className="px-6 py-4">
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

                    {/* Location */}
                    <td className="px-6 py-4">
                      {loc.address ? (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 max-w-xs">
                          <p className="text-xs text-slate-800 leading-relaxed break-words">
                            {loc.address}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">No address</span>
                      )}
                    </td>

                    {/* Created */}
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {formatDate(loc.created_at)}
                    </td>

                    {/* Profit % */}
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {loc.profit_percentage ? `${loc.profit_percentage}%` : "-"}
                    </td>

                    {/* ✅ ACTION BUTTONS (Wallet & Edit side-by-side) */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* WALLET BUTTON */}
                        <button
                          onClick={() => handleOpenWalletModal(loc)}
                          className="px-3 py-2 flex items-center gap-1 bg-emerald-50 text-emerald-600 text-sm font-bold rounded-lg hover:bg-emerald-100 transition"
                          title="Manage Wallet Balance"
                        >
                          <Wallet size={16} />
                          Wallet
                        </button>

                        {/* EDIT BUTTON */}
                        <button
                          onClick={() => {
                            setSelectedUser(loc);   
                            setIsModalOpen(true);   
                          }}
                          className="px-3 py-2 bg-amber-50 text-amber-600 text-sm font-bold rounded-lg hover:bg-amber-100 transition"
                        >
                          Edit
                        </button>
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

        {/* ✅ WALLET MODAL */}
        <WalletModal
          isOpen={isWalletModalOpen}
          onClose={() => setIsWalletModalOpen(false)}
          user={walletUser}
          initialBalance={walletBalance}
          onUpdate={handleUpdateWallet}
          isLoading={isWalletLoading}
        />

      </div>
    </>
  );
};

export default AdminPage;