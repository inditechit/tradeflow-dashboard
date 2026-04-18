/** Local calendar day bounds from `<input type="date">` value `YYYY-MM-DD`. */
export function startOfDayMs(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

export function endOfDayMs(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}

export function normTradeStatus(t: { status?: string }) {
  return String(t?.status ?? "").toUpperCase();
}

/**
 * Timestamp used for date-range filtering:
 * - CLOSED: prefer close_time, else open_time (API sometimes omits close_time).
 * - OPEN: open_time.
 */
export function tradeEventMs(t: {
  status?: string;
  open_time?: string | null;
  close_time?: string | null;
}): number | null {
  const st = normTradeStatus(t);
  const raw =
    st === "CLOSED" ? t.close_time || t.open_time : t.open_time;
  if (!raw) return null;
  const ms = Date.parse(String(raw));
  return Number.isFinite(ms) ? ms : null;
}

/** Empty `dateFrom` / `dateTo` means no bound on that side. */
export function tradeInDateRange(
  t: {
    status?: string;
    open_time?: string | null;
    close_time?: string | null;
  },
  dateFrom: string,
  dateTo: string
): boolean {
  if (!dateFrom && !dateTo) return true;
  const ms = tradeEventMs(t);
  if (ms == null) return false;
  if (dateFrom && ms < startOfDayMs(dateFrom)) return false;
  if (dateTo && ms > endOfDayMs(dateTo)) return false;
  return true;
}

export function formatIsoDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.parse(String(iso));
  if (!Number.isFinite(ms)) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(ms);
}
