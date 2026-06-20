import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import {
  type EmployeeExploreMode,
  employeeHomeForMode,
  getEmployeeExploreMode,
  setEmployeeExploreMode,
} from "@/utils/employeeExploreMode";

export function useEmployeeExploreMode() {
  const { currentUser } = useApp();
  const navigate = useNavigate();
  const isEmployee = currentUser?.role === "employee";
  const userId = currentUser?.userId;
  const permissions = currentUser?.employeePermissions ?? [];

  const [mode, setModeState] = useState<EmployeeExploreMode | null>(() =>
    isEmployee && userId ? getEmployeeExploreMode(userId) : null,
  );

  useEffect(() => {
    if (isEmployee && userId) {
      setModeState(getEmployeeExploreMode(userId));
    } else {
      setModeState(null);
    }
  }, [isEmployee, userId]);

  const setMode = useCallback(
    (next: EmployeeExploreMode) => {
      if (!userId) return;
      setEmployeeExploreMode(userId, next);
      setModeState(next);
      navigate(employeeHomeForMode(next, permissions), { replace: true });
    },
    [navigate, permissions, userId],
  );

  const exploreAsUser = useCallback(() => setMode("user"), [setMode]);
  const exploreAsEmployee = useCallback(() => setMode("employee"), [setMode]);

  return {
    isEmployee,
    mode,
    hasChosenMode: mode != null,
    exploreAsUser,
    exploreAsEmployee,
    setMode,
  };
}
