import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import UserSidebar from "@/components/user/UserSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { usePresenceHeartbeat } from "@/hooks/usePresenceHeartbeat";
import VoiceConsentGate from "@/components/voice/VoiceConsentGate";
import { useApp } from "@/context/AppContext";
import { SubscriptionProvider } from "@/context/SubscriptionContext";
import { ProfileComplianceProvider } from "@/context/ProfileComplianceContext";
import SubscriptionExpiredGuard from "@/components/subscription/SubscriptionExpiredGuard";
import ComplianceRequiredGuard from "@/components/compliance/ComplianceRequiredGuard";
import MaintenanceGuard from "@/components/maintenance/MaintenanceGuard";
import { ThemeProvider } from "@/context/ThemeContext";
import { API_BASE } from "@/config/api";

const UserLayout = () => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
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

  return (
    <ThemeProvider>
    <SubscriptionProvider>
      <ProfileComplianceProvider>
        <div className="user-shell flex h-[100dvh] min-h-0 bg-white">
          <UserSidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:ml-64">
            <AppHeader variant="user" onMenuClick={() => setMobileNavOpen(true)} />
            <main className="min-h-0 flex-1 overflow-y-auto overflow-x-auto bg-white px-3 py-4 sm:px-4 md:p-8">
              <div className="mx-auto w-full min-w-0 max-w-7xl pb-[env(safe-area-inset-bottom)]">
                <SubscriptionExpiredGuard>
                  <ComplianceRequiredGuard>
                    <MaintenanceGuard>
                      <Outlet />
                    </MaintenanceGuard>
                  </ComplianceRequiredGuard>
                </SubscriptionExpiredGuard>
              </div>
            </main>
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
