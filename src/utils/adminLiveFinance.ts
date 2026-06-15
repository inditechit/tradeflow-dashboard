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

export type FinanceUserRow = {
  id: number;
  wallet_balance?: number;
  deposit_baseline?: number;
};

/** Sum wallets + socket-based open user P/L + pending withdrawals. */
export function sumPlatformLiveLiability(
  users: FinanceUserRow[],
  openRowsByUser: Record<number, UserTradeRowLike[]>,
  pendingWithdrawalsUsd: number,
) {
  let wallets = 0;
  let livePl = 0;
  for (const u of users) {
    const uid = Number(u.id);
    if (!uid) continue;
    const wallet = Number(u.wallet_balance ?? 0);
    wallets += wallet;
    const rows = openRowsByUser[uid] ?? [];
    livePl += buildFinanceOverlay(
      wallet,
      Number(u.deposit_baseline ?? 0),
      rows,
    ).live_pl;
  }
  wallets = Math.round(wallets * 100) / 100;
  livePl = Math.round(livePl * 100) / 100;
  const pending = Math.round((Number(pendingWithdrawalsUsd) || 0) * 100) / 100;
  return {
    wallets_usd: wallets,
    open_live_user_pl_usd: livePl,
    pending_withdrawals_usd: pending,
    owe_users_now_usd: Math.round((wallets + pending + livePl) * 100) / 100,
  };
}

/** Master open P/L from unique tickets (uses socket-updated mt5_total_profit on rows). */
export function sumSocketMt5OpenProfit(
  openRowsByUser: Record<number, UserTradeRowLike[]>,
): number {
  const seen = new Set<string>();
  let sum = 0;
  for (const rows of Object.values(openRowsByUser)) {
    for (const r of rows) {
      if (isTradeClosed(r)) continue;
      const ticket = String(r.ticket_id ?? "");
      if (!ticket || seen.has(ticket)) continue;
      seen.add(ticket);
      const p = Number(r.mt5_total_profit ?? 0);
      if (Number.isFinite(p)) sum += p;
    }
  }
  return Math.round(sum * 100) / 100;
}
