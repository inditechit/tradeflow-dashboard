import { NavLink } from "react-router-dom";
import { 
  LayoutDashboard, Users, TrendingUp, ArrowLeftRight, Wallet 
} from "lucide-react";

const UserSidebar = () => {
  const menu = [
    { name: "Dashboard", icon: LayoutDashboard, path: "/user/dashboard" },
    { name: "My Trades", icon: TrendingUp, path: "/user/my-trades" },
    { name: "P&L", icon: Users, path: "/user/pnl" },
    { name: "Transactions", icon: ArrowLeftRight, path: "/user/transactions" },
    { name: "Recharge", icon: Wallet, path: "/user/recharge" },
  ];

  return (
    <div className="h-screen w-64 bg-white border-r border-slate-200 shadow-sm fixed left-0 top-0 p-5">
      
      {/* Logo */}
      <div className="mb-10">
        <h1 className="text-xl font-bold text-cyan-600">User Panel</h1>
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
  );
};

export default UserSidebar;