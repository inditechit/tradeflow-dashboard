import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { EmployeeTabGuard } from "@/components/auth/EmployeeTabGuard";
import { ThemeProvider } from "@/context/ThemeContext";
import { AdminCallNotificationProvider } from "@/components/admin/AdminCallNotificationLayer";
import { AdminPiiRevealProvider } from "@/components/admin/AdminPiiReveal";
import { AppLegalFooter } from "@/components/layout/AppLegalFooter";
import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";
import { cn } from "@/lib/utils";

const AdminLayout = () => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { collapsed, toggleCollapsed, setCollapsed } = useSidebarCollapsed(
    "tradeflow.admin.sidebarCollapsed",
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
    <AdminCallNotificationProvider>
    <AdminPiiRevealProvider>
    <div className="app-shell flex h-[100dvh] min-h-0 bg-white">
      <AdminSidebar
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
          variant="admin"
          onMenuClick={handleMenuClick}
          sidebarCollapsed={collapsed}
        />
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-auto bg-white px-3 py-4 sm:px-4 md:p-8">
          <div className="mx-auto w-full min-w-0 max-w-7xl pb-[env(safe-area-inset-bottom)]">
            <EmployeeTabGuard>
              <Outlet />
            </EmployeeTabGuard>
          </div>
        </main>
        <AppLegalFooter />
      </div>
    </div>
    </AdminPiiRevealProvider>
    </AdminCallNotificationProvider>
    </ThemeProvider>
  );
};

export default AdminLayout;
