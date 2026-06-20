import { useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { tabKeyForPath } from "@/config/employeePermissionCatalog";

export function useEmployeeAccess() {
  const { currentUser } = useApp();
  const role = currentUser?.role;
  const isAdmin = role === "admin";
  const isEmployee = role === "employee";
  const permissions = currentUser?.employeePermissions ?? [];

  return useMemo(() => {
    const can = (key: string | undefined | null): boolean => {
      if (!key) return true;
      if (isAdmin) return true;
      if (!isEmployee) return false;
      return permissions.includes(key);
    };

    const canTab = (path: string): boolean => {
      if (isAdmin) return true;
      const tabKey = tabKeyForPath(path);
      if (!tabKey) return false;
      return can(tabKey);
    };

    const canAny = (...keys: string[]): boolean => {
      if (isAdmin) return true;
      return keys.some((k) => permissions.includes(k));
    };

    const canAll = (...keys: string[]): boolean => {
      if (isAdmin) return true;
      return keys.every((k) => permissions.includes(k));
    };

    return {
      isAdmin,
      isEmployee,
      isStaff: isAdmin || isEmployee,
      permissions,
      can,
      canTab,
      canAny,
      canAll,
    };
  }, [isAdmin, isEmployee, permissions]);
}
