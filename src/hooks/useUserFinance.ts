import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "@/config/api";

export type UserFinanceState = {
  loading: boolean;
  currency: string;
  /** Trading Wallet (at-risk) */
  walletBalance: number;
  tradingWallet: number;
  /** Safe Wallet (no trading loss; withdraw from here) */
  safeWallet: number;
  /** @deprecated alias — Safe Wallet withdrawable when canWithdraw */
  withdrawable: number;
  equity: number;
  livePl: number;
  depositBaseline: number;
  busted: boolean;
  softBust: boolean;
  openPositions: number;
  canWithdraw: boolean;
  /** Pending admin profit buffer (not yet locked). */
  adminPendingShare: number;
  shareableProfit: number;
  userSharePct: number;
  adminPendingShareLive: number;
  userEquityShare: number;
};

const empty: UserFinanceState = {
  loading: true,
  currency: "USD",
  walletBalance: 0,
  tradingWallet: 0,
  safeWallet: 0,
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

/** Trading = at-risk; Safe = recharge/withdraw park (no trading loss). */
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

      const tradingWallet = Math.max(
        0,
        Number(sData?.trading_wallet_usd ?? sData?.wallet_balance ?? wData?.wallet?.balance ?? 0),
      );
      const safeWallet = Math.max(0, Number(sData?.safe_wallet_usd ?? 0));
      const openPositions = Number(sData?.open_positions ?? 0);
      const adminPendingShare = Math.max(
        0,
        Number(sData?.pending_admin_profit_usd ?? sData?.admin_pending_share_usd ?? 0),
      );
      const userWithdrawable = Math.max(
        0,
        Number(sData?.user_withdrawable_usd ?? safeWallet),
      );
      const canWithdraw =
        sData?.can_withdraw === true || safeWallet > 0.01 || userWithdrawable > 0.01;
      const withdrawable = userWithdrawable > 0 ? userWithdrawable : safeWallet;

      setState({
        loading: false,
        currency: String(sData?.currency ?? wData?.wallet?.currency ?? "USD"),
        walletBalance: tradingWallet,
        tradingWallet,
        safeWallet,
        withdrawable,
        equity: Math.max(0, Number(sData?.equity ?? tradingWallet + Number(sData?.live_pl ?? 0))),
        livePl: Number(sData?.live_pl ?? 0),
        depositBaseline: Number(sData?.deposit_baseline ?? 0),
        busted: sData?.busted === true && tradingWallet <= 0.01,
        softBust: sData?.soft_bust === true && openPositions > 0,
        openPositions,
        canWithdraw,
        adminPendingShare,
        shareableProfit: Math.max(0, Number(sData?.shareable_profit_usd ?? 0)),
        userSharePct: Number(sData?.user_share_pct ?? 0),
        adminPendingShareLive: Math.max(
          0,
          Number(sData?.admin_pending_share_live_usd ?? adminPendingShare),
        ),
        userEquityShare: Math.max(
          0,
          Number(
            sData?.user_equity_share_usd ??
              tradingWallet + Number(sData?.live_pl ?? 0) - adminPendingShare,
          ),
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
