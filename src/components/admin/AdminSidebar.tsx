import { NavLink } from "react-router-dom";
import { 
  LayoutDashboard, Users, TrendingUp 
} from "lucide-react";

const AdminSidebar = () => {
  const menu = [
    { name: "Dashboard", icon: LayoutDashboard, path: "/admin/dashboard" },
    { name: "Open Trades", icon: TrendingUp, path: "/admin/open-trades" },
    { name: "Users", icon: Users, path: "/admin/users" },
  ];

  return (
    <div className="h-screen w-64 bg-white border-r border-slate-200 shadow-sm fixed left-0 top-0 p-5">
      
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
  );
};

export default AdminSidebar;