/** Consistent profit (green) / loss (red) styling across the app. */

export function plTextClass(value: number | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return "text-slate-500";
  return n > 0 ? "text-emerald-600" : "text-red-600";
}

export function plBadgeClass(isProfit: boolean): string {
  return isProfit ? "bg-emerald-50 text-emerald-700" : "bg-red-100 text-red-700";
}

export function plDotClass(isProfit: boolean): string {
  return isProfit ? "bg-emerald-500" : "bg-red-500";
}
