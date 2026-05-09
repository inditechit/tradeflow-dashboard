import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfilePanel } from "@/components/profile/ProfilePanel";

const AdminUserProfilePage = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  if (!userId) {
    return <Navigate to="/admin/users" replace />;
  }

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Button type="button" variant="outline" size="sm" onClick={() => navigate("/admin/users")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Users
        </Button>
        <h1 className="text-2xl font-bold text-slate-900">User profile & KYC</h1>
      </div>
      <ProfilePanel targetUserId={userId} showAdminExtras />
    </div>
  );
};

export default AdminUserProfilePage;
