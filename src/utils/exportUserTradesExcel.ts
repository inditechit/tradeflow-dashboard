import * as XLSX from "xlsx";
import { formatIsoDateTime } from "@/utils/mt5TradeDates";
import {
  formatMt5SideLabel,
  resolveMt5BuySellPrices,
  resolveEffectiveSlice,
  isOpenTrade,
  isTradeClosed,
  isUserStoppedTrade,
  rowUserFacingPl,
  tradeEffectiveCloseAt,
  buildSequentialUserFacingPlMap,
  proportionalRawPl,
  sortTradesChronological,
  type UserTradeRowLike,
} from "@/utils/userTradePl";

export type ExportUserTradesContext = {
  userId: number | string;
  userName?: string;
  feePerLotUsd: number;
  walletBalance: number;
  depositBaseline: number;
};

function tradeOpenedAt(r: UserTradeRowLike): string {
  const row = r as UserTradeRowLike & { open_time?: string | null; assignment_created_at?: string | null };
  return formatIsoDateTime(row.open_time ?? row.assignment_created_at ?? null);
}

function tradeClosedAt(r: UserTradeRowLike): string {
  if (!isTradeClosed(r)) return "";
  return formatIsoDateTime(tradeEffectiveCloseAt(r));
}

function num(v: number | null | undefined, digits = 2): number | "" {
  if (v == null || !Number.isFinite(v)) return "";
  return Number(v.toFixed(digits));
}

function toTradeRow(
  r: UserTradeRowLike,
  ctx: ExportUserTradesContext,
  facingMap: Map<string, number>,
): Record<string, string | number> {
  const open = isOpenTrade(r);
  const row = r as UserTradeRowLike & {
    user_fee_per_lot_usd?: number;
    reserved_exposure_usd?: number | null;
    admin_exposure_usd?: number | null;
    admin_absorbed_pl_usd?: number | null;
    admin_share_usd?: number | null;
    assignment_id?: number;
    ticket_id?: string | number;
    mt5_status?: string;
  };

  const slice = resolveEffectiveSlice({
    ...r,
    user_fee_per_lot_usd: row.user_fee_per_lot_usd ?? ctx.feePerLotUsd,
  });
  const { buyPrice, sellPrice } = resolveMt5BuySellPrices(r);
  const gross = proportionalRawPl(r);
  const walletPl = rowUserFacingPl(r, undefined, undefined, facingMap);
  const userExposure =
    row.reserved_exposure_usd != null ? Number(row.reserved_exposure_usd) : null;
  const adminExposure = row.admin_exposure_usd != null ? Number(row.admin_exposure_usd) : null;
  const adminRiskPl = row.admin_absorbed_pl_usd != null ? Number(row.admin_absorbed_pl_usd) : null;
  const perfFee = Number(row.admin_share_usd ?? 0);

  return {
    Ticket: String(row.ticket_id ?? ""),
    Symbol: String(r.symbol ?? ""),
    Side: formatMt5SideLabel(r.mt5_type),
    Opened: tradeOpenedAt(r),
    Closed: tradeClosedAt(r),
    Volume: slice.v_i > 0 ? num(slice.v_i, 4) : "",
    "Buy Price": buyPrice != null ? Number(buyPrice) : "",
    "Sell Price": sellPrice != null ? Number(sellPrice) : "",
    "Assign Fee (USD)": slice.fee > 0 ? num(slice.fee) : "",
    "Gross P/L (USD)": num(gross),
    "User Exposure (USD)": userExposure != null && userExposure > 0 ? num(userExposure) : "",
    "Admin Risk (USD)": adminExposure != null && adminExposure > 0.01 ? num(adminExposure) : "",
    "Risk P/L (USD)":
      adminRiskPl != null && Math.abs(adminRiskPl) > 0.001 ? num(adminRiskPl) : "",
    "Performance Fee (USD)": !open && perfFee > 0.001 ? num(perfFee) : "",
    "Wallet P/L (USD)": num(walletPl),
    Status: open ? String(row.mt5_status ?? "Open") : "Closed",
    "User Stopped": isUserStoppedTrade(r) ? "Yes" : "No",
  };
}

export function exportUserTradesToExcel(
  trades: UserTradeRowLike[],
  ctx: ExportUserTradesContext,
): void {
  if (!trades.length) {
    throw new Error("No trades to export");
  }

  const sorted = sortTradesChronological(trades).sort((a, b) => {
    const ta = new Date(
      String(
        (a as UserTradeRowLike & { open_time?: string }).open_time ??
          (a as UserTradeRowLike & { assignment_created_at?: string }).assignment_created_at ??
          "",
      ).replace(" ", "T"),
    ).getTime();
    const tb = new Date(
      String(
        (b as UserTradeRowLike & { open_time?: string }).open_time ??
          (b as UserTradeRowLike & { assignment_created_at?: string }).assignment_created_at ??
          "",
      ).replace(" ", "T"),
    ).getTime();
    return tb - ta;
  });

  const facingMap = buildSequentialUserFacingPlMap(
    trades,
    ctx.walletBalance,
    ctx.depositBaseline,
  );

  const rows = sorted.map((r) => toTradeRow(r, ctx, facingMap));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Trades");

  const stamp = new Date().toISOString().slice(0, 10);
  const slug = (ctx.userName || `user-${ctx.userId}`)
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40);
  XLSX.writeFile(wb, `tradeflow-trades-${slug}-${stamp}.xlsx`);
}
