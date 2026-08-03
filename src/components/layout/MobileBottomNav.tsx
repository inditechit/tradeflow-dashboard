import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  CandlestickChart,
  Users,
  User,
  Menu,
  History,
  Wallet,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

export type MobileTab = {
  id: string;
  label: string;
  to?: string;
  icon: LucideIcon;
  isMenu?: boolean;
};

export const ADMIN_MOBILE_TABS: MobileTab[] = [
  { id: "home", label: "Home", to: "/admin/dashboard", icon: LayoutDashboard },
  { id: "trade", label: "Trade", to: "/admin/open-trades", icon: CandlestickChart },
  { id: "users", label: "Users", to: "/admin/users", icon: Users },
  { id: "settings", label: "Settings", to: "/admin/settings", icon: User },
  { id: "menu", label: "Menu", icon: Menu, isMenu: true },
];

export const USER_MOBILE_TABS: MobileTab[] = [
  { id: "home", label: "Home", to: "/user/dashboard", icon: LayoutDashboard },
  { id: "trades", label: "Trades", to: "/user/trade-history", icon: History },
  { id: "wallet", label: "Wallet", to: "/user/wallet-payments", icon: Wallet },
  { id: "settings", label: "Settings", to: "/user/settings", icon: User },
  { id: "menu", label: "Menu", icon: Menu, isMenu: true },
];

type Props = {
  tabs: MobileTab[];
  onMenuClick: () => void;
  menuOpen?: boolean;
};

function isTabActive(to: string, pathname: string) {
  if (to === "/admin/users") {
    return pathname === "/admin/users" || pathname.startsWith("/admin/users/");
  }
  return pathname === to || pathname.startsWith(`${to}/`);
}

/** Fixed bottom tab bar for mobile app shell (`md:hidden`). */
export function MobileBottomNav({ tabs, onMenuClick, menuOpen = false }: Props) {
  const { pathname } = useLocation();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      <ul className="mx-auto flex h-12 max-w-lg items-stretch justify-between px-0.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          if (tab.isMenu) {
            return (
              <li key={tab.id} className="flex min-w-0 flex-1">
                <button
                  type="button"
                  onClick={onMenuClick}
                  className={cn(
                    "flex w-full flex-col items-center justify-center gap-0 touch-manipulation rounded-lg px-0.5 text-[9px] font-semibold transition-colors",
                    menuOpen ? "text-amber-900" : "text-slate-500 active:text-slate-800",
                  )}
                  aria-label="Open menu"
                  aria-expanded={menuOpen}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full",
                      menuOpen && "bg-[#FFD700]/80",
                    )}
                  >
                    <Icon className="h-4 w-4" strokeWidth={menuOpen ? 2.4 : 2} />
                  </span>
                  {tab.label}
                </button>
              </li>
            );
          }

          const active = isTabActive(tab.to!, pathname);
          return (
            <li key={tab.id} className="flex min-w-0 flex-1">
              <NavLink
                to={tab.to!}
                className={cn(
                  "flex w-full flex-col items-center justify-center gap-0 touch-manipulation rounded-lg px-0.5 text-[9px] font-semibold transition-colors",
                  active ? "text-amber-900" : "text-slate-500 active:text-slate-800",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full",
                    active && "bg-[#FFD700]/80",
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={active ? 2.4 : 2} />
                </span>
                {tab.label}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
