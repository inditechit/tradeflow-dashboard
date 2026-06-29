import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, User, Menu, Moon, Sun } from "lucide-react";
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
  /** Opens the mobile navigation drawer (shown as hamburger on &lt; md) */
  onMenuClick?: () => void;
};

export function AppHeader({ variant, onMenuClick }: AppHeaderProps) {
  const { currentUser, logout } = useApp();
  const { theme, toggleTheme } = useTheme();
  const { isEmployee } = useEmployeeExploreMode();
  const { openSettings: openCallSettings, ringing: callRinging } = useAdminCallContext();
  const navigate = useNavigate();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const finance = useUserFinance(variant === "user" ? currentUser?.userId : undefined);

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

  const walletLabel =
    variant === "user" && !finance.loading
      ? `${finance.walletBalance.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} ${finance.currency || "USD"}`
      : null;

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-200/90 bg-[#F9F9F9] px-3 sm:gap-4 sm:px-4 md:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        {onMenuClick ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 touch-manipulation md:hidden"
            aria-label="Open navigation menu"
            onClick={onMenuClick}
          >
            <Menu className="h-6 w-6 text-slate-700" />
          </Button>
        ) : null}
        <div className="font-sans min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 sm:text-[11px]">
            {variant === "admin" ? (isEmployee ? "Employee" : "Admin") : "User"}
          </p>
          <p className="truncate text-xs font-semibold text-slate-800 sm:text-sm">
            Copy Trade Engine
          </p>
        </div>
      </div>

      <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
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
