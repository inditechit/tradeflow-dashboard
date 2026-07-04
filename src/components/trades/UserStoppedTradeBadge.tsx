import { formatIsoDateTime } from "@/utils/mt5TradeDates";
import { isUserStoppedTrade, userStoppedAt, type UserTradeRowLike } from "@/utils/userTradePl";

type Props = {
  row: UserTradeRowLike;
  /** User dashboard vs admin views */
  variant?: "user" | "admin";
  showTime?: boolean;
  className?: string;
};

export function UserStoppedTradeBadge({
  row,
  variant = "user",
  showTime = false,
  className = "",
}: Props) {
  if (!isUserStoppedTrade(row)) return null;
  const label = variant === "admin" ? "User stopped" : "Stopped by you";
  const at = userStoppedAt(row);
  const title = at ? `Copy trading stopped at ${formatIsoDateTime(at)}` : undefined;

  return (
    <span
      className={`rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 ${className}`.trim()}
      title={title}
    >
      {label}
      {showTime && at ? ` · ${formatIsoDateTime(at)}` : ""}
    </span>
  );
}
