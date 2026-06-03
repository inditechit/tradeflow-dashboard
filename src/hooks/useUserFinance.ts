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
};

/** Withdrawable = wallet + live user P/L share; wallet = deposits + settled closed trades. */
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

      const walletFromDb = Math.max(
        0,
        Number(wData?.wallet?.balance ?? wData?.withdrawable_equity ?? 0),
      );
      const summaryWallet = Math.max(0, Number(sData?.wallet_balance ?? walletFromDb));
      const walletBalance = Math.max(walletFromDb, summaryWallet);
      const withdrawable = Math.max(
        0,
        Number(sData?.withdrawable_equity ?? 0),
        Number(wData?.withdrawable_equity ?? 0),
        walletBalance + Number(sData?.live_pl ?? 0),
      );

      setState({
        loading: false,
        currency: String(sData?.currency ?? wData?.wallet?.currency ?? "USD"),
        walletBalance,
        withdrawable,
        equity: Math.max(0, Number(sData?.equity ?? walletBalance)),
        livePl: Number(sData?.live_pl ?? 0),
        depositBaseline: Number(sData?.deposit_baseline ?? 0),
        busted: sData?.busted === true && walletBalance <= 0.01,
        softBust: sData?.soft_bust === true && walletBalance > 0.01,
        openPositions: Number(sData?.open_positions ?? 0),
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
