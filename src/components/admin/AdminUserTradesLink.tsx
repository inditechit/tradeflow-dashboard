import type { ReactNode, MouseEvent } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export function adminUserTradesPath(userId: number | string): string {
  const id = Number(userId);
  return Number.isFinite(id) && id > 0 ? `/admin/users/${id}/trades` : "/admin/users";
}

type AdminUserTradesLinkProps = {
  userId: number | string | null | undefined;
  name?: string | null;
  children?: ReactNode;
  className?: string;
  showId?: boolean;
  idClassName?: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
};

export function AdminUserTradesLink({
  userId,
  name,
  children,
  className,
  showId = false,
  idClassName,
  onClick,
}: AdminUserTradesLinkProps) {
  const id = Number(userId);
  const label = children ?? name ?? (id > 0 ? `User #${id}` : "—");

  if (!Number.isFinite(id) || id <= 0) {
    return <span className={className}>{label}</span>;
  }

  return (
    <Link
      to={adminUserTradesPath(id)}
      className={cn(
        "text-slate-900 underline-offset-2 hover:text-yellow-900 hover:underline",
        className,
      )}
      title={`Open trades for user #${id}`}
      onClick={onClick}
    >
      {label}
      {showId ? (
        <span className={cn("block text-xs font-normal text-slate-500", idClassName)}>#{id}</span>
      ) : null}
    </Link>
  );
}
