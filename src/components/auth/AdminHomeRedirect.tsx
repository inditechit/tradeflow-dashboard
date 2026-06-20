import { Navigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { firstAllowedEmployeePath } from "@/config/employeePermissionCatalog";
import { getEmployeeExploreMode } from "@/utils/employeeExploreMode";

/** Sends employees to their first permitted tab; admins go to dashboard. */
export function AdminHomeRedirect() {
  const { currentUser } = useApp();
  const role = currentUser?.role;

  if (role === "employee") {
    const userId = currentUser?.userId;
    const mode = userId ? getEmployeeExploreMode(userId) : null;
    if (!mode) return <Navigate to="/choose-experience" replace />;
    if (mode === "user") return <Navigate to="/user/dashboard" replace />;
    const perms = currentUser?.employeePermissions ?? [];
    return <Navigate to={firstAllowedEmployeePath(perms, false)} replace />;
  }

  return <Navigate to="dashboard" replace />;
}
