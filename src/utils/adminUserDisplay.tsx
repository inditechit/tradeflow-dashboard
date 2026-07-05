import React from "react";
import { parseUserRiskIds } from "@/utils/userRiskProfile";

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

export function parseUserJoinMs(value: unknown): number | null {
  if (value == null) return null;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  const raw = String(value).trim();
  if (!raw || raw === "null" || raw === "undefined") return null;
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  let ms = Date.parse(normalized);
  if (!Number.isFinite(ms) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized)) {
    ms = Date.parse(`${normalized}Z`);
  }
  return Number.isFinite(ms) ? ms : null;
}

/** Sort key for admin user table — newest join first uses higher user id as tiebreaker. */
export function compareUsersByJoin(
  a: { id?: unknown; created_at?: unknown },
  b: { id?: unknown; created_at?: unknown },
  order: "joined_new" | "joined_old",
): number {
  const ta = parseUserJoinMs(a.created_at);
  const tb = parseUserJoinMs(b.created_at);
  let primary = 0;
  if (ta != null && tb != null) {
    primary = order === "joined_new" ? tb - ta : ta - tb;
  } else if (ta != null || tb != null) {
    primary = order === "joined_new" ? (ta != null ? -1 : 1) : ta != null ? 1 : -1;
  }
  if (primary !== 0) return primary;
  const idA = Number(a.id) || 0;
  const idB = Number(b.id) || 0;
  return order === "joined_new" ? idB - idA : idA - idB;
}

export function formatAdminDate(dateString: string) {
  if (!dateString) return "Unknown";
  const ms = parseUserJoinMs(dateString);
  if (ms == null) return "Unknown";
  return new Date(ms).toLocaleString();
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

  const parsedRisks = parseUserRiskIds(riskData);
  if (!parsedRisks.length) {
    return <span className="text-slate-500">{String(riskData)}</span>;
  }

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

export function referrerDisplayLabel(user: {
  referrer_id?: unknown;
  referrer_telegram?: unknown;
  referrer_name?: unknown;
  referrer_email?: unknown;
}): string {
  const parts = [user.referrer_telegram, user.referrer_name]
    .map((v) => (v != null ? String(v).trim() : ""))
    .filter(Boolean);
  if (parts.length) return parts.join(" · ");
  if (user.referrer_email) return String(user.referrer_email).trim();
  const rid = Number(user.referrer_id);
  return Number.isFinite(rid) && rid > 0 ? `#${rid}` : "—";
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
