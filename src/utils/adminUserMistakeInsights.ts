import {
  isUserStoppedTrade,
  proportionalRawPl,
  type UserTradeRowLike,
} from "@/utils/userTradePl";

export type MistakeSeverity = "high" | "medium" | "info";

export type MistakeInsight = {
  id: string;
  severity: MistakeSeverity;
  title: string;
  detail: string;
  amountUsd?: number;
};

export type ManualStopSettlementRow = {
  ticket: string;
  symbol?: string | null;
  stop_snapshot_at?: string | null;
  stop_snapshot_gross_pl_usd?: number | null;
  user_share_usd?: number | null;
  pool_share_pct?: number | null;
  mt5_profit?: number | null;
  master_still_open?: boolean;
};

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function fmtUsd(n: number): string {
  return `$${round2(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Estimate user gross from master profit × pool share (fraction or percent). */
function estimateGrossFromMaster(masterProfit: number, poolSharePct: number): number {
  const pct = Number(poolSharePct) || 0;
  const fraction = pct > 1 ? pct / 100 : pct;
  return round2(masterProfit * fraction);
}

/**
 * Build admin "mistake" insights: missed top-up after deep drawdown,
 * and early Stop trade opportunity cost vs holding to master close.
 */
export function buildUserMistakeInsights(input: {
  depositBaseline: number;
  walletBalance: number;
  equity: number;
  totalDeposited: number;
  depositHistory?: Array<{ kind?: string; amount_usd?: number; effective_at?: string }>;
  trades: UserTradeRowLike[];
  stopSettlements?: ManualStopSettlementRow[];
}): MistakeInsight[] {
  const insights: MistakeInsight[] = [];
  const baseline = Math.max(0, Number(input.depositBaseline) || 0);
  const wallet = Math.max(0, Number(input.walletBalance) || 0);
  const equity = Math.max(0, Number(input.equity) || wallet);
  const underwater = Math.min(wallet, equity);

  // --- Missed top-up after ~70%+ loss from baseline ---
  if (baseline >= 20 && underwater <= baseline * 0.4) {
    const lossPct = round2((1 - underwater / baseline) * 100);
    const recoveryNeed = round2(Math.max(0, baseline - wallet));
    const recharges = (input.depositHistory ?? []).filter((d) => {
      const kind = String(d.kind ?? "").toLowerCase();
      return kind.includes("recharge") || kind === "deposit" || kind === "payment";
    });
    const lastRecharge = recharges.length
      ? [...recharges].sort((a, b) =>
          String(b.effective_at ?? "").localeCompare(String(a.effective_at ?? "")),
        )[0]
      : null;

    insights.push({
      id: "missed-topup-drawdown",
      severity: lossPct >= 70 ? "high" : "medium",
      title: `Deep drawdown (~${lossPct}% below baseline) — no recovery top-up`,
      detail: `Baseline ${fmtUsd(baseline)} → wallet/equity ~${fmtUsd(underwater)}. User should have topped up ~${fmtUsd(recoveryNeed)} to restore capital before continuing. ${
        lastRecharge?.effective_at
          ? `Last funding recorded ${String(lastRecharge.effective_at)}. `
          : ""
      }While underwater, further losses compound on a smaller wallet.`,
      amountUsd: recoveryNeed,
    });
  }

  // --- Early stop vs holding ---
  const stops =
    input.stopSettlements?.length
      ? input.stopSettlements
      : input.trades.filter(isUserStoppedTrade).map((r) => ({
          ticket: String(r.ticket_id ?? ""),
          symbol: r.symbol != null ? String(r.symbol) : null,
          stop_snapshot_at: r.stop_snapshot_at != null ? String(r.stop_snapshot_at) : null,
          stop_snapshot_gross_pl_usd:
            r.stop_snapshot_gross_pl_usd != null
              ? Number(r.stop_snapshot_gross_pl_usd)
              : null,
          user_share_usd:
            r.final_profit_loss != null ? Number(r.final_profit_loss) : null,
          pool_share_pct:
            r.pool_share_pct != null ? Number(r.pool_share_pct) : null,
          mt5_profit:
            r.master_profit_usd != null
              ? Number(r.master_profit_usd)
              : r.mt5_total_profit != null
                ? Number(r.mt5_total_profit)
                : null,
          master_still_open: !String(r.mt5_status ?? "")
            .toUpperCase()
            .includes("CLOSE"),
        }));

  let stopMissedTotal = 0;
  const stopDetails: string[] = [];

  for (const s of stops) {
    const locked =
      s.stop_snapshot_gross_pl_usd != null && Number.isFinite(s.stop_snapshot_gross_pl_usd)
        ? round2(s.stop_snapshot_gross_pl_usd)
        : null;
    if (locked == null) continue;

    let wouldBe: number | null = null;
    if (s.mt5_profit != null && Number.isFinite(s.mt5_profit) && s.pool_share_pct != null) {
      wouldBe = estimateGrossFromMaster(Number(s.mt5_profit), Number(s.pool_share_pct));
    } else {
      const trade = input.trades.find((t) => String(t.ticket_id ?? "") === String(s.ticket));
      if (trade) {
        const master =
          trade.master_profit_usd != null
            ? Number(trade.master_profit_usd)
            : Number(trade.mt5_total_profit ?? NaN);
        if (Number.isFinite(master)) {
          wouldBe = round2(proportionalRawPl(trade, master));
        }
      }
    }

    if (wouldBe == null || !Number.isFinite(wouldBe)) continue;
    const missed = round2(wouldBe - locked);
    // Only flag when holding would have been materially better
    if (missed > 1) {
      stopMissedTotal = round2(stopMissedTotal + missed);
      const when = s.stop_snapshot_at ? String(s.stop_snapshot_at) : "stop time";
      stopDetails.push(
        `#${s.ticket}${s.symbol ? ` ${s.symbol}` : ""}: stopped at ${fmtUsd(locked)} gross (${when}); if held → ~${fmtUsd(wouldBe)} (${s.master_still_open ? "master still open / current" : "master close"}). Left ~${fmtUsd(missed)} on the table.`,
      );
    }
  }

  if (stopDetails.length) {
    insights.push({
      id: "early-stop-opportunity",
      severity: stopMissedTotal >= 50 ? "high" : "medium",
      title: `Stopped trade(s) early — ~${fmtUsd(stopMissedTotal)} missed vs holding`,
      detail: stopDetails.slice(0, 8).join(" "),
      amountUsd: stopMissedTotal,
    });
  }

  // --- Stopped while already in strong profit (cautionary) ---
  const stoppedInProfit = stops.filter((s) => Number(s.stop_snapshot_gross_pl_usd ?? 0) > 5);
  if (stoppedInProfit.length && !stopDetails.length) {
    const sum = round2(
      stoppedInProfit.reduce((a, s) => a + Number(s.stop_snapshot_gross_pl_usd ?? 0), 0),
    );
    insights.push({
      id: "stopped-in-profit",
      severity: "info",
      title: `Stopped while in profit (${stoppedInProfit.length} trade(s), ~${fmtUsd(sum)} locked)`,
      detail:
        "User locked gains with Stop. Compare against master close if you need to judge whether holding would have paid more.",
      amountUsd: sum,
    });
  }

  return insights;
}
