import { Navigate } from "react-router-dom";
import { useVerifiedSession } from "@/hooks/useVerifiedSession";
import AuthGateLoading from "@/components/auth/AuthGateLoading";

type Props = { children: React.ReactNode };

/** Logged-in traders only — admins are sent to the admin app. */
const UserRoute = ({ children }: Props) => {
  const { userId, role, isLoading, isReady } = useVerifiedSession();

  if (isLoading) {
    return <AuthGateLoading />;
  }

  if (!isReady || !userId) {
    return <Navigate to="/login" replace />;
  }

  if (role === "admin") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <>{children}</>;
};

export default UserRoute;
