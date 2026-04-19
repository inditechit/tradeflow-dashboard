import { tradeEventMs } from "@/utils/mt5TradeDates";

type TradeLike = {
  profit?: number | string | null;
  status?: string;
  open_time?: string | null;
  close_time?: string | null;
};

/**
 * User's monetary share of each trade's P/L: (profit × pct / 100).
 * When `joinMs` is set, only trades whose event time (close or open — see tradeEventMs) is >= joinMs count.
 */
export function aggregateUserProfitShare(
  trades: TradeLike[],
  joinMs: number | null,
  profitPercent: number | null
): number {
  const pct = Number(profitPercent);
  if (!Number.isFinite(pct) || pct <= 0) return 0;

  let sum = 0;
  for (const t of trades) {
    const raw = t.profit;
    if (raw === undefined || raw === null || raw === "") continue;
    const p = Number(raw);
    if (!Number.isFinite(p)) continue;

    if (joinMs != null) {
      const ev = tradeEventMs(t);
      if (ev == null || ev < joinMs) continue;
    }

    sum += (p * pct) / 100;
  }
  return sum;
}

export function formatMoneyAmount(n: number, currency = "USD"): string {
  const c = String(currency || "USD").toUpperCase();
  const code = /^[A-Z]{3}$/.test(c) ? c : "USD";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${code} ${n.toFixed(2)}`;
  }
}
