import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import UserSidebar from "@/components/user/UserSidebar";
import { AppHeader } from "@/components/layout/AppHeader";

const UserLayout = () => {
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
    <div className="flex min-h-screen min-h-[100dvh] bg-white/55 backdrop-blur-[2px]">
      <UserSidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col md:ml-64">
        <AppHeader variant="user" onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-x-auto px-3 py-4 sm:px-4 md:p-8">
          <div className="mx-auto w-full min-w-0 max-w-7xl pb-[env(safe-area-inset-bottom)]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default UserLayout;
