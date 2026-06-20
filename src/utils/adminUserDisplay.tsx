import React from "react";

export function kycBadgeStyles(status: string | undefined | null) {
  const s = String(status ?? "pending").toLowerCase();
  if (s === "verified") return "border-yellow-200 bg-[#FFF9E6] text-neutral-900";
  if (s === "submitted") return "border-amber-200 bg-amber-50 text-amber-900";
  if (s === "rejected") return "border-red-200 bg-red-50 text-red-900";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function parseCoord(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

export function userHasMapLink(loc: { latitude?: unknown; longitude?: unknown; address?: unknown }): boolean {
  const lat = parseCoord(loc.latitude);
  const lng = parseCoord(loc.longitude);
  if (lat != null && lng != null) return true;
  const addr = loc.address != null ? String(loc.address).trim() : "";
  return addr.length > 0;
}

export function lastSeenLabel(lastSeenAt: unknown, isOnline: unknown): string {
  if (Number(isOnline) === 1) return "Online";
  if (!lastSeenAt) return "Never";
  const t = new Date(String(lastSeenAt).replace(" ", "T")).getTime();
  if (!Number.isFinite(t)) return "—";
  const diffSec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const m = Math.floor(diffSec / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function formatAdminDate(dateString: string) {
  if (!dateString) return "Unknown";
  return new Date(dateString).toLocaleString();
}

function getRiskStyle(riskLevel: string) {
  switch (riskLevel) {
    case "LOW":
      return "bg-green-100 text-green-800 border-green-300";
    case "MEDIUM":
      return "bg-yellow-100 text-yellow-800 border-yellow-300";
    case "HIGH":
      return "bg-orange-100 text-orange-800 border-orange-300";
    case "SUPER_HIGH":
      return "bg-red-100 text-red-800 border-red-300";
    default:
      return "bg-slate-100 text-slate-800 border-slate-300";
  }
}

export function renderRiskBadges(riskData: unknown) {
  if (!riskData) return "—";

  let parsedRisks: string[] = [];
  try {
    parsedRisks = typeof riskData === "string" ? JSON.parse(riskData) : (riskData as string[]);
  } catch {
    return <span className="text-slate-500">{String(riskData)}</span>;
  }

  if (!Array.isArray(parsedRisks) || parsedRisks.length === 0) return "—";

  return (
    <div className="flex flex-wrap gap-1.5">
      {parsedRisks.map((risk, index) => (
        <span
          key={index}
          className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getRiskStyle(risk)}`}
        >
          {risk.replace("_", " ")}
        </span>
      ))}
    </div>
  );
}

export function walletBalanceOf(user: { wallet_balance?: unknown }): number {
  return Number(user.wallet_balance ?? 0);
}

/** Equity (wallet + open P/L) minus deposit baseline — same basis as P/L report. */
export function userPlVsDeposit(user: {
  wallet_balance?: unknown;
  equity?: unknown;
  deposit_baseline?: unknown;
  equity_pl?: unknown;
}): number {
  const fromApi = Number(user.equity_pl);
  if (Number.isFinite(fromApi) && user.equity_pl != null && user.equity_pl !== "") {
    return fromApi;
  }
  const baseline = Number(user.deposit_baseline ?? 0);
  const wallet = walletBalanceOf(user);
  const equity = Number(user.equity ?? wallet);
  return Math.round((equity - baseline) * 100) / 100;
}
