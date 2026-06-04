import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "@/config/api";

export type UserFinanceState = {
  loading: boolean;
  currency: string;
  walletBalance: number;
  withdrawable: number;
  equity: number;
  livePl: number;
  depositBaseline: number;
  busted: boolean;
  softBust: boolean;
  openPositions: number;
  canWithdraw: boolean;
};

const empty: UserFinanceState = {
  loading: true,
  currency: "USD",
  walletBalance: 0,
  withdrawable: 0,
  equity: 0,
  livePl: 0,
  depositBaseline: 0,
  busted: false,
  softBust: false,
  openPositions: 0,
  canWithdraw: false,
};

/** Withdrawable = wallet only when no open trades; equity = wallet + live P/L (display). */
export function useUserFinance(userId: number | undefined) {
  const [state, setState] = useState<UserFinanceState>(empty);

  const refresh = useCallback(async () => {
    if (!userId) {
      setState({ ...empty, loading: false });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    try {
      const [wRes, sRes] = await Promise.all([
        fetch(`${API_BASE}/user/wallet/${userId}`),
        fetch(`${API_BASE}/user/summary/${userId}`),
      ]);
      const wData = await wRes.json();
      const sData = await sRes.json();

      const walletBalance = Math.max(
        0,
        Number(sData?.wallet_balance ?? wData?.wallet?.balance ?? 0),
      );
      const openPositions = Number(sData?.open_positions ?? 0);
      const canWithdraw = sData?.can_withdraw === true && openPositions === 0;
      const withdrawable = canWithdraw
        ? Math.max(0, walletBalance)
        : 0;

      setState({
        loading: false,
        currency: String(sData?.currency ?? wData?.wallet?.currency ?? "USD"),
        walletBalance,
        withdrawable,
        equity: Math.max(0, Number(sData?.equity ?? walletBalance + Number(sData?.live_pl ?? 0))),
        livePl: Number(sData?.live_pl ?? 0),
        depositBaseline: Number(sData?.deposit_baseline ?? 0),
        busted: sData?.busted === true && walletBalance <= 0.01,
        softBust: sData?.soft_bust === true && openPositions > 0,
        openPositions,
        canWithdraw,
      });
    } catch {
      setState({ ...empty, loading: false });
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...state, refresh };
}
