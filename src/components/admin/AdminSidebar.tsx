import { useEffect, useState } from "react";
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
  Headphones,
  Map as MapIcon,
  Construction,
  Tag,
  Package,
  Bell,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE = "https://api.copytradeengine.org/api";

type AdminSidebarProps = {
  mobileOpen: boolean;
  onClose: () => void;
};

const AdminSidebar = ({ mobileOpen, onClose }: AdminSidebarProps) => {
  const [liveCount, setLiveCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/users/presence`);
        const data = await res.json();
        if (!cancelled && data?.success) {
          setLiveCount(Number(data.live_count ?? 0));
        }
      } catch {
        // best-effort; leave previous value in place
      }
    };
    load();
    const id = window.setInterval(load, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const menu = [
    { name: "Dashboard", icon: LayoutDashboard, path: "/admin/dashboard" },
    { name: "Profile", icon: User, path: "/admin/profile" },
    { name: "Open/Close Trades", icon: TrendingUp, path: "/admin/open-trades" },
    { name: "Users", icon: Users, path: "/admin/users", showLive: true },
    { name: "User map", icon: MapIcon, path: "/admin/user-map" },
    { name: "Transactions", icon: ArrowLeftRight, path: "/admin/transactions" },
    { name: "Wallet recharges", icon: Wallet, path: "/admin/recharge" },
    { name: "Withdrawals", icon: ArrowDownToLine, path: "/admin/withdrawals" },
    { name: "Support tickets", icon: Headphones, path: "/admin/support-tickets" },
    { name: "Notifications", icon: Bell, path: "/admin/notifications" },
    { name: "Packages", icon: Package, path: "/admin/packages" },
    { name: "Coupons", icon: Tag, path: "/admin/coupons" },
    { name: "Invoices", icon: FileText, path: "/admin/invoices" },
    { name: "User maintenance", icon: Construction, path: "/admin/maintenance" },
    { name: "Affiliate rules", icon: Percent, path: "/admin/affiliate-rules" },
    { name: "Refer a friend", icon: Share2, path: "/admin/referrals" },
    { name: "Wallet ledger", icon: ScrollText, path: "/admin/wallet-ledger" },
  ] as Array<{ name: string; icon: any; path: string; showLive?: boolean }>;

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
                        ? "bg-[#FFD700] text-black"
                        : "text-slate-600 hover:bg-white/80 active:bg-white",
                    )
                  }
                >
                  <Icon size={18} className="shrink-0" />
                  <span className="flex-1">{item.name}</span>
                  {item.showLive && liveCount != null && liveCount > 0 && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800"
                      title="Users seen in the last 90 seconds"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {liveCount}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="mt-6 shrink-0 pb-2 text-center text-[10px] text-slate-400 sm:text-xs">
          © 2026 Copy Trade Engine
        </div>
      </aside>
    </>
  );
};

export default AdminSidebar;
