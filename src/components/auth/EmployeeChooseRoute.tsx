import { Navigate } from "react-router-dom";
import { useVerifiedSession } from "@/hooks/useVerifiedSession";
import AuthGateLoading from "@/components/auth/AuthGateLoading";

type Props = { children: React.ReactNode };

/** Choose-experience page — employees only. */
export function EmployeeChooseRoute({ children }: Props) {
  const { userId, role, isLoading, isReady } = useVerifiedSession();

  if (isLoading) return <AuthGateLoading />;
  if (!isReady || !userId) return <Navigate to="/login" replace />;
  if (role === "admin") return <Navigate to="/admin/dashboard" replace />;
  if (role !== "employee") return <Navigate to="/user/dashboard" replace />;

  return <>{children}</>;
}
