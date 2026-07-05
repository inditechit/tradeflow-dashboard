import * as XLSX from "xlsx";
import { packageDisplayName } from "@/constants/packages";
import { parseUserLabels } from "@/utils/adminUserLabels";
import type { AdminFinanceOverlay } from "@/utils/adminLiveFinance";

export type AdminUserExportRow = Record<string, unknown>;

function fmtDate(v: unknown): string {
  if (v == null || v === "") return "";
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? String(v) : d.toISOString();
}

function num(v: unknown, digits = 2): number | "" {
  const n = Number(v);
  return Number.isFinite(n) ? Number(n.toFixed(digits)) : "";
}

function yesNo(v: unknown): string {
  return Number(v) === 1 || v === true ? "Yes" : "No";
}

function toSheetRow(
  loc: AdminUserExportRow,
  finance?: AdminFinanceOverlay,
): Record<string, string | number> {
  const { label, tags } = parseUserLabels(loc);
  const walletBal = Number(loc.wallet_balance ?? 0);
  const livePl = finance?.live_pl ?? Number(loc.live_pl ?? 0);
  const equityVal = finance?.equity ?? Number(loc.equity ?? walletBal);
  const withdrawableVal =
    finance?.withdrawable_equity ?? Number(loc.withdrawable_equity ?? walletBal);
  const activePkg = String(loc.active_package_id ?? "").trim();

  return {
    "User ID": Number(loc.id) || "",
    Name: String(loc.name ?? ""),
    Email: String(loc.email ?? ""),
    Mobile: String(loc.mobile ?? ""),
    Telegram: String(loc.telegram ?? ""),
    "KYC Status": String(loc.kyc_status ?? ""),
    "Joined At": fmtDate(loc.created_at),
    "Referred By": (() => {
      const parts = [loc.referrer_telegram, loc.referrer_name]
        .map((v) => (v != null ? String(v).trim() : ""))
        .filter(Boolean);
      if (parts.length) return parts.join(" · ");
      if (loc.referrer_email) return String(loc.referrer_email);
      const rid = Number(loc.referrer_id);
      return Number.isFinite(rid) && rid > 0 ? `#${rid}` : "";
    })(),
    "Referrer ID": Number(loc.referrer_id) > 0 ? Number(loc.referrer_id) : "",
    Online: yesNo(loc.is_online),
    "Last Seen": fmtDate(loc.last_seen_at),
    Label: label,
    Tags: tags.join(", "),
    "Wallet Balance (USD)": num(walletBal),
    "Equity (USD)": num(equityVal),
    "Open P/L (USD)": num(livePl),
    "Withdrawable (USD)": num(withdrawableVal),
    "Open Positions": Number(loc.open_positions ?? 0) || 0,
    "Deposit Baseline (USD)": num(loc.deposit_baseline),
    "Recharge Count": Number(loc.recharge_success_count ?? 0) || 0,
    "Recharge Total (USD)": num(loc.recharge_total_usd),
    "Active Package": activePkg ? packageDisplayName(activePkg) : "",
    "Package Expires": fmtDate(loc.package_expires_at),
    "Last Package": loc.last_package_id
      ? packageDisplayName(String(loc.last_package_id))
      : "",
    "Last Package End": fmtDate(loc.last_package_end_at),
    "Package Expired": yesNo(loc.package_expired),
    "Profit %": num(loc.profit_percentage, 4),
    "Fee / Lot (USD)": num(loc.dollar_amount),
    "Risk Profile": String(loc.risk ?? ""),
    Experience: String(loc.experience ?? ""),
    "Deposit Method": String(loc.deposit_method ?? ""),
    Country: String(loc.country ?? ""),
    State: String(loc.state ?? ""),
    City: String(loc.city ?? ""),
    Address: String(loc.address ?? ""),
    Latitude: loc.latitude != null ? Number(loc.latitude) : "",
    Longitude: loc.longitude != null ? Number(loc.longitude) : "",
  };
}

export function exportUsersToExcel(
  users: AdminUserExportRow[],
  financeOverlay: Record<number, AdminFinanceOverlay> = {},
  opts?: { filenamePrefix?: string },
): void {
  if (!users.length) {
    throw new Error("No users to export");
  }

  const rows = users.map((loc) => {
    const uid = Number(loc.id);
    return toSheetRow(loc, Number.isFinite(uid) ? financeOverlay[uid] : undefined);
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Users");

  const stamp = new Date().toISOString().slice(0, 10);
  const prefix = opts?.filenamePrefix ?? "tradeflow-users";
  XLSX.writeFile(wb, `${prefix}-${stamp}.xlsx`);
}
