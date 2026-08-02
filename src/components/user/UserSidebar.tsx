import { NavLink, useNavigate } from "react-router-dom";
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
  Package,
  ShieldAlert,
  FileText,
  Bell,
  PanelLeftClose,
  LogOut,
} from "lucide-react";
import { useEffect, useState } from "react";
import axios from "axios";
import { useApp } from "@/context/AppContext";
import { cn } from "@/lib/utils";
import { useSubscription } from "@/context/SubscriptionContext";
import { useProfileCompliance } from "@/context/ProfileComplianceContext";
import { API_BASE } from "@/config/api";

type UserSidebarProps = {
  mobileOpen: boolean;
  onClose: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
};

const REQUIRED_SETUP_PATH = "/user/required-setup";
const PACKAGES_PATH = "/packages";

type SidebarWallet = {
  currency: string;
  balance: number;
};

const UserSidebar = ({
  mobileOpen,
  onClose,
  collapsed = false,
  onToggleCollapse,
}: UserSidebarProps) => {
  const [accountWallet, setAccountWallet] = useState<SidebarWallet | null>(null);
  const [supportUnread, setSupportUnread] = useState<number | null>(null);
  const navigate = useNavigate();
  const { currentUser, logout } = useApp();
  const { loading: subLoading, fetchOk: subOk, isActive, accessRestricted } =
    useSubscription();
  const { loading: cLoading, fetchOk: cOk, complete: cComplete } =
    useProfileCompliance();

  const complianceLocked =
    !subLoading &&
    Boolean(subOk) &&
    isActive &&
    !accessRestricted &&
    !cLoading &&
    cOk &&
    !cComplete;

  useEffect(() => {
    if (!currentUser?.userId) return;

    const fetchWallet = async () => {
      try {
        const res = await axios.get(`${API_BASE}/user/summary/${currentUser.userId}`);
        const data = res.data;
        if (!data?.success) return;
        setAccountWallet({
          currency: data.currency ?? "USD",
          balance: Math.max(0, Number(data.wallet_balance ?? 0)),
        });
      } catch (err) {
        console.error("Wallet fetch error:", err);
      }
    };

    fetchWallet();
    const id = window.setInterval(fetchWallet, 10_000);
    return () => window.clearInterval(id);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser?.userId) return;

    let cancelled = false;
    const loadUnread = async () => {
      try {
        const res = await fetch(`${API_BASE}/user/support/${currentUser.userId}/unread-count`);
        const data = await res.json();
        if (!cancelled && data?.success) {
          setSupportUnread(Number(data.unread_tickets ?? data.unread_count ?? 0));
        }
      } catch {
        // best-effort; leave previous value in place
      }
    };

    loadUnread();
    const id = window.setInterval(loadUnread, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [currentUser?.userId]);

  const menu = [
    { name: "Dashboard", icon: LayoutDashboard, path: "/user/dashboard" },
    { name: "History", icon: BarChart3, path: "/user/transactions" },
    { name: "Wallet payments", icon: ArrowLeftRight, path: "/user/wallet-payments" },
    { name: "Trade history", icon: ClipboardList, path: "/user/trade-history" },
    { name: "Add Fund", icon: Wallet, path: "/user/recharge" },
    { name: "Withdraw USDT", icon: ArrowDownToLine, path: "/user/withdraw" },
    { name: "Refer a friend", icon: Share2, path: "/user/affiliate" },
    { name: "Notifications", icon: Bell, path: "/user/notifications" },
    { name: "Invoices", icon: FileText, path: "/user/invoices" },
    { name: "Support", icon: LifeBuoy, path: "/user/support", showUnread: true },
    { name: "Profile", icon: User, path: "/user/profile" },
  ] as Array<{ name: string; icon: typeof LayoutDashboard; path: string; showUnread?: boolean }>;

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
          "fixed left-0 top-0 z-50 flex max-h-[100dvh] min-h-0 w-[min(16rem,88vw)] flex-col justify-between overflow-y-auto overscroll-contain border-r border-slate-200/80 bg-[#F9F9F9] p-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-none transition-transform duration-300 ease-out sm:p-5 md:z-40 md:h-screen md:w-64 md:max-h-none md:shadow-sm",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "md:-translate-x-full md:pointer-events-none" : "md:translate-x-0",
        )}
      >
        <div className="relative min-h-0 flex-1">
          <div className="absolute right-0 top-0 flex items-center gap-0.5">
            {onToggleCollapse ? (
              <button
                type="button"
                className="hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:inline-flex"
                aria-label="Hide sidebar"
                title="Hide sidebar"
                onClick={onToggleCollapse}
              >
                <PanelLeftClose className="h-5 w-5" />
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden"
              aria-label="Close menu"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mb-4 pr-10 sm:mb-6">
            <h1 className="text-base font-bold text-neutral-900 sm:text-xl">User Panel</h1>
          </div>

          <div className="mb-4 rounded-lg bg-[#F2F2F2] p-2.5 text-neutral-900 sm:mb-8 sm:p-4">
            <p className="text-[10px] font-medium text-neutral-600 sm:text-xs">Account balance</p>

            <h2 className="mt-0.5 text-base font-bold tabular-nums text-neutral-900 sm:mt-1 sm:text-xl">
              {!currentUser
                ? "Loading user..."
                : !accountWallet
                  ? "Loading…"
                  : `${accountWallet.currency} ${accountWallet.balance.toFixed(2)}`}
            </h2>
            <p className="mt-1 text-[10px] leading-snug text-neutral-500">
              Settled wallet — after closed trade P/L (not original deposit)
            </p>
          </div>

          {!subLoading && accessRestricted && (
            <button
              type="button"
              onClick={() => {
                navigate(PACKAGES_PATH);
                onClose();
              }}
              className="mb-3 flex w-full items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-100"
            >
              <Package size={18} className="shrink-0" />
              Buy a package
            </button>
          )}

          {!subLoading && !accessRestricted && complianceLocked && (
            <button
              type="button"
              onClick={() => {
                navigate(REQUIRED_SETUP_PATH);
                onClose();
              }}
              className="mb-3 flex w-full items-center gap-3 rounded-xl border border-sky-300 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-950 transition-colors hover:bg-sky-100"
            >
              <ShieldAlert size={18} className="shrink-0" />
              Required setup
            </button>
          )}

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
                      "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all touch-manipulation sm:gap-3 sm:px-4 sm:py-3 sm:text-sm",
                      isActive
                        ? "bg-[#FFD700] text-black"
                        : "text-slate-600 hover:bg-white/80 active:bg-white",
                    )
                  }
                >
                  <Icon size={18} className="shrink-0" />
                  <span className="flex-1">{item.name}</span>
                  {item.showUnread && supportUnread != null && supportUnread > 0 && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800"
                      title="Unread support replies"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                      {supportUnread}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="mt-4 shrink-0 space-y-3 pb-2 sm:mt-6">
          <button
            type="button"
            onClick={() => {
              onClose();
              logout();
              navigate("/login");
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 touch-manipulation"
          >
            <LogOut size={16} className="shrink-0" />
            Logout
          </button>
          <p className="text-center text-[10px] text-slate-400 sm:text-xs">
            © 2026 Copy Trade Engine
          </p>
        </div>
      </aside>
    </>
  );
};

export default UserSidebar;
