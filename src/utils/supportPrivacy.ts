const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /(^|[^\d])(\+?\d(?:[\s().-]*\d){6,14})(?!\d)/g;

/** Mask contact details in support messages on the client as an extra safeguard. */
export function maskSupportContactInfo(value: unknown): string {
  return String(value ?? "")
    .replace(EMAIL_PATTERN, "***")
    .replace(PHONE_PATTERN, (_match, prefix: string) => `${prefix}***`);
}
