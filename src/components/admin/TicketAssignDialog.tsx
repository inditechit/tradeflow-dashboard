import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatIsoDateTime } from "@/utils/mt5TradeDates";
import {
  fmtMt5Price,
  isTradeClosed,
  isUserStoppedTrade,
  resolveEffectiveSlice,
  resolveMt5BuySellPrices,
  type UserTradeRowLike,
} from "@/utils/userTradePl";
import { UserStoppedTradeBadge } from "@/components/trades/UserStoppedTradeBadge";
import { plTextClass } from "@/utils/plColors";
import type { AdminOpenAssignRow } from "@/utils/adminLiveFinance";
import { resolveRowAdminUserPl } from "@/utils/adminLiveFinance";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";

export type TicketAssignDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string | null;
  symbol?: string;
  rows: AdminOpenAssignRow[];
  liveProfitByTicket?: Record<string, number>;
  onRequestManualAssign?: (ticketId: string) => void;
};

function fmtUsd(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function investedUsd(r: AdminOpenAssignRow): number {
  const inv = Number(r.user_investment_amount ?? 0);
  if (inv > 0) return inv;
  const bal = Number(String(r.user_bal ?? "").trim());
  return Number.isFinite(bal) && bal > 0 ? bal : 0;
}

function sharePct(r: AdminOpenAssignRow): number | null {
  const { effectiveShare } = resolveEffectiveSlice(r);
  if (!(effectiveShare > 0)) return null;
  return Math.round(effectiveShare * 10000) / 100;
}

export function TicketAssignDialog({
  open,
  onOpenChange,
  ticketId,
  symbol,
  rows,
  liveProfitByTicket,
  onRequestManualAssign,
}: TicketAssignDialogProps) {
  const ticket = ticketId ?? "";
  const sample = rows[0];
  const priceRow: UserTradeRowLike = sample
    ? { ...sample, ticket_id: ticket, symbol: symbol ?? sample.symbol }
    : { ticket_id: ticket, symbol };
  const { buyPrice, sellPrice, buyIsLive, sellIsLive } = resolveMt5BuySellPrices(
    priceRow,
    undefined,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">
            Ticket {ticket}
            {symbol ? ` · ${symbol}` : ""}
          </DialogTitle>
          <p className="text-sm text-slate-500">
            {rows.length} user{rows.length === 1 ? "" : "s"} assigned
            {(buyPrice != null || sellPrice != null) && (
              <span className="ml-2 text-slate-600">
                · Open{" "}
                {buyPrice != null
                  ? `${buyIsLive ? "~" : ""}${fmtMt5Price(buyPrice, symbol)}`
                  : "—"}
                {" · "}
                Close{" "}
                {sellPrice != null
                  ? `${sellIsLive ? "~" : ""}${fmtMt5Price(sellPrice, symbol)}`
                  : "—"}
              </span>
            )}
          </p>
        </DialogHeader>

        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
                <th className="px-3 py-2.5 font-bold">User</th>
                <th className="px-3 py-2.5 font-bold">Share %</th>
                <th className="px-3 py-2.5 font-bold">Invested</th>
                <th className="px-3 py-2.5 font-bold">Volume</th>
                <th className="px-3 py-2.5 font-bold">Assigned</th>
                <th className="px-3 py-2.5 font-bold">Gross P/L</th>
                <th className="px-3 py-2.5 font-bold">Admin P/L</th>
                <th className="px-3 py-2.5 font-bold">User share</th>
                <th className="px-3 py-2.5 font-bold">Split</th>
                <th className="px-3 py-2.5 font-bold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => {
                const uid = Number(r.user_id);
                const name = String((r as AdminOpenAssignRow & { user_name?: string }).user_name ?? `#${uid}`);
                const { v_i } = resolveEffectiveSlice(r);
                const pct = sharePct(r);
                const closed = isTradeClosed(r);
                const split = resolveRowAdminUserPl(r, ticket, liveProfitByTicket);
                const { gross, userShare, adminShare, estimate, userSharePct } = split;
                return (
                  <tr key={String(r.assignment_id ?? `${uid}-${ticket}`)} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-slate-900">{name}</div>
                      <div className="text-xs text-slate-500">#{uid}</div>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-slate-700">
                      {pct != null ? `${pct.toFixed(2)}%` : "—"}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-slate-800">
                      {fmtUsd(investedUsd(r))}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-slate-700">
                      {v_i > 0 ? v_i.toFixed(4) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-600">
                      {formatIsoDateTime(
                        r.assignment_created_at ?? r.open_time ?? null,
                      )}
                    </td>
                    <td
                      className={`px-3 py-2.5 font-semibold tabular-nums ${plTextClass(gross)}`}
                    >
                      {closed ? fmtUsd(gross) : `~${fmtUsd(gross)}`}
                    </td>
                    <td
                      className={`px-3 py-2.5 font-semibold tabular-nums ${plTextClass(adminShare)}`}
                    >
                      {closed && !estimate ? fmtUsd(adminShare) : `~${fmtUsd(adminShare)}`}
                    </td>
                    <td
                      className={`px-3 py-2.5 font-semibold tabular-nums ${plTextClass(userShare)}`}
                    >
                      {closed && !estimate ? fmtUsd(userShare) : `~${fmtUsd(userShare)}`}
                    </td>
                    <td className="px-3 py-2.5 text-xs tabular-nums text-slate-600">
                      {userSharePct}/{Math.round((100 - userSharePct) * 100) / 100}
                    </td>
                    <td className="px-3 py-2.5">
                      {isUserStoppedTrade(r) ? (
                        <UserStoppedTradeBadge row={r} variant="admin" showTime />
                      ) : closed ? (
                        <span className="text-xs text-slate-500">Closed</span>
                      ) : (
                        <span className="text-xs text-sky-700">Open</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {onRequestManualAssign && ticket && (
          <div className="flex justify-end border-t border-slate-100 pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 border-yellow-200 bg-yellow-50 text-yellow-900 hover:bg-yellow-100"
              onClick={() => onRequestManualAssign(ticket)}
            >
              <UserPlus className="h-4 w-4" />
              Assign user to this ticket
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
