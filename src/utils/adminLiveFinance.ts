import {
  isTradeClosed,
  proportionalRawPl,
  recomputeOpenUserLivePl,
  rowGrossPl,
  sortTradesChronological,
  type UserTradeRowLike,
} from "@/utils/userTradePl";

export type AdminFinanceOverlay = {
  live_pl: number;
  equity: number;
  withdrawable_equity: number;
};

/** Same sequential open-P/L walk as the user dashboard and backend settlement. */
export function recomputeUserLivePl(
  rows: UserTradeRowLike[],
  walletBalance: number,
  depositBaseline: number,
  liveProfitByTicket?: Record<string, number>,
): number {
  return recomputeOpenUserLivePl(
    rows,
    walletBalance,
    depositBaseline,
    liveProfitByTicket,
  );
}

export function buildFinanceOverlay(
  walletBalance: number,
  depositBaseline: number,
  openRows: UserTradeRowLike[],
  apiLivePl?: number | null,
  liveProfitByTicket?: Record<string, number>,
): AdminFinanceOverlay {
  const wallet = Math.max(0, Number(walletBalance) || 0);
  const openCount = openRows.filter((r) => !isTradeClosed(r)).length;
  const computed =
    wallet > 0.01 && openCount > 0
      ? recomputeUserLivePl(openRows, wallet, depositBaseline, liveProfitByTicket)
      : 0;
  const apiLive = apiLivePl != null ? Number(apiLivePl) : NaN;
  // Prefer socket-driven client recompute when open rows exist; API is fallback only.
  const live_pl =
    openCount > 0
      ? computed
      : Number.isFinite(apiLive)
        ? apiLive
        : 0;
  const equity = wallet <= 0.01 ? 0 : Math.max(0, Math.round((wallet + live_pl) * 100) / 100);
  const withdrawable_equity =
    openCount > 0 ? 0 : Math.max(0, Math.round(wallet * 100) / 100);
  return { live_pl, equity, withdrawable_equity };
}

export type AdminOpenAssignRow = UserTradeRowLike & {
  user_id?: unknown;
  user_name?: unknown;
  assignment_id?: unknown;
  assignment_created_at?: unknown;
  price?: unknown;
  admin_share_usd?: unknown;
  user_profit_share_pct?: unknown;
};

/** Estimate user vs admin split on proportional gross P/L (open trades). */
export function estimateGrossProfitSplit(grossPl: number, userSharePct = 50) {
  const gross = Math.round((Number(grossPl) || 0) * 100) / 100;
  const pct = Math.min(100, Math.max(0, Number(userSharePct) || 50));
  if (gross <= 0) {
    return {
      userShare: gross,
      adminShare: 0,
      userSharePct: pct,
      adminSharePct: Math.round((100 - pct) * 100) / 100,
    };
  }
  const userShare = Math.round(gross * (pct / 100) * 100) / 100;
  const adminShare = Math.round((gross - userShare) * 100) / 100;
  return {
    userShare,
    adminShare,
    userSharePct: pct,
    adminSharePct: Math.round((100 - pct) * 100) / 100,
  };
}

/** Resolved user + admin P/L for one assignment row (settled or live estimate). */
export function resolveRowAdminUserPl(
  r: AdminOpenAssignRow,
  ticket: string,
  live?: Record<string, number>,
) {
  const gross = rowGrossPl(r, live?.[ticket]);
  const userSharePct = Number(r.user_profit_share_pct ?? r.user_pct ?? r.snapshot_pct ?? 50) || 50;

  if (isTradeClosed(r)) {
    const userShare = Number(r.final_profit_loss ?? NaN);
    const adminShare = Number(r.admin_share_usd ?? NaN);
    if (Number.isFinite(userShare) && Number.isFinite(adminShare)) {
      return { gross, userShare, adminShare, estimate: false, userSharePct };
    }
  }

  const split = estimateGrossProfitSplit(gross, userSharePct);
  return {
    gross,
    userShare: split.userShare,
    adminShare: split.adminShare,
    estimate: true,
    userSharePct: split.userSharePct,
  };
}

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

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** How profit on this trade was applied: loss, baseline recovery, or normal split. */
export type TradeSettlementMode = "loss" | "recovery" | "normal" | "mixed";

export type TradeSettlementModeDetail = {
  mode: TradeSettlementMode;
  label: string;
  /** Gross P/L portion filling wallet up to deposit baseline (100% user). */
  recoveryGrossUsd: number;
  /** Gross P/L portion above baseline (split per frozen %). */
  normalGrossUsd: number;
  estimate: boolean;
};

function classifyFromGrossAndWallet(
  gross: number,
  walletBefore: number,
  depositBaseline: number,
  userSharePct: number,
  settledAdminShare?: number,
): TradeSettlementModeDetail {
  const g = round2(gross);
  const baseline = round2(depositBaseline);
  const adminPct = (100 - userSharePct) / 100;

  if (g <= 0) {
    return {
      mode: "loss",
      label: "Loss",
      recoveryGrossUsd: 0,
      normalGrossUsd: 0,
      estimate: false,
    };
  }

  if (settledAdminShare != null && Number.isFinite(settledAdminShare)) {
    const adminShare = round2(settledAdminShare);
    if (adminShare <= 0) {
      return {
        mode: "recovery",
        label: "Recovery",
        recoveryGrossUsd: g,
        normalGrossUsd: 0,
        estimate: false,
      };
    }
    if (adminPct <= 0) {
      return {
        mode: "normal",
        label: "Normal",
        recoveryGrossUsd: 0,
        normalGrossUsd: g,
        estimate: false,
      };
    }
    const normalGrossUsd = round2(adminShare / adminPct);
    const recoveryGrossUsd = round2(Math.max(0, g - normalGrossUsd));
    if (recoveryGrossUsd > 0.01 && normalGrossUsd > 0.01) {
      return {
        mode: "mixed",
        label: "Recovery + Normal",
        recoveryGrossUsd,
        normalGrossUsd,
        estimate: false,
      };
    }
    if (recoveryGrossUsd > 0.01) {
      return {
        mode: "recovery",
        label: "Recovery",
        recoveryGrossUsd,
        normalGrossUsd: 0,
        estimate: false,
      };
    }
    return {
      mode: "normal",
      label: "Normal",
      recoveryGrossUsd: 0,
      normalGrossUsd: g,
      estimate: false,
    };
  }

  const wallet = round2(walletBefore);
  const recoveryGap = round2(Math.max(0, baseline - wallet));
  const recoveryGrossUsd = round2(Math.min(g, recoveryGap));
  const normalGrossUsd = round2(g - recoveryGrossUsd);

  if (recoveryGrossUsd > 0.01 && normalGrossUsd > 0.01) {
    return {
      mode: "mixed",
      label: "Recovery + Normal",
      recoveryGrossUsd,
      normalGrossUsd,
      estimate: true,
    };
  }
  if (recoveryGrossUsd > 0.01) {
    return {
      mode: "recovery",
      label: "Recovery",
      recoveryGrossUsd,
      normalGrossUsd: 0,
      estimate: true,
    };
  }
  return {
    mode: "normal",
    label: "Normal",
    recoveryGrossUsd: 0,
    normalGrossUsd: g,
    estimate: true,
  };
}

/** Per-assignment settlement mode (loss / recovery / normal / mixed). */
export function buildTradeSettlementModeMap(
  rows: UserTradeRowLike[],
  depositBaseline: number,
  liveProfitByTicket?: Record<string, number>,
  facingMap?: Map<number, number>,
): Map<number, TradeSettlementModeDetail> {
  const map = new Map<number, TradeSettlementModeDetail>();
  const baseline = Math.max(0, depositBaseline);
  const ordered = sortTradesChronological(rows);

  let openRawSum = 0;
  for (const r of ordered) {
    if (isTradeClosed(r)) continue;
    const ticket = String(r.ticket_id ?? "");
    const live = ticket ? liveProfitByTicket?.[ticket] : undefined;
    openRawSum += proportionalRawPl(r, live);
  }
  openRawSum = round2(openRawSum);

  let simWallet = round2(Math.max(0, depositBaseline));

  for (const r of ordered) {
    const assignId = Number(r.assignment_id ?? 0);
    if (!assignId) continue;

    const ticket = String(r.ticket_id ?? "");
    const live = ticket ? liveProfitByTicket?.[ticket] : undefined;
    const gross = rowGrossPl(r, live);
    const userSharePct = Number(r.user_profit_share_pct ?? r.snapshot_pct ?? 50) || 50;
    const settled = r.wallet_settled_at != null;
    const closed = isTradeClosed(r);
    const raw = proportionalRawPl(r, live);

    let walletBefore = simWallet;
    if (!settled && !closed) {
      walletBefore = round2(simWallet + openRawSum - raw);
    } else if (!settled && closed) {
      walletBefore = round2(simWallet + openRawSum);
    }

    const adminShareUsd =
      settled && r.admin_share_usd != null ? Number(r.admin_share_usd) : undefined;

    map.set(
      assignId,
      classifyFromGrossAndWallet(gross, walletBefore, baseline, userSharePct, adminShareUsd),
    );

    if (settled) {
      simWallet = round2(simWallet + Number(r.final_profit_loss ?? 0));
    } else if (closed) {
      const pl = facingMap?.get(assignId) ?? Number(r.final_profit_loss ?? 0);
      simWallet = round2(simWallet + pl);
    }
  }

  return map;
}

export function settlementModeBadgeClass(mode: TradeSettlementMode): string {
  switch (mode) {
    case "loss":
      return "bg-red-50 text-red-700";
    case "recovery":
      return "bg-amber-50 text-amber-800";
    case "normal":
      return "bg-emerald-50 text-emerald-700";
    case "mixed":
      return "bg-violet-50 text-violet-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}
