import { Outlet } from "react-router-dom";
import AdminSidebar from "@/components/admin/AdminSidebar";

const AdminLayout = () => {
  return (
    <div className="flex min-h-screen bg-slate-50">
      
      {/* Sidebar (STATIC) */}
      <AdminSidebar />

      {/* Page Content (CHANGES) */}
      <div className="flex-1 ml-64 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </div>

    </div>
  );
};

export default AdminLayout;