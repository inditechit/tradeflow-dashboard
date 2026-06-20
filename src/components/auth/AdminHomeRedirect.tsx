import { Navigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { firstAllowedStaffPath } from "@/config/employeePermissionCatalog";

/** Sends staff to their first permitted tab; admins go to dashboard. */
export function AdminHomeRedirect() {
  const { currentUser } = useApp();
  const role = currentUser?.role;

  if (role === "employee") {
    const perms = currentUser?.employeePermissions ?? [];
    return <Navigate to={firstAllowedStaffPath(perms, false)} replace />;
  }

  return <Navigate to="dashboard" replace />;
}
