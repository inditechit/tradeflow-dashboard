import { useEmployeeAccess } from "@/hooks/useEmployeeAccess";

type Props = {
  perm: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

/** Renders children only when the current staff member has the given permission key. */
export function EmployeeGate({ perm, children, fallback = null }: Props) {
  const { can } = useEmployeeAccess();
  if (!can(perm)) return <>{fallback}</>;
  return <>{children}</>;
}
