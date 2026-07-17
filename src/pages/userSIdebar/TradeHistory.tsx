import React, { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import {
  rowUserFacingPl,
  buildSequentialUserFacingPlMap,
  type UserTradeRowLike,
} from "@/utils/userTradePl";

import { API_BASE } from "@/config/api";
import { fetchAllUserTrades } from "@/utils/fetchAllUserTrades";
import { Mt5TradeHistoryList } from "@/components/trades/Mt5TradeHistoryList";

type UserTradeRow = UserTradeRowLike & {
  ticket_id: string;
  assignment_id?: number;
  open_time?: string | null;
  close_time?: string | null;
  assignment_created_at?: string | null;
  history_archived?: boolean;
  balance_after_usd?: number | null;
};

const TradeHistory = () => {
  const navigate = useNavigate();
  const { currentUser } = useApp();
  const [rows, setRows] = useState<UserTradeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [assignFunded, setAssignFunded] = useState(true);
  const [walletBalance, setWalletBalance] = useState(0);
  const [depositBaseline, setDepositBaseline] = useState(0);
  const [currency, setCurrency] = useState("USD");
  const [archivedCount, setArchivedCount] = useState(0);

  const fetchAssignedTickets = async () => {
    if (!currentUser?.userId) return;
    try {
      const res = await fetch(`${API_BASE}/user/trade-assign/${currentUser.userId}`);
      const data = await res.json();
      setAssignFunded(data?.funded !== false);
    } catch (err) {
      console.error("trade-assign:", err);
    }
  };

  const fetchUserTrades = async () => {
    if (!currentUser?.userId) return;
    try {
      setLoading(true);
      const [data, summaryRes] = await Promise.all([
        fetchAllUserTrades(currentUser.userId),
        fetch(`${API_BASE}/user/summary/${currentUser.userId}`),
      ]);
      const summaryData = await summaryRes.json();
      if (summaryData?.success) {
        setWalletBalance(Number(summaryData.wallet_balance ?? 0));
        setDepositBaseline(
          Number(summaryData.deposit_baseline ?? summaryData.total_invested ?? 0),
        );
        setCurrency(summaryData.currency || "USD");
      }
      setRows(data.trades as UserTradeRow[]);
      setArchivedCount(Number(data.archived_trade_count ?? 0));
    } catch (err) {
      console.error("user/trades:", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchAssignedTickets();
    fetchUserTrades();
  };

  useEffect(() => {
    if (!currentUser?.userId) return;
    fetchAssignedTickets();
    fetchUserTrades();
  }, [currentUser?.userId]);

  const facingMap = useMemo(
    () => buildSequentialUserFacingPlMap(rows, walletBalance, depositBaseline),
    [rows, walletBalance, depositBaseline],
  );

  const getRowPl = useMemo(
    () => (r: UserTradeRow) => {
      if (r.history_archived) {
        return Number(r.final_profit_loss ?? r.user_facing_pl ?? r.user_wallet_pl ?? 0);
      }
      return rowUserFacingPl(r, undefined, undefined, facingMap);
    },
    [facingMap],
  );

  const archivedNetPl = useMemo(
    () =>
      rows
        .filter((r) => r.history_archived)
        .reduce((sum, r) => sum + getRowPl(r), 0),
    [rows, getRowPl],
  );

  return (
    <div className="mx-auto max-w-3xl p-4">
      {assignFunded === false && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <button
            type="button"
            className="font-semibold text-neutral-800 underline"
            onClick={() => navigate("/user/recharge")}
          >
            Add funds
          </button>
        </div>
      )}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Trade history</h1>
          <p className="mt-1 max-w-2xl text-xs text-slate-500">
            Your P/L on every assigned trade (full profit/loss credited to your wallet). Open rows are
            estimates until the trade closes. The performance fee applies at the wallet level on withdrawal.
          </p>
          {archivedCount > 0 && (
            <p className="mt-2 max-w-2xl rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              Showing <span className="font-semibold">{archivedCount} archived</span> pre-correction trade
              {archivedCount === 1 ? "" : "s"} plus current trades. Archived rows are read-only records used
              to explain how your balance changed (net archived P/L:{" "}
              <span className="font-semibold tabular-nums">
                {archivedNetPl >= 0 ? "+" : ""}
                ${archivedNetPl.toFixed(2)}
              </span>
              ). Wallet balance today reflects the corrected ledger.
            </p>
          )}
        </div>

        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl bg-[#FFD700] px-5 py-2.5 font-bold text-black transition hover:bg-[#E6C200] disabled:opacity-50"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <Mt5TradeHistoryList
        trades={rows}
        getRowPl={getRowPl}
        loading={loading}
        currency={currency}
        emptyMessage="No assigned trades yet"
      />
    </div>
  );
};

export default TradeHistory;
