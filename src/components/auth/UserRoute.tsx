import { Navigate } from "react-router-dom";
import { useVerifiedSession } from "@/hooks/useVerifiedSession";
import AuthGateLoading from "@/components/auth/AuthGateLoading";
import { getEmployeeExploreMode, resolveEmployeeLandingPath } from "@/utils/employeeExploreMode";
import { useApp } from "@/context/AppContext";

type Props = { children: React.ReactNode };

/** Logged-in traders — employees only pass when exploring as user. */
const UserRoute = ({ children }: Props) => {
  const { userId, role, isLoading, isReady } = useVerifiedSession();
  const { currentUser } = useApp();

  if (isLoading) {
    return <AuthGateLoading />;
  }

  if (!isReady || !userId) {
    return <Navigate to="/login" replace />;
  }

  if (role === "admin") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (role === "employee") {
    const mode = getEmployeeExploreMode(userId);
    if (!mode) {
      return <Navigate to="/choose-experience" replace />;
    }
    if (mode === "employee") {
      const perms = currentUser?.employeePermissions ?? [];
      return <Navigate to={resolveEmployeeLandingPath(userId, perms)} replace />;
    }
  }

  return <>{children}</>;
};

export default UserRoute;
