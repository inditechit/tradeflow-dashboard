import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
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
  BellRing,
  PieChart,
  FileText,
  FileBarChart,
  UserCog,
  AlertTriangle,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { API_BASE } from "@/config/api";
import { useEmployeeAccess } from "@/hooks/useEmployeeAccess";
import { useAdminSidebarBadges } from "@/hooks/useAdminSidebarBadges";
import { tabKeyForPath } from "@/config/employeePermissionCatalog";
import type { AdminSidebarBadgeKey } from "@/utils/adminSidebarSeen";

type AdminSidebarProps = {
  mobileOpen: boolean;
  onClose: () => void;
};

type IconType = LucideIcon;

type BadgeTone = "default" | "green" | "blue";

type MenuItem = {
  name: string;
  icon: IconType;
  path: string;
  showLive?: boolean;
  badgeKey?: AdminSidebarBadgeKey;
  highlightKey?: AdminSidebarBadgeKey;
  badgeTone?: BadgeTone;
  adminOnly?: boolean;
};

const BADGE_TONE_CLASSES: Record<BadgeTone, string> = {
  default: "bg-red-500 text-white",
  green: "bg-emerald-500 text-white",
  blue: "bg-blue-500 text-white",
};

type MenuEntry =
  | ({ kind: "item" } & MenuItem)
  | { kind: "group"; label: string; icon: IconType; items: MenuItem[] };

/** Grouped navigation — collapsible sections keep the sidebar short. */
const MENU: MenuEntry[] = [
  { kind: "item", name: "Dashboard", icon: LayoutDashboard, path: "/admin/dashboard" },
  { kind: "item", name: "Open/Close Trades", icon: TrendingUp, path: "/admin/open-trades" },
  {
    kind: "group",
    label: "Users",
    icon: Users,
    items: [
      {
        name: "All users",
        icon: Users,
        path: "/admin/users",
        showLive: true,
        badgeKey: "new_users",
        highlightKey: "new_users",
      },
      { name: "User map", icon: MapIcon, path: "/admin/user-map" },
    ],
  },
  {
    kind: "group",
    label: "Payments",
    icon: Wallet,
    items: [
      { name: "Transactions", icon: ArrowLeftRight, path: "/admin/transactions" },
      {
        name: "Wallet recharges",
        icon: Wallet,
        path: "/admin/recharge",
        badgeKey: "pending_recharges",
        badgeTone: "green",
      },
      {
        name: "Unmatched payments",
        icon: AlertTriangle,
        path: "/admin/unmatched-payments",
        badgeKey: "unmatched_payments",
        highlightKey: "unmatched_payments",
      },
      {
        name: "Withdrawals",
        icon: ArrowDownToLine,
        path: "/admin/withdrawals",
        badgeKey: "pending_withdrawals",
        badgeTone: "blue",
      },
      { name: "Bulk withdraw", icon: Users, path: "/admin/bulk-withdraw" },
      { name: "Wallet ledger", icon: ScrollText, path: "/admin/wallet-ledger" },
    ],
  },
  {
    kind: "group",
    label: "Packages & marketing",
    icon: Package,
    items: [
      { name: "Packages we sell", icon: Package, path: "/admin/package-catalog" },
      { name: "Packages", icon: Package, path: "/admin/packages" },
      { name: "Coupons", icon: Tag, path: "/admin/coupons" },
      { name: "Affiliate rules", icon: Percent, path: "/admin/affiliate-rules" },
      { name: "View referrals", icon: Share2, path: "/admin/referrals" },
    ],
  },
  {
    kind: "group",
    label: "Reports",
    icon: PieChart,
    items: [
      { name: "Financial stats", icon: PieChart, path: "/admin/financial-stats" },
      { name: "User P/L report", icon: FileBarChart, path: "/admin/user-pnl-report" },
      { name: "Invoices", icon: FileText, path: "/admin/invoices" },
    ],
  },
  {
    kind: "group",
    label: "Support & alerts",
    icon: Headphones,
    items: [
      {
        name: "Support tickets",
        icon: Headphones,
        path: "/admin/support-tickets",
        badgeKey: "support_needs_reply",
        highlightKey: "support_needs_reply",
      },
      {
        name: "Start/Stop Alerts",
        icon: BellRing,
        path: "/admin/alerts",
        badgeKey: "unread_alerts",
      },
      { name: "Send Notifications", icon: Bell, path: "/admin/notifications" },
    ],
  },
  {
    kind: "group",
    label: "System",
    icon: UserCog,
    items: [
      { name: "User maintenance", icon: Construction, path: "/admin/maintenance" },
      { name: "Employees", icon: UserCog, path: "/admin/employees", adminOnly: true },
    ],
  },
  { kind: "item", name: "Profile", icon: User, path: "/admin/profile" },
];

function badgeCount(item: MenuItem, badges: Record<AdminSidebarBadgeKey, number>) {
  if (!item.badgeKey) return 0;
  return Number(badges[item.badgeKey] ?? 0);
}

function groupBadgeTotal(items: MenuItem[], badges: Record<AdminSidebarBadgeKey, number>) {
  return items.reduce((sum, item) => sum + badgeCount(item, badges), 0);
}

function groupHasHighlight(items: MenuItem[], badges: Record<AdminSidebarBadgeKey, number>) {
  return items.some(
    (item) => item.highlightKey && Number(badges[item.highlightKey] ?? 0) > 0,
  );
}

const AdminSidebar = ({ mobileOpen, onClose }: AdminSidebarProps) => {
  const [liveCount, setLiveCount] = useState<number | null>(null);
  const { badges, refresh: refreshBadges } = useAdminSidebarBadges();
  const { isAdmin, can } = useEmployeeAccess();
  const location = useLocation();

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
        // best-effort
      }
    };
    load();
    const id = window.setInterval(load, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  // Refresh badges when navigating (e.g. after visiting users page).
  useEffect(() => {
    void refreshBadges();
  }, [location.pathname, refreshBadges]);

  const canSee = (item: MenuItem) => {
    if (item.adminOnly && !isAdmin) return false;
    if (isAdmin) return true;
    const tabKey = tabKeyForPath(item.path);
    return tabKey ? can(tabKey) : false;
  };

  /** Filter entries by permission and drop empty groups. */
  const entries = useMemo(() => {
    const out: MenuEntry[] = [];
    for (const entry of MENU) {
      if (entry.kind === "item") {
        if (canSee(entry)) out.push(entry);
      } else {
        const items = entry.items.filter(canSee);
        if (items.length > 0) out.push({ ...entry, items });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, can]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // Auto-open the group that contains the active route.
  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const entry of entries) {
        if (entry.kind === "group") {
          const active = entry.items.some((i) => location.pathname.startsWith(i.path));
          if (active) next[entry.label] = true;
        }
      }
      return next;
    });
  }, [location.pathname, entries]);

  const toggleGroup = (label: string) =>
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));

  const liveBadge = (show?: boolean) =>
    show && liveCount != null && liveCount > 0 ? (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800"
        title="Users online now"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        {liveCount}
      </span>
    ) : null;

  const countBadge = (count: number, title?: string, tone: BadgeTone = "default") =>
    count > 0 ? (
      <span
        className={cn(
          "inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold",
          BADGE_TONE_CLASSES[tone],
        )}
        title={title}
      >
        {count > 99 ? "99+" : count}
      </span>
    ) : null;

  const highlightDot = (active: boolean, title?: string) =>
    active ? (
      <span
        className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400 ring-2 ring-amber-200"
        title={title ?? "Needs attention"}
      />
    ) : null;

  const renderItemBadges = (item: MenuItem) => {
    const count = badgeCount(item, badges);
    const highlighted =
      item.highlightKey != null && Number(badges[item.highlightKey] ?? 0) > 0;
    return (
      <>
        {highlighted ? highlightDot(true, `${count} new`) : null}
        {countBadge(count, undefined, item.badgeTone ?? "default")}
        {liveBadge(item.showLive)}
      </>
    );
  };

  const itemClasses = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all touch-manipulation",
      isActive ? "bg-[#FFD700] text-black" : "text-slate-600 hover:bg-white/80 active:bg-white",
    );

  const groupHeaderClasses = (hasHighlight: boolean) =>
    cn(
      "flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all hover:bg-white/80",
      hasHighlight ? "text-slate-900 ring-1 ring-amber-200/80 bg-amber-50/40" : "text-slate-700",
    );

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
            <h1 className="font-sans text-lg font-bold text-neutral-900 sm:text-xl">
              {isAdmin ? "Admin Panel" : "Employee Panel"}
            </h1>
          </div>

          <nav className="flex flex-col gap-1" aria-label="Admin navigation">
            {entries.map((entry) => {
              if (entry.kind === "item") {
                const Icon = entry.icon;
                return (
                  <NavLink key={entry.path} to={entry.path} onClick={onClose} className={itemClasses}>
                    <Icon size={18} className="shrink-0" />
                    <span className="flex-1">{entry.name}</span>
                    {renderItemBadges(entry)}
                  </NavLink>
                );
              }

              const Icon = entry.icon;
              const open = openGroups[entry.label] ?? false;
              const groupTotal = groupBadgeTotal(entry.items, badges);
              const groupHighlight = groupHasHighlight(entry.items, badges);
              const groupHasLive = entry.items.some((i) => i.showLive);

              return (
                <div key={entry.label} className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => toggleGroup(entry.label)}
                    className={groupHeaderClasses(groupHighlight && !open)}
                    aria-expanded={open}
                  >
                    <Icon size={18} className="shrink-0" />
                    <span className="flex-1 text-left">{entry.label}</span>
                    {!open && (
                      <span className="flex items-center gap-1.5">
                        {groupHighlight ? highlightDot(true) : null}
                        {countBadge(groupTotal)}
                        {liveBadge(groupHasLive)}
                      </span>
                    )}
                    <ChevronDown
                      size={16}
                      className={cn("shrink-0 transition-transform", open && "rotate-180")}
                    />
                  </button>
                  {open && (
                    <div className="mt-1 flex flex-col gap-1 border-l border-slate-200 pl-3">
                      {entry.items.map((item) => {
                        const ItemIcon = item.icon;
                        return (
                          <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={onClose}
                            className={itemClasses}
                          >
                            <ItemIcon size={18} className="shrink-0" />
                            <span className="flex-1">{item.name}</span>
                            {renderItemBadges(item)}
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
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
