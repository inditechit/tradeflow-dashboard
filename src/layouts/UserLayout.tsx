import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import UserSidebar from "@/components/user/UserSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import {
  USER_MOBILE_TABS,
  MobileBottomNav,
} from "@/components/layout/MobileBottomNav";
import { usePresenceHeartbeat } from "@/hooks/usePresenceHeartbeat";
import VoiceConsentGate from "@/components/voice/VoiceConsentGate";
import { useApp } from "@/context/AppContext";
import { SubscriptionProvider } from "@/context/SubscriptionContext";
import { ProfileComplianceProvider } from "@/context/ProfileComplianceContext";
import SubscriptionExpiredGuard from "@/components/subscription/SubscriptionExpiredGuard";
import ComplianceRequiredGuard from "@/components/compliance/ComplianceRequiredGuard";
import RiskProfileRequiredGuard from "@/components/risk/RiskProfileRequiredGuard";
import MaintenanceGuard from "@/components/maintenance/MaintenanceGuard";
import BlockedUserGuard from "@/components/block/BlockedUserGuard";
import { ThemeProvider } from "@/context/ThemeContext";
import { API_BASE } from "@/config/api";
import { AppLegalFooter } from "@/components/layout/AppLegalFooter";
import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";
import { cn } from "@/lib/utils";

const UserLayout = () => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { collapsed, toggleCollapsed, setCollapsed } = useSidebarCollapsed(
    "tradeflow.user.sidebarCollapsed",
  );
  const { currentUser } = useApp();
  usePresenceHeartbeat(
    currentUser?.userId,
    API_BASE,
    30_000,
    currentUser?.role !== "admin",
  );

  useEffect(() => {
    if (mobileNavOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => {
      if (mq.matches) setMobileNavOpen(false);
    };
    mq.addEventListener("change", closeOnDesktop);
    return () => mq.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileNavOpen]);

  const handleMenuClick = () => {
    if (window.matchMedia("(min-width: 768px)").matches) {
      toggleCollapsed();
    } else {
      setMobileNavOpen(true);
    }
  };

  return (
    <ThemeProvider>
    <SubscriptionProvider>
      <ProfileComplianceProvider>
        <div className="app-shell flex h-[100dvh] min-h-0 bg-white">
          <UserSidebar
            mobileOpen={mobileNavOpen}
            onClose={() => setMobileNavOpen(false)}
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed(true)}
          />

          <div
            className={cn(
              "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden transition-[margin] duration-300 ease-out",
              collapsed ? "md:ml-0" : "md:ml-64",
            )}
          >
            <AppHeader
              variant="user"
              onMenuClick={handleMenuClick}
              sidebarCollapsed={collapsed}
              hideMobileMenuButton
            />
            <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-white px-2 py-2.5 sm:px-4 sm:py-4 md:overflow-x-auto md:p-8">
              <div className="mx-auto w-full min-w-0 max-w-7xl pb-16 md:pb-[env(safe-area-inset-bottom)]">
                <SubscriptionExpiredGuard>
                  <RiskProfileRequiredGuard>
                    <ComplianceRequiredGuard>
                      <MaintenanceGuard>
                        <BlockedUserGuard>
                          <Outlet />
                        </BlockedUserGuard>
                      </MaintenanceGuard>
                    </ComplianceRequiredGuard>
                  </RiskProfileRequiredGuard>
                </SubscriptionExpiredGuard>
              </div>
            </main>
            <AppLegalFooter compactOnMobile />
            <MobileBottomNav
              tabs={USER_MOBILE_TABS}
              onMenuClick={() => setMobileNavOpen(true)}
              menuOpen={mobileNavOpen}
            />
          </div>

          {currentUser?.role !== "admin" && (
            <VoiceConsentGate userId={currentUser?.userId} apiBase={API_BASE} />
          )}
        </div>
      </ProfileComplianceProvider>
    </SubscriptionProvider>
    </ThemeProvider>
  );
};

export default UserLayout;
