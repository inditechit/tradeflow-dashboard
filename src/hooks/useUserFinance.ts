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
  /** Admin performance-fee share still pending on SETTLED profit above base. */
  adminPendingShare: number;
  /** Profit above base that is subject to sharing (settled). */
  shareableProfit: number;
  /** User's profit-share percentage (e.g. 40, 50). */
  userSharePct: number;
  /** Live admin fee preview incl. open-trade P/L (display only, not withdrawable yet). */
  adminPendingShareLive: number;
  /** Live user share of equity incl. open-trade P/L (display only). */
  userEquityShare: number;
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
  adminPendingShare: 0,
  shareableProfit: 0,
  userSharePct: 0,
  adminPendingShareLive: 0,
  userEquityShare: 0,
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
      const adminPendingShare = Math.max(0, Number(sData?.admin_pending_share_usd ?? 0));
      // Per-trade model: settled wallet is fully withdrawable (admin share taken at trade close).
      const userWithdrawable = Math.max(
        0,
        Number(sData?.user_withdrawable_usd ?? walletBalance),
      );
      const withdrawable = canWithdraw ? userWithdrawable : 0;

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
        adminPendingShare,
        shareableProfit: Math.max(0, Number(sData?.shareable_profit_usd ?? 0)),
        userSharePct: Number(sData?.user_share_pct ?? 0),
        adminPendingShareLive: Math.max(0, Number(sData?.admin_pending_share_live_usd ?? adminPendingShare)),
        userEquityShare: Math.max(
          0,
          Number(sData?.user_equity_share_usd ?? walletBalance + Number(sData?.live_pl ?? 0) - adminPendingShare),
        ),
      });
    } catch {
      setState({ ...empty, loading: false });
    }
  }, [userId]);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 10_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  return { ...state, refresh };
}
