import { Outlet } from "react-router-dom";
import UserSidebar from "@/components/user/UserSidebar";

const UserLayout = () => {
  return (
    <div className="flex min-h-screen bg-slate-50">
      
      {/* Sidebar (STATIC) */}
      <UserSidebar />

      {/* Page Content (CHANGES) */}
      <div className="flex-1 ml-64 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </div>

    </div>
  );
};

export default UserLayout;