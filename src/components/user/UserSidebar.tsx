import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  TrendingUp,
  ArrowLeftRight,
  Wallet,
  ClipboardList,
  Share2,
  User,
  X,
  ArrowDownToLine,
  LifeBuoy,
  BarChart3,
} from "lucide-react";
import { useEffect, useState } from "react";
import axios from "axios";
import { useApp } from "@/context/AppContext";
import { cn } from "@/lib/utils";

type UserSidebarProps = {
  mobileOpen: boolean;
  onClose: () => void;
};

const UserSidebar = ({ mobileOpen, onClose }: UserSidebarProps) => {
  const [wallet, setWallet] = useState(null);

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

    fetchWallet();
  }, [currentUser]);

  const menu = [
    { name: "Dashboard", icon: LayoutDashboard, path: "/user/dashboard" },
    { name: "My Trades", icon: TrendingUp, path: "/user/my-trades" },
    { name: "Profit & Loss", icon: BarChart3, path: "/user/pnl" },
    { name: "Transactions", icon: ArrowLeftRight, path: "/user/transactions" },
    { name: "Order History", icon: ClipboardList, path: "/user/trade-history" },
    { name: "Recharge Wallet", icon: Wallet, path: "/user/recharge" },
    { name: "Withdraw USDT", icon: ArrowDownToLine, path: "/user/withdraw" },
    { name: "Affiliate", icon: Share2, path: "/user/affiliate" },
    { name: "Support", icon: LifeBuoy, path: "/user/support" },
    { name: "Profile", icon: User, path: "/user/profile" },
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
          "fixed left-0 top-0 z-50 flex max-h-[100dvh] min-h-0 w-[min(17rem,88vw)] flex-col justify-between overflow-y-auto overscroll-contain border-r border-slate-200/80 bg-[#F9F9F9] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-none transition-transform duration-300 ease-out sm:p-5 md:z-40 md:h-screen md:w-64 md:max-h-none md:translate-x-0 md:shadow-sm",
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

          <div className="mb-6 pr-10 md:pr-0">
            <h1 className="text-lg font-bold text-neutral-900 sm:text-xl">User Panel</h1>
          </div>

          <div className="mb-6 rounded-lg bg-[#F2F2F2] p-3 text-neutral-900 sm:mb-8 sm:p-4">
            <p className="text-xs font-medium text-neutral-600">My Fund</p>

            <h2 className="mt-1 text-lg font-bold tabular-nums text-neutral-900 sm:text-xl">
              {!currentUser
                ? "Loading user..."
                : !wallet
                  ? "Loading wallet..."
                  : `${wallet.currency} ${Number(wallet.balance).toFixed(2)}`}
            </h2>
          </div>

          <nav className="flex flex-col gap-1 sm:gap-2" aria-label="User navigation">
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
                        ? "bg-[#FFD700] text-black"
                        : "text-slate-600 hover:bg-white/80 active:bg-white",
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

export default UserSidebar;
