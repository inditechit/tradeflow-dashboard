import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  TrendingUp,
  ArrowLeftRight,
  Wallet,
  ClipboardList,
} from "lucide-react";
import { useEffect, useState } from "react";
import axios from "axios";
import { useApp } from "@/context/AppContext";

const UserSidebar = () => {
  const [wallet, setWallet] = useState(null);
  const [profitSplitPct, setProfitSplitPct] = useState<string | null>(null);

  const { currentUser } = useApp();

  const API_BASE = "https://mt5api.inditechit.com/api";

  useEffect(() => {
    if (!currentUser?.userId) return;

    const fetchWallet = async () => {
      try {
        const res = await axios.get(
          `${API_BASE}/user/wallet/${currentUser.userId}`
        );
        setWallet(res.data.wallet);
      } catch (err) {
        console.error("Wallet fetch error:", err);
      }
    };

    const fetchProfitSplit = async () => {
      if (currentUser.role === "admin") return;
      try {
        const res = await fetch(
          `${API_BASE}/user/profit/${currentUser.userId}`
        );
        const data = await res.json();
        if (data.success && data.profit_percentage != null) {
          setProfitSplitPct(String(data.profit_percentage));
        }
      } catch (err) {
        console.error("Profit % fetch error:", err);
      }
    };

    fetchWallet();
    fetchProfitSplit();
  }, [currentUser]);

  const menu = [
    { name: "Dashboard", icon: LayoutDashboard, path: "/user/dashboard" },
    { name: "My Trades", icon: TrendingUp, path: "/user/my-trades" },
    { name: "Transactions", icon: ArrowLeftRight, path: "/user/transactions" },
    { name: "Order History", icon: ClipboardList, path: "/user/trade-history" },
    { name: "Recharge Wallet", icon: Wallet, path: "/user/recharge" },
  ];

  return (
    <div className="h-screen w-64 bg-white border-r border-slate-200 shadow-sm fixed left-0 top-0 p-5 flex flex-col justify-between">
      <div>
        {/* Logo */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-cyan-600">User Panel</h1>
          <p className="text-xs text-slate-400">MT5 Control</p>
        </div>

        {/* 💰 Wallet Card */}
        <div className="mb-8 p-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg">
          <p className="text-xs opacity-80">My Fund</p>

          <h2 className="text-xl font-bold mt-1">
            {!currentUser
              ? "Loading user..."
              : !wallet
              ? "Loading wallet..."
              : `${wallet.currency} ${Number(wallet.balance).toFixed(2)}`}
          </h2>
          {currentUser?.role !== "admin" && profitSplitPct != null && (
            <p className="mt-2 text-sm font-medium text-white/90">
              Your profit share: {profitSplitPct}%
            </p>
          )}
        </div>

        {/* Menu */}
        <div className="flex flex-col gap-2">
          {menu.map((item, i) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={i}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
                  ${
                    isActive
                      ? "bg-cyan-50 text-cyan-600"
                      : "text-slate-600 hover:bg-slate-100"
                  }`
                }
              >
                <Icon size={18} />
                {item.name}
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="text-xs text-slate-400 text-center">
        © 2026 MT5 Panel
      </div>
    </div>
  );
};

export default UserSidebar;