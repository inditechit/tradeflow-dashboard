import { Navigate } from "react-router-dom";
import { useVerifiedSession } from "@/hooks/useVerifiedSession";
import AuthGateLoading from "@/components/auth/AuthGateLoading";
import { getEmployeeExploreMode } from "@/utils/employeeExploreMode";

type Props = { children: React.ReactNode };

/** Admins and employees (when exploring as employee) — regular users cannot open /admin URLs. */
const AdminRoute = ({ children }: Props) => {
  const { userId, role, isLoading, isReady } = useVerifiedSession();

  if (isLoading) {
    return <AuthGateLoading />;
  }

  if (!isReady || !userId) {
    return <Navigate to="/login" replace />;
  }

  if (role !== "admin" && role !== "employee") {
    return <Navigate to="/user/dashboard" replace />;
  }

  if (role === "employee") {
    const mode = getEmployeeExploreMode(userId);
    if (!mode) {
      return <Navigate to="/choose-experience" replace />;
    }
    if (mode === "user") {
      return <Navigate to="/user/dashboard" replace />;
    }
  }

  return <>{children}</>;
};

export default AdminRoute;
