/** Frontend-only masking for admin PII (name / email / mobile). */

export type PiiKind = "name" | "email" | "mobile";

export function maskName(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "—";
  if (s.length <= 1) return `${s}***`;
  if (s.length <= 3) return `${s[0]}***`;
  return `${s.slice(0, 3)}***`;
}

/** e.g. shubham@gmail.com → Shu***@***.com */
export function maskEmail(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "—";
  const at = s.indexOf("@");
  if (at <= 0) return maskName(s);
  const local = s.slice(0, at);
  const domain = s.slice(at + 1);
  const localVis = local.slice(0, Math.min(3, local.length));
  const tldMatch = domain.match(/\.([^.]+)$/);
  const tld = tldMatch?.[1] || "com";
  return `${localVis}***@***.${tld}`;
}

/** e.g. 9876543210 → ******10 */
export function maskMobile(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "—";
  const digits = s.replace(/\D/g, "");
  if (!digits) return "******";
  if (digits.length <= 2) return `******${digits}`;
  return `******${digits.slice(-2)}`;
}

export function maskPii(raw: unknown, kind: PiiKind): string {
  if (raw == null || String(raw).trim() === "") return "—";
  switch (kind) {
    case "email":
      return maskEmail(raw);
    case "mobile":
      return maskMobile(raw);
    default:
      return maskName(raw);
  }
}
