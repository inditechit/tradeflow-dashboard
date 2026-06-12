import {
  isTradeClosed,
  proportionalRawPl,
  rowUserSharePl,
  type UserTradeRowLike,
} from "@/utils/userTradePl";

export type AdminFinanceOverlay = {
  live_pl: number;
  equity: number;
  withdrawable_equity: number;
};

/** Same sequential open-P/L walk as the user dashboard. */
export function recomputeUserLivePl(
  rows: UserTradeRowLike[],
  walletBalance: number,
  depositBaseline: number,
): number {
  const wallet = Math.max(0, Number(walletBalance) || 0);
  const baseline = Math.max(0, Number(depositBaseline) || 0);
  const openRows = rows.filter((r) => !isTradeClosed(r));
  if (wallet <= 0.01 || !openRows.length) return 0;

  let openRawSum = 0;
  const rawByTicket = new Map<string, number>();
  for (const r of openRows) {
    const ticket = String(r.ticket_id ?? "");
    const raw = proportionalRawPl(r);
    if (ticket) rawByTicket.set(ticket, raw);
    openRawSum += raw;
  }

  let sum = 0;
  for (const r of openRows) {
    const ticket = String(r.ticket_id ?? "");
    const raw = rawByTicket.get(ticket) ?? proportionalRawPl(r);
    const equityBefore = wallet + openRawSum - raw;
    sum += rowUserSharePl(r, undefined, {
      walletBefore: wallet,
      depositBaseline: baseline,
      equityBefore,
    });
  }
  return Math.round(sum * 100) / 100;
}

export function buildFinanceOverlay(
  walletBalance: number,
  depositBaseline: number,
  openRows: UserTradeRowLike[],
): AdminFinanceOverlay {
  const wallet = Math.max(0, Number(walletBalance) || 0);
  const openCount = openRows.filter((r) => !isTradeClosed(r)).length;
  const live_pl =
    wallet > 0.01 && openCount > 0
      ? recomputeUserLivePl(openRows, wallet, depositBaseline)
      : 0;
  const equity = wallet <= 0.01 ? 0 : Math.max(0, Math.round((wallet + live_pl) * 100) / 100);
  const withdrawable_equity =
    openCount > 0 ? 0 : Math.max(0, Math.round(wallet * 100) / 100);
  return { live_pl, equity, withdrawable_equity };
}

export type AdminOpenAssignRow = UserTradeRowLike & { user_id?: unknown };

export function groupOpenRowsByUser(
  assignments: AdminOpenAssignRow[],
): Record<number, UserTradeRowLike[]> {
  const out: Record<number, UserTradeRowLike[]> = {};
  for (const row of assignments) {
    const uid = Number((row as AdminOpenAssignRow).user_id);
    if (!uid) continue;
    if (!out[uid]) out[uid] = [];
    out[uid].push(row);
  }
  return out;
}
