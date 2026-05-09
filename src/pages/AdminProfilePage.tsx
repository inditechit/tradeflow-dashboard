import { Navigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { ProfilePanel } from "@/components/profile/ProfilePanel";

const AdminProfilePage = () => {
  const { currentUser } = useApp();

  if (!currentUser?.userId) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Admin profile</h1>
      <ProfilePanel targetUserId={String(currentUser.userId)} showAdminExtras />
    </div>
  );
};

export default AdminProfilePage;
