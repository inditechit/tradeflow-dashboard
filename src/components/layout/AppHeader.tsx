import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LogOut, User, Menu, Moon, Sun, PanelLeftOpen, PanelLeftClose, SlidersHorizontal, Undo2 } from "lucide-react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { AdminAlertBell } from "@/components/admin/AdminAlertBell";
import { AdminCallSettingsButton, useAdminCallContext } from "@/components/admin/AdminCallNotificationLayer";
import { useApp } from "@/context/AppContext";
import { useTheme } from "@/context/ThemeContext";
import { useUserFinance } from "@/hooks/useUserFinance";
import { proofImageSrc } from "@/utils/userImageUrl";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmployeeExploreSwitch } from "@/components/layout/EmployeeExploreSwitch";
import { useEmployeeExploreMode } from "@/hooks/useEmployeeExploreMode";
import {
  loadAdminUsersFiltersCollapsed,
  toggleAdminUsersFiltersCollapsed,
  ADMIN_USERS_FILTERS_COLLAPSED_EVENT,
} from "@/utils/adminUsersFiltersCollapsed";
import {
  endAdminImpersonation,
  isAdminImpersonating,
} from "@/utils/adminImpersonation";
import { cn } from "@/lib/utils";

const API_BASE = "https://api.copytradeengine.org/api";

function getInitials(name?: string, telegram?: string) {
  const raw = (name || telegram || "?").trim();
  if (!raw) return "?";
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return raw.slice(0, 2).toUpperCase();
}

type AppHeaderProps = {
  variant: "user" | "admin";
  /**
   * Mobile: open drawer. Desktop: toggle sidebar collapsed/expanded.
   */
  onMenuClick?: () => void;
  /** When true on desktop, header shows "expand sidebar" affordance */
  sidebarCollapsed?: boolean;
  /** Hide hamburger on mobile when bottom tabs provide Menu. Desktop toggle still shows. */
  hideMobileMenuButton?: boolean;
};

export function AppHeader({
  variant,
  onMenuClick,
  sidebarCollapsed = false,
  hideMobileMenuButton = false,
}: AppHeaderProps) {
  const { currentUser, setCurrentUser, logout } = useApp();
  const { theme, toggleTheme } = useTheme();
  const { isEmployee } = useEmployeeExploreMode();
  const { openSettings: openCallSettings, ringing: callRinging } = useAdminCallContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [impersonating, setImpersonating] = useState(() => isAdminImpersonating());
  const finance = useUserFinance(variant === "user" ? currentUser?.userId : undefined);
  const showUsersFiltersToggle =
    variant === "admin" &&
    (location.pathname === "/admin/users" || location.pathname === "/admin/users/");
  const [usersFiltersCollapsed, setUsersFiltersCollapsed] = useState(
    loadAdminUsersFiltersCollapsed,
  );

  useEffect(() => {
    setImpersonating(isAdminImpersonating());
  }, [currentUser?.userId, location.pathname]);

  useEffect(() => {
    if (!showUsersFiltersToggle) return;
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ collapsed?: boolean }>).detail;
      if (typeof detail?.collapsed === "boolean") {
        setUsersFiltersCollapsed(detail.collapsed);
      } else {
        setUsersFiltersCollapsed(loadAdminUsersFiltersCollapsed());
      }
    };
    window.addEventListener(ADMIN_USERS_FILTERS_COLLAPSED_EVENT, onChange);
    setUsersFiltersCollapsed(loadAdminUsersFiltersCollapsed());
    return () => window.removeEventListener(ADMIN_USERS_FILTERS_COLLAPSED_EVENT, onChange);
  }, [showUsersFiltersToggle]);

  useEffect(() => {
    if (!currentUser?.userId) {
      setPhotoUrl(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/user/profile/${currentUser.userId}`);
        const data = await res.json();
        if (cancelled || !data.success || !data.profile) return;
        setPhotoUrl(proofImageSrc(data.profile.livePhotoData as string));
      } catch {
        if (!cancelled) setPhotoUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.userId]);

  if (!currentUser) {
    return null;
  }

  const profilePath = variant === "admin" ? "/admin/profile" : "/user/profile";
  const displayName = currentUser.name?.trim() || currentUser.telegram || "Account";
  const initials = getInitials(currentUser.name, currentUser.telegram);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleReturnToAdmin = () => {
    const admin = endAdminImpersonation();
    if (!admin?.userId) {
      logout();
      navigate("/login");
      return;
    }
    setCurrentUser(admin);
    setImpersonating(false);
    navigate("/admin/users");
  };

  const walletLabel =
    variant === "user" && !finance.loading
      ? `${finance.walletBalance.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} ${finance.currency || "USD"}`
      : null;

  return (
    <header className="sticky top-0 z-40 flex h-11 shrink-0 items-center justify-between gap-1.5 border-b border-slate-200/90 bg-[#F9F9F9] px-2 sm:h-14 sm:gap-4 sm:px-4 md:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-3">
        {onMenuClick ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "shrink-0 touch-manipulation",
              hideMobileMenuButton && "hidden md:inline-flex",
            )}
            aria-label={
              sidebarCollapsed ? "Show navigation sidebar" : "Hide navigation sidebar"
            }
            title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
            onClick={onMenuClick}
          >
            <span className={hideMobileMenuButton ? "contents" : undefined}>
              {!hideMobileMenuButton ? (
                <span className="md:hidden">
                  <Menu className="h-6 w-6 text-slate-700" />
                </span>
              ) : null}
              <span className={hideMobileMenuButton ? "inline-flex" : "hidden md:inline-flex"}>
                {sidebarCollapsed ? (
                  <PanelLeftOpen className="h-5 w-5 text-slate-700" />
                ) : (
                  <PanelLeftClose className="h-5 w-5 text-slate-700" />
                )}
              </span>
            </span>
          </Button>
        ) : null}
        {showUsersFiltersToggle ? (
          <button
            type="button"
            onClick={() => toggleAdminUsersFiltersCollapsed()}
            className={cn(
              "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-transparent hover:text-slate-500",
              !usersFiltersCollapsed && "text-slate-400",
            )}
            aria-label={usersFiltersCollapsed ? "Show user filters" : "Hide user filters"}
            title={usersFiltersCollapsed ? "Show filters" : "Hide filters"}
          >
            <SlidersHorizontal className="h-3.5 w-3.5 opacity-60" strokeWidth={1.5} />
          </button>
        ) : null}
        <div className="font-sans min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 sm:text-[11px]">
            {variant === "admin" ? (isEmployee ? "Employee" : "Admin") : "User"}
          </p>
          <p className="truncate text-[11px] font-semibold text-slate-800 sm:text-sm">
            <span className="md:hidden">CTE</span>
            <span className="hidden md:inline">Copy Trade Engine</span>
          </p>
        </div>
      </div>

      <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
        {impersonating && variant === "user" ? (
          <Button
            type="button"
            size="sm"
            onClick={handleReturnToAdmin}
            className="h-8 gap-1.5 bg-amber-900 px-2.5 text-xs text-white hover:bg-amber-800 sm:px-3"
            title="Return to admin account"
          >
            <Undo2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Back to admin</span>
            <span className="sm:hidden">Admin</span>
          </Button>
        ) : null}

        {isEmployee ? (
          <EmployeeExploreSwitch activeVariant={variant} className="hidden sm:flex" />
        ) : null}

        {variant === "user" && walletLabel ? (
          <button
            type="button"
            onClick={() => navigate("/user/recharge")}
            className="max-w-[10rem] truncate rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-left text-[11px] font-semibold tabular-nums text-slate-900 shadow-sm transition-colors hover:bg-slate-50 sm:max-w-[11rem] sm:px-2.5 sm:text-xs md:max-w-none md:px-3"
          >
            {walletLabel}
          </button>
        ) : null}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="shrink-0 touch-manipulation rounded-full text-slate-700 hover:bg-slate-100"
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          title={theme === "dark" ? "Light theme" : "Dark theme"}
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        {variant === "user" ? (
          <NotificationBell userId={currentUser.userId} />
        ) : (
          <>
            <AdminCallSettingsButton onClick={openCallSettings} ringing={callRinging} />
            <AdminAlertBell />
          </>
        )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="h-10 touch-manipulation gap-1 rounded-full px-1.5 hover:bg-slate-100 sm:gap-2 sm:px-2"
          >
            <Avatar className="h-9 w-9 border border-slate-200 shadow-sm">
              {photoUrl ? <AvatarImage src={photoUrl} alt="" className="object-cover" /> : null}
              <AvatarFallback className="bg-[#FFD700] text-sm font-bold text-black">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-[160px] truncate text-sm font-medium text-slate-800 sm:inline">
              {displayName}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 border-slate-200 bg-white p-1 shadow-lg">
          <div className="px-2 py-2">
            <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
            {currentUser.email ? (
              <p className="truncate text-xs text-slate-500">{currentUser.email}</p>
            ) : null}
            {currentUser.telegram ? (
              <p className="truncate text-xs text-neutral-800">@{currentUser.telegram}</p>
            ) : null}
          </div>
          {isEmployee ? (
            <>
              <div className="px-2 pb-2 sm:hidden">
                <EmployeeExploreSwitch activeVariant={variant} className="w-full" />
              </div>
              <DropdownMenuSeparator className="bg-slate-200" />
            </>
          ) : (
            <DropdownMenuSeparator className="bg-slate-200" />
          )}
          <DropdownMenuItem
            className="cursor-pointer text-black focus:bg-slate-100 focus:text-slate-900"
            onClick={() => navigate(profilePath)}
          >
            <User className="mr-2 h-4 w-4 text-black" />
            Profile
          </DropdownMenuItem>
          {impersonating ? (
            <DropdownMenuItem
              className="cursor-pointer text-amber-900 focus:bg-amber-50 focus:text-amber-950"
              onClick={handleReturnToAdmin}
            >
              <Undo2 className="mr-2 h-4 w-4" />
              Back to admin
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-700"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
    </header>
  );
}
