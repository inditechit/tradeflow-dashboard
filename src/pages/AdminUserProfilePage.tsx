import { Navigate, useParams } from "react-router-dom";
import { useAdminBackNavigation } from "@/hooks/useAdminBackNavigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfilePanel } from "@/components/profile/ProfilePanel";

const AdminUserProfilePage = () => {
  const { userId } = useParams<{ userId: string }>();
  const { goBack } = useAdminBackNavigation("/admin/users");

  if (!userId) {
    return <Navigate to="/admin/users" replace />;
  }

  return (
    <div className="mx-auto max-w-5xl px-0 py-4 sm:px-2 md:px-6 md:py-10">
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:gap-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit touch-manipulation"
          onClick={() => goBack()}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Users
        </Button>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">User profile & KYC</h1>
      </div>
      <ProfilePanel targetUserId={userId} showAdminExtras />
    </div>
  );
};

export default AdminUserProfilePage;
