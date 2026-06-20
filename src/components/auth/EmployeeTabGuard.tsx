import { Navigate, useLocation } from "react-router-dom";
import { useVerifiedSession } from "@/hooks/useVerifiedSession";
import { useEmployeeAccess } from "@/hooks/useEmployeeAccess";
import AuthGateLoading from "@/components/auth/AuthGateLoading";
import { tabKeyForPath } from "@/config/employeePermissionCatalog";

type Props = { children: React.ReactNode };

/** Blocks employees from pages they were not granted tab access to. Admins pass through. */
export function EmployeeTabGuard({ children }: Props) {
  const { pathname } = useLocation();
  const { isReady, isLoading } = useVerifiedSession();
  const { isAdmin, can } = useEmployeeAccess();

  if (isLoading) return <AuthGateLoading />;
  if (!isReady) return <Navigate to="/login" replace />;
  if (isAdmin) return <>{children}</>;

  const tabKey = tabKeyForPath(pathname);
  if (tabKey && !can(tabKey)) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
        <h2 className="text-lg font-semibold text-slate-900">Access restricted</h2>
        <p className="mt-2 text-sm text-slate-600">
          Your employee account does not have permission for this section. Contact your admin.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
