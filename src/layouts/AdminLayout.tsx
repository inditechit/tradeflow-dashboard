import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { EmployeeTabGuard } from "@/components/auth/EmployeeTabGuard";
const AdminLayout = () => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
    <div className="flex h-[100dvh] min-h-0 bg-white">
      <AdminSidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:ml-64">
        <AppHeader variant="admin" onMenuClick={() => setMobileNavOpen(true)} />
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-auto bg-white px-3 py-4 sm:px-4 md:p-8">
          <div className="mx-auto w-full min-w-0 max-w-7xl pb-[env(safe-area-inset-bottom)]">
            <EmployeeTabGuard>
              <Outlet />
            </EmployeeTabGuard>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
