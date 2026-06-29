import React from "react";

export type TradeTableTotals = {
  fees: number;
  profit: number;
  loss: number;
  net: number;
};

export type TradeCapitalSummary = {
  totalDeposited?: number;
  totalWithdrawn?: number;
  walletBalance?: number;
  equity?: number;
  adminPendingShare?: number;
  userEquityShare?: number;
  userSharePct?: number;
};

type TradeSummaryFooterProps = {
  colSpan: number;
  trailingColSpan?: number;
  tableTotals: TradeTableTotals;
  capital?: TradeCapitalSummary;
  profitLabel?: string;
  fmtUsd: (n: number) => string;
  plTextClass: (n: number) => string;
};

export function TradeSummaryFooter({
  colSpan,
  trailingColSpan = 1,
  tableTotals,
  capital,
  profitLabel = "your share",
  fmtUsd,
  plTextClass,
}: TradeSummaryFooterProps) {
  const hasCapital =
    capital != null &&
    (capital.totalDeposited != null ||
      capital.totalWithdrawn != null ||
      capital.walletBalance != null);

  return (
    <tfoot className="border-t-2 border-slate-200 bg-slate-50">
      <tr>
        <td colSpan={colSpan} className="px-6 py-3 text-right text-sm font-semibold text-slate-700">
          Total fees
        </td>
        <td className="px-6 py-3 text-sm font-bold tabular-nums text-slate-800">
          {fmtUsd(tableTotals.fees)}
        </td>
        {trailingColSpan > 0 && <td colSpan={trailingColSpan} />}
      </tr>
      <tr>
        <td colSpan={colSpan} className="px-6 py-3 text-right text-sm font-semibold text-slate-700">
          Complete profit ({profitLabel})
        </td>
        <td className="px-6 py-3 text-sm font-bold tabular-nums text-emerald-600">
          {fmtUsd(tableTotals.profit)}
        </td>
        {trailingColSpan > 0 && <td colSpan={trailingColSpan} />}
      </tr>
      <tr>
        <td colSpan={colSpan} className="px-6 py-3 text-right text-sm font-semibold text-slate-700">
          Complete loss ({profitLabel})
        </td>
        <td className="px-6 py-3 text-sm font-bold tabular-nums text-red-600">
          {fmtUsd(tableTotals.loss)}
        </td>
        {trailingColSpan > 0 && <td colSpan={trailingColSpan} />}
      </tr>
      <tr className="border-t border-slate-200">
        <td colSpan={colSpan} className="px-6 py-3 text-right text-sm font-bold text-slate-800">
          Net P/L ({profitLabel})
        </td>
        <td
          className={`px-6 py-3 text-sm font-extrabold tabular-nums ${
            tableTotals.net >= 0 ? plTextClass(tableTotals.net) : plTextClass(-1)
          }`}
        >
          {fmtUsd(tableTotals.net)}
        </td>
        {trailingColSpan > 0 && <td colSpan={trailingColSpan} />}
      </tr>
      {hasCapital && (
        <>
          <tr className="border-t border-slate-200">
            <td colSpan={colSpan} className="px-6 py-3 text-right text-sm font-semibold text-slate-600">
              Total deposited
            </td>
            <td className="px-6 py-3 text-sm font-semibold tabular-nums text-slate-700">
              {fmtUsd(capital?.totalDeposited ?? 0)}
            </td>
            {trailingColSpan > 0 && <td colSpan={trailingColSpan} />}
          </tr>
          <tr>
            <td colSpan={colSpan} className="px-6 py-3 text-right text-sm font-semibold text-slate-600">
              Total withdrawl
            </td>
            <td className="px-6 py-3 text-sm font-semibold tabular-nums text-slate-700">
              {fmtUsd(capital?.totalWithdrawn ?? 0)}
            </td>
            {trailingColSpan > 0 && <td colSpan={trailingColSpan} />}
          </tr>
          <tr>
            <td colSpan={colSpan} className="px-6 py-3 text-right text-sm font-bold text-slate-800">
              Current wallet (settled)
            </td>
            <td className="px-6 py-3 text-sm font-extrabold tabular-nums text-slate-900">
              {fmtUsd(capital?.walletBalance ?? 0)}
            </td>
            {trailingColSpan > 0 && <td colSpan={trailingColSpan} />}
          </tr>
          {capital?.equity != null && capital.equity > 0 && (
            <tr>
              <td colSpan={colSpan} className="px-6 py-3 text-right text-sm font-semibold text-slate-600">
                Equity (incl. open P/L)
              </td>
              <td className="px-6 py-3 text-sm font-bold tabular-nums text-slate-800">
                {fmtUsd(capital.equity)}
              </td>
              {trailingColSpan > 0 && <td colSpan={trailingColSpan} />}
            </tr>
          )}
          {capital?.adminPendingShare != null && capital.adminPendingShare > 0.01 && (
            <>
              <tr className="border-t border-slate-200">
                <td colSpan={colSpan} className="px-6 py-3 text-right text-sm font-semibold text-slate-600">
                  Performance fee (admin
                  {capital.userSharePct ? ` ${100 - capital.userSharePct}%` : ""})
                </td>
                <td className="px-6 py-3 text-sm font-semibold tabular-nums text-slate-500">
                  − {fmtUsd(capital.adminPendingShare)}
                </td>
                {trailingColSpan > 0 && <td colSpan={trailingColSpan} />}
              </tr>
              <tr>
                <td colSpan={colSpan} className="px-6 py-3 text-right text-sm font-bold text-emerald-800">
                  User share (withdrawable preview)
                </td>
                <td className="px-6 py-3 text-sm font-extrabold tabular-nums text-emerald-800">
                  {fmtUsd(capital.userEquityShare ?? 0)}
                </td>
                {trailingColSpan > 0 && <td colSpan={trailingColSpan} />}
              </tr>
            </>
          )}
        </>
      )}
    </tfoot>
  );
}
