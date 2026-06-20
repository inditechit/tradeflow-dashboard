import { useEmployeeAccess } from "@/hooks/useEmployeeAccess";

type Props = {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

/** Hide UI unless admin or employee has the permission key. */
export function AccessGate({ permission, children, fallback = null }: Props) {
  const { can } = useEmployeeAccess();
  if (!can(permission)) return <>{fallback}</>;
  return <>{children}</>;
}
