import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { API_BASE } from "@/config/api";
import { fetchAllUserTrades } from "@/utils/fetchAllUserTrades";
import { Mt5TradeHistoryList } from "@/components/trades/Mt5TradeHistoryList";
import {
  isOpenTrade,
  rowUserFacingPl,
  buildSequentialUserFacingPlMap,
  type UserTradeRowLike,
} from "@/utils/userTradePl";

type UserTradeRow = UserTradeRowLike & {
  assignment_id?: number;
  open_time?: string | null;
  close_time?: string | null;
  assignment_created_at?: string | null;
};

const AdminUserTradesPage = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [rows, setRows] = useState<UserTradeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalLoaded, setTotalLoaded] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const [depositBaseline, setDepositBaseline] = useState(0);
  const [currency, setCurrency] = useState("USD");

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const [profileRes, tradesData, summaryRes] = await Promise.all([
        fetch(`${API_BASE}/user/profile/${userId}`),
        fetchAllUserTrades(userId, { admin: true }),
        fetch(`${API_BASE}/user/summary/${userId}`),
      ]);
      const profileData = await profileRes.json();
      const summaryData = await summaryRes.json();
      if (summaryData?.success) {
        setWalletBalance(Number(summaryData.wallet_balance ?? 0));
        setDepositBaseline(
          Number(summaryData.deposit_baseline ?? summaryData.total_invested ?? 0),
        );
        setCurrency(summaryData.currency || "USD");
      }
      if (profileData?.success && profileData.profile?.name) {
        setUserName(String(profileData.profile.name));
      }
      setRows(tradesData.trades as UserTradeRow[]);
      setTotalLoaded(tradesData.total);
    } catch (err) {
      console.error("AdminUserTradesPage fetch:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openCount = useMemo(() => rows.filter((r) => isOpenTrade(r)).length, [rows]);
  const closedCount = rows.length - openCount;

  const facingMap = useMemo(
    () => buildSequentialUserFacingPlMap(rows, walletBalance, depositBaseline),
    [rows, walletBalance, depositBaseline],
  );

  const getRowPl = useMemo(
    () => (r: UserTradeRow) => rowUserFacingPl(r, undefined, undefined, facingMap),
    [facingMap],
  );

  if (!userId) {
    return <Navigate to="/admin/users" replace />;
  }

  return (
    <div className="mx-auto max-w-3xl px-0 py-4 sm:px-2 md:px-6 md:py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => navigate("/admin/users")}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Users
          </Button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
              {userName || "User"} — trade history
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              User #{userId} · {openCount} open · {closedCount} closed · {rows.length} assigned
              {totalLoaded > rows.length ? ` (${totalLoaded} total loaded)` : ""}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit gap-2"
          onClick={refresh}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Mt5TradeHistoryList
        trades={rows}
        getRowPl={getRowPl}
        loading={loading}
        currency={currency}
        showProfitShare
        emptyMessage="No assigned trades — run day-0 rebuild if this user had wallet balance but zero rows."
      />
    </div>
  );
};

export default AdminUserTradesPage;
