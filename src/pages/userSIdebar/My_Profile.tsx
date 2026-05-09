import { Navigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { ProfilePanel } from "@/components/profile/ProfilePanel";

const My_Profile = () => {
  const { currentUser } = useApp();

  if (!currentUser?.userId) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="mx-auto max-w-5xl px-0 py-4 sm:px-2 md:px-6 md:py-10">
      <h1 className="mb-4 text-xl font-bold text-slate-900 sm:mb-6 sm:text-2xl">My profile</h1>
      <ProfilePanel
        targetUserId={String(currentUser.userId)}
        showAdminExtras={currentUser.role === "admin"}
      />
    </div>
  );
};

export default My_Profile;
