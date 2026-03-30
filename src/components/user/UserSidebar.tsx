import { NavLink } from "react-router-dom";
import { 
  LayoutDashboard, Users, TrendingUp, ArrowLeftRight, Wallet 
} from "lucide-react";
import { useEffect, useState } from "react";
import axios from "axios";

const UserSidebar = () => {

  const [wallet, setWallet] = useState(null);

  const userData = JSON.parse(localStorage.getItem("mt5_user"));
  const userId = userData?.userId;

  const API_BASE = "https://mt5api.inditechit.com/api";

  useEffect(() => {
    const fetchWallet = async () => {
      try {
        const res = await axios.get(`${API_BASE}/user/wallet/${userId}`);
        setWallet(res.data.wallet);
        console.log("Wallet data", res.data.wallet);
      } catch (err) {
        console.error("Wallet fetch error", err);
      }
    };

    if (userId) fetchWallet();
  }, [userId]);

  const menu = [
    { name: "Dashboard", icon: LayoutDashboard, path: "/user/dashboard" },
    { name: "My Trades", icon: TrendingUp, path: "/user/my-trades" },
    { name: "Transactions", icon: ArrowLeftRight, path: "/user/transactions" },
    { name: "Investments", icon: Wallet, path: "/user/recharge" },
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
          <p className="text-xs opacity-80">Investment Amount</p>

          <h2 className="text-xl font-bold mt-1">
            {wallet
              ? `${wallet.currency} ${Number(wallet.balance).toFixed(2)}`
              : "Loading..."}
          </h2>

          <p className="text-[10px] opacity-70 mt-1">
            Available for trading
          </p>
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

      {/* Bottom small info */}
      <div className="text-xs text-slate-400 text-center">
        © 2026 MT5 Panel
      </div>
    </div>
  );
};

export default UserSidebar;