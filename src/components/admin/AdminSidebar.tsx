import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  User,
  TrendingUp,
  ArrowLeftRight,
  Wallet,
  LogOut,
  Percent,
  Share2,
  ScrollText,
} from "lucide-react";
import { useApp } from "@/context/AppContext";

const AdminSidebar = () => {
  const { setCurrentUser } = useApp();
  const navigate = useNavigate();

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("mt5_user");
    localStorage.removeItem("mt5_packages");
    navigate("/login");
  };

  const menu = [
    { name: "Dashboard", icon: LayoutDashboard, path: "/admin/dashboard" },
    { name: "Profile", icon: User, path: "/admin/profile" },
    { name: "Open/Close Trades", icon: TrendingUp, path: "/admin/open-trades" },
    { name: "Users", icon: Users, path: "/admin/users" },
    { name: "Transactions", icon: ArrowLeftRight, path: "/admin/transactions" },
    { name: "Recharge", icon: Wallet, path: "/admin/recharge" },
    { name: "Affiliate rules", icon: Percent, path: "/admin/affiliate-rules" },
    { name: "Referrals", icon: Share2, path: "/admin/referrals" },
    { name: "Wallet ledger", icon: ScrollText, path: "/admin/wallet-ledger" },
  ];

  return (
    <div className="h-screen w-64 bg-white border-r border-slate-200 shadow-sm fixed left-0 top-0 p-5 flex flex-col justify-between">

      {/* Top Section */}
      <div>
        {/* Logo */}
        <div className="mb-10">
          <h1 className="text-xl font-bold text-cyan-600">Admin Panel</h1>
          <p className="text-xs text-slate-400">MT5 Control</p>
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

      {/* 🔥 Logout Button */}
      <div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-all"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </div>
  );
};

export default AdminSidebar;