import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  User,
  TrendingUp,
  ArrowLeftRight,
  Wallet,
  Percent,
  Share2,
  ScrollText,
  X,
  ArrowDownToLine,
} from "lucide-react";
import { cn } from "@/lib/utils";

type AdminSidebarProps = {
  mobileOpen: boolean;
  onClose: () => void;
};

const AdminSidebar = ({ mobileOpen, onClose }: AdminSidebarProps) => {
  const menu = [
    { name: "Dashboard", icon: LayoutDashboard, path: "/admin/dashboard" },
    { name: "Profile", icon: User, path: "/admin/profile" },
    { name: "Open/Close Trades", icon: TrendingUp, path: "/admin/open-trades" },
    { name: "Users", icon: Users, path: "/admin/users" },
    { name: "Transactions", icon: ArrowLeftRight, path: "/admin/transactions" },
    { name: "Wallet recharges", icon: Wallet, path: "/admin/recharge" },
    { name: "Withdrawals", icon: ArrowDownToLine, path: "/admin/withdrawals" },
    { name: "Affiliate rules", icon: Percent, path: "/admin/affiliate-rules" },
    { name: "Referrals", icon: Share2, path: "/admin/referrals" },
    { name: "Wallet ledger", icon: ScrollText, path: "/admin/wallet-ledger" },
  ];

  return (
    <>
      <button
        type="button"
        aria-label="Close menu"
        className={cn(
          "fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-[1px] transition-opacity md:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        tabIndex={mobileOpen ? 0 : -1}
        onClick={onClose}
      />

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex max-h-[100dvh] min-h-0 w-[min(17rem,88vw)] flex-col justify-between overflow-y-auto overscroll-contain border-r border-slate-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl transition-transform duration-300 ease-out sm:p-5 md:z-30 md:h-screen md:w-64 md:max-h-none md:translate-x-0 md:overflow-visible md:shadow-sm",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="relative min-h-0 flex-1">
          <button
            type="button"
            className="absolute right-0 top-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden"
            aria-label="Close menu"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>

          <div className="mb-8 pr-10 md:pr-0">
            <h1 className="font-sans text-lg font-bold text-neutral-900 sm:text-xl">Admin Panel</h1>
          </div>

          <nav className="flex flex-col gap-1 sm:gap-2" aria-label="Admin navigation">
            {menu.map((item, i) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={i}
                  to={item.path}
                  onClick={() => onClose()}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all touch-manipulation",
                      isActive
                        ? "bg-neutral-950 text-[#FFD700]"
                        : "text-slate-600 hover:bg-yellow-50 active:bg-yellow-50",
                    )
                  }
                >
                  <Icon size={18} className="shrink-0" />
                  {item.name}
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="mt-6 shrink-0 pb-2 text-center text-[10px] text-slate-400 sm:text-xs">
          © 2026 MT5 Panel
        </div>
      </aside>
    </>
  );
};

export default AdminSidebar;
