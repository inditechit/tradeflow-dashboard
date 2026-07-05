import { VALID_RISK_IDS, type RiskId } from "@/constants/riskProfiles";

const VALID_SET = new Set<string>(VALID_RISK_IDS);

export function parseUserRiskIds(riskRaw: unknown): RiskId[] {
  if (riskRaw == null || riskRaw === "") return [];

  let items: unknown[] = [];
  if (Array.isArray(riskRaw)) {
    items = riskRaw;
  } else if (typeof riskRaw === "string") {
    const s = riskRaw.trim();
    if (!s || s === "null") return [];
    try {
      const parsed = JSON.parse(s);
      items = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      const id = s.toUpperCase();
      return VALID_SET.has(id) ? [id as RiskId] : [];
    }
  } else {
    return [];
  }

  const out: RiskId[] = [];
  for (const item of items) {
    const id = String(item).trim().toUpperCase();
    if (VALID_SET.has(id) && !out.includes(id as RiskId)) {
      out.push(id as RiskId);
    }
  }
  return out;
}

/** True when user must pick exactly one risk (e.g. legacy multi-select). */
export function userNeedsRiskReselection(riskRaw: unknown): boolean {
  const risks = parseUserRiskIds(riskRaw);
  if (risks.length > 1) return true;

  const raw = riskRaw == null ? "" : String(riskRaw).trim();
  const hadStoredValue = raw !== "" && raw !== "[]" && raw !== "null";
  if (hadStoredValue && risks.length === 0) return true;

  return false;
}

export function riskProfileLabel(riskId: RiskId): string {
  return riskId.replace(/_/g, " ");
}
