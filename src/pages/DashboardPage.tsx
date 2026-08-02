import React, { useEffect, useState, useRef, memo, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';
import { 
  Loader2, TrendingUp, TrendingDown,
  ArrowRight, Pause, Play,
  LifeBuoy,
} from 'lucide-react';
import { API_BASE, SOCKET_URL } from '@/config/api';
import { fetchAllUserTrades } from '@/utils/fetchAllUserTrades';
import { DashboardNotificationsBanner } from '@/components/notifications/DashboardNotificationsBanner';
import { io } from 'socket.io-client';
import {
  resolveEffectiveSlice,
  isTradeClosed,
  isUserStoppedTrade,
  recomputeOpenUserLivePl,
  buildSequentialUserFacingPlMap,
  rowUserFacingPl,
  parseMt5Price,
  type UserTradeRowLike,
} from '@/utils/userTradePl';
import { Mt5TradeHistoryList, type Mt5HistoryRow } from '@/components/trades/Mt5TradeHistoryList';
import { isAdminImpersonating } from '@/utils/adminImpersonation';
import { getGeolocationIfAllowed } from '@/utils/devicePermissions';
import { WalletTransferPanel } from '@/components/wallet/WalletTransferPanel';

const socket = io(SOCKET_URL, { transports: ['websocket'] });

/** Free embed supports OANDA gold spot; FXCM:XAUUSD is not available in widgets. */
const XAUUSD_SYMBOL = "OANDA:XAUUSD";

const TradingViewChart = memo(({ theme = "light" }: { theme?: "light" | "dark" }) => {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;
    container.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      width: "100%",
      height: 240,
      symbol: XAUUSD_SYMBOL,
      interval: "15",
      timezone: "Etc/UTC",
      theme,
      style: "1",
      locale: "en",
      enable_publishing: false,
      allow_symbol_change: true,
      calendar: false,
      support_host: "https://www.tradingview.com",
      disabled_features: ["header_compare"],
    });

    container.current.appendChild(script);

    return () => {
      if (container.current) container.current.innerHTML = "";
    };
  }, [theme]);

  return (
    <div
      className="tradingview-widget-container"
      ref={container}
      style={{ height: "240px", width: "100%", overflow: "hidden" }}
    >
      <div
        className="tradingview-widget-container__widget"
        style={{ height: "100%", width: "100%" }}
      />
    </div>
  );
});

const DashboardPage = () => {
  const navigate = useNavigate();
  const { currentUser, updateUser } = useApp();
  const { theme } = useTheme();

  const [wallet, setWallet] = useState<{ balance: string | number; currency: string } | null>(null);
  const [livePl, setLivePl] = useState(0);
  const [pendingClosedPl, setPendingClosedPl] = useState(0);
  const [openPositionCount, setOpenPositionCount] = useState(0);
  const [loadingFinance, setLoadingFinance] = useState(true);
  const [assignFunded, setAssignFunded] = useState(true);
  const [tradingActive, setTradingActive] = useState(true);
  const [subscriptionActive, setSubscriptionActive] = useState(true);
  const [tradingStopReason, setTradingStopReason] = useState<string | null>(null);
  const [tradingActionLoading, setTradingActionLoading] = useState(false);
  const [tradingActionError, setTradingActionError] = useState('');
  const [isBusted, setIsBusted] = useState(false);
  const [softBust, setSoftBust] = useState(false);
  const [withdrawableFromApi, setWithdrawableFromApi] = useState(0);
  const [safeWalletUsd, setSafeWalletUsd] = useState(0);
  const [adminFeeLive, setAdminFeeLive] = useState(0);
  const [userShareLive, setUserShareLive] = useState(0);
  const [userSharePct, setUserSharePct] = useState(50);
  const [supportUnreadTickets, setSupportUnreadTickets] = useState(0);
  const [supportUnreadMessages, setSupportUnreadMessages] = useState(0);
  const liveTicketRef = useRef<Record<string, { v_i: number; V: number; fee: number; pct: number }>>({});
  const depositBaselineRef = useRef(0);
  const allTradeRowsRef = useRef<UserTradeRowLike[]>([]);
  const liveRawByTicketRef = useRef<Record<string, number>>({});
  const entryPriceByTicketRef = useRef<Record<string, number>>({});

  const [historyRows, setHistoryRows] = useState<UserTradeRowLike[]>([]);
  const [liveRawByTicket, setLiveRawByTicket] = useState<Record<string, number>>({});
  const [depositBaseline, setDepositBaseline] = useState(0);
  const [acctTotals, setAcctTotals] = useState<{
    profit: number;
    deposit: number;
    withdrawal: number;
  }>({ profit: 0, deposit: 0, withdrawal: 0 });

  const walletBalance = Math.max(0, Number(wallet?.balance ?? 0));
  const currency = wallet?.currency || "USD";
  /** Open P/L only when wallet &gt; 0 (no new assigns at $0). */
  const displayLivePl =
    walletBalance > 0.01 && openPositionCount > 0 && !isBusted ? livePl : 0;
  const equity =
    isBusted || walletBalance <= 0.01 ? 0 : Math.max(0, walletBalance + displayLivePl);

  const facingMap = useMemo(
    () =>
      buildSequentialUserFacingPlMap(
        historyRows,
        walletBalance,
        depositBaseline,
        liveRawByTicket,
      ),
    [historyRows, walletBalance, depositBaseline, liveRawByTicket],
  );

  const getRowPl = useCallback(
    (r: UserTradeRowLike) =>
      rowUserFacingPl(r, liveRawByTicket[String(r.ticket_id ?? '')], undefined, facingMap),
    [liveRawByTicket, facingMap],
  );

  const activeTradeRows = useMemo(
    () => historyRows.filter((r) => !isTradeClosed(r)),
    [historyRows],
  );

  const accountSummary = useMemo(
    () => ({
      profit: acctTotals.profit,
      credit: 0,
      deposit: acctTotals.deposit,
      withdrawal: acctTotals.withdrawal,
      balance: walletBalance,
      equity,
      adminFee: adminFeeLive,
      userShare: userShareLive > 0 ? userShareLive : Math.max(0, equity - adminFeeLive),
      userSharePct,
    }),
    [acctTotals, walletBalance, equity, adminFeeLive, userShareLive, userSharePct],
  );

  const recomputeOpenPlSequential = useCallback((walletStart: number) => {
    return recomputeOpenUserLivePl(
      allTradeRowsRef.current,
      walletStart,
      depositBaselineRef.current,
      liveRawByTicketRef.current,
    );
  }, []);

  const loadFinance = useCallback(async () => {
    if (!currentUser?.userId || currentUser.role === 'admin') return;

    setLoadingFinance(true);
    try {
      const uid = currentUser.userId;

      const [wRes, pRes, assignRes, summaryRes] = await Promise.all([
        fetch(`${API_BASE}/user/wallet/${uid}`),
        fetch(`${API_BASE}/user/profit/${uid}`),
        fetch(`${API_BASE}/user/trade-assign/${uid}`),
        fetch(`${API_BASE}/user/summary/${uid}`),
      ]);

      const wData = await wRes.json();
      const pData = await pRes.json();
      const assignData = await assignRes.json();
      const summaryData = await summaryRes.json();

      if (wData.success && wData.wallet) {
        setWallet(wData.wallet);
      }

      if (pData.success) {
        const joinFromApi = pData.created_at || pData.joined_at || pData.signup_date;
        if (joinFromApi && !currentUser.createdAt) {
          updateUser({ createdAt: String(joinFromApi) });
        }
      }

      const walletOk = Number(wData?.wallet?.balance ?? assignData?.balance ?? 0) > 0;
      const active =
        summaryData?.trading_active !== false && assignData?.trading_active !== false;
      setTradingActive(active);
      setSubscriptionActive(summaryData?.subscription_active !== false);
      setTradingStopReason(summaryData?.trading_stop_reason ?? null);
      const funded =
        summaryData?.funded !== false &&
        assignData?.funded !== false &&
        walletOk &&
        active &&
        summaryData?.subscription_active !== false;
      setAssignFunded(funded);

      const tradesData = await fetchAllUserTrades(uid);

      const summaryAfterRes = await fetch(`${API_BASE}/user/summary/${uid}`);
      const summaryAfter = await summaryAfterRes.json();

      depositBaselineRef.current = Number(
        summaryAfter?.deposit_baseline ??
          summaryData?.deposit_baseline ??
          summaryData?.total_invested ??
          0,
      );
      const nextSlice: Record<string, { v_i: number; V: number; fee: number; pct: number }> = {};
      let openCount = 0;
      const allRows: UserTradeRowLike[] = [];
      if (tradesData?.success && Array.isArray(tradesData.trades)) {
        for (const t of tradesData.trades) {
          const ticket = String(t.ticket_id ?? '');
          const liveRaw = ticket ? liveRawByTicketRef.current[ticket] : undefined;
          const tradeWithSnapshot = t as UserTradeRowLike & {
            stop_snapshot_gross_pl_usd?: unknown;
            stop_snapshot_at?: unknown;
          };
          const hasStopSnapshot =
            tradeWithSnapshot.stop_snapshot_gross_pl_usd != null ||
            tradeWithSnapshot.stop_snapshot_at != null;
          const row =
            !hasStopSnapshot && liveRaw != null && Number.isFinite(liveRaw)
              ? { ...t, mt5_total_profit: liveRaw }
              : t;
          allRows.push(row as UserTradeRowLike);
          if (isTradeClosed(row)) continue;
          openCount += 1;
          if (!ticket) continue;
          // Don't cache stop/exit price as the entry price.
          if (!(row as UserTradeRowLike & { stop_snapshot_at?: unknown }).stop_snapshot_at) {
            const entryPx = parseMt5Price((row as UserTradeRowLike).price);
            if (entryPx != null && entryPriceByTicketRef.current[ticket] == null) {
              entryPriceByTicketRef.current[ticket] = entryPx;
            }
          }
          const slice = resolveEffectiveSlice(row as UserTradeRowLike);
          nextSlice[ticket] = {
            v_i: slice.v_i,
            V: slice.V,
            fee: slice.fee,
            pct: slice.pct,
          };
        }
      }
      allTradeRowsRef.current = allRows;
      liveTicketRef.current = nextSlice;
      setHistoryRows(allRows);
      setLiveRawByTicket({ ...liveRawByTicketRef.current });
      setDepositBaseline(depositBaselineRef.current);
      setOpenPositionCount(openCount);
      const wBal = Number(
        summaryAfter?.wallet_balance ??
          summaryData?.wallet_balance ??
          wData?.wallet?.balance ??
          assignData?.balance ??
          0,
      );
      const openPlSum = openCount > 0 ? recomputeOpenPlSequential(wBal) : 0;

      const effectiveSummary =
        summaryAfter?.success === true ? summaryAfter : summaryData;

      if (effectiveSummary?.success) {
        setSafeWalletUsd(Number(effectiveSummary.safe_wallet_usd ?? 0));
        setAcctTotals({
          profit: Number(effectiveSummary.realised_net ?? 0),
          deposit: Number(effectiveSummary.total_deposited_usd ?? 0),
          withdrawal: -Math.abs(Number(effectiveSummary.total_withdrawn_usd ?? 0)),
        });
      }
      if (effectiveSummary?.success) {
        const busted = effectiveSummary.busted === true;
        const isSoft = effectiveSummary.soft_bust === true;
        setSubscriptionActive(effectiveSummary.subscription_active !== false);
        setTradingStopReason(effectiveSummary.trading_stop_reason ?? null);
        setIsBusted(busted);
        setSoftBust(isSoft);
        if (busted && !isSoft && Number(effectiveSummary.wallet_balance ?? 0) <= 0.01) {
          setWallet({ balance: 0, currency: effectiveSummary.currency || "USD" });
          setPendingClosedPl(0);
          setLivePl(0);
          setWithdrawableFromApi(0);
          setOpenPositionCount(0);
          setTradingActive(false);
          setAssignFunded(false);
        } else if (busted && isSoft) {
          if (effectiveSummary.wallet_balance != null) {
            setWallet({
              balance: effectiveSummary.wallet_balance,
              currency: effectiveSummary.currency || "USD",
            });
          }
          setPendingClosedPl(Number(effectiveSummary.pending_closed_pl ?? 0));
          setLivePl(Number(effectiveSummary.live_pl ?? openPlSum));
          setWithdrawableFromApi(
            Number(
              effectiveSummary.can_withdraw
                ? effectiveSummary.safe_wallet_usd ??
                    effectiveSummary.user_withdrawable_usd ??
                    0
                : 0,
            ),
          );
          setTradingActive(false);
        } else {
          const summaryWallet = Number(effectiveSummary.wallet_balance ?? wBal);
          if (effectiveSummary.wallet_balance != null) {
            setWallet({
              balance: summaryWallet,
              currency: effectiveSummary.currency || wData?.wallet?.currency || "USD",
            });
          }
          const apiLive = Number(effectiveSummary.live_pl ?? 0);
          const apiPending = Number(effectiveSummary.pending_closed_pl ?? 0);
          setPendingClosedPl(apiPending);
          setLivePl(
            openCount > 0
              ? Math.abs(openPlSum) > 0.001 || Math.abs(apiLive) < 0.001
                ? openPlSum
                : apiLive
              : apiLive,
          );
          setWithdrawableFromApi(
            Number(
              effectiveSummary.can_withdraw
                ? effectiveSummary.safe_wallet_usd ??
                    effectiveSummary.user_withdrawable_usd ??
                    0
                : 0,
            ),
          );
        }
        setAdminFeeLive(Math.max(0, Number(effectiveSummary.admin_pending_share_live_usd ?? 0)));
        setUserShareLive(Math.max(0, Number(effectiveSummary.user_equity_share_usd ?? 0)));
        {
          const pct = Number(
            effectiveSummary.user_share_pct ?? effectiveSummary.admin_profit_percentage ?? NaN,
          );
          setUserSharePct(Number.isFinite(pct) && pct > 0 ? pct : 50);
        }
      } else {
        setIsBusted(false);
        setPendingClosedPl(0);
        setLivePl(openPlSum);
        setWithdrawableFromApi(0);
        setAdminFeeLive(0);
        setUserShareLive(0);
        setUserSharePct(50);
      }
    } catch (err) {
      console.error('Finance load error:', err);
    } finally {
      setLoadingFinance(false);
    }
  }, [currentUser?.userId, currentUser?.role, currentUser?.createdAt, updateUser, recomputeOpenPlSequential]);

  const handleStopTrading = async () => {
    if (!currentUser?.userId || tradingActionLoading) return;
    const ok = window.confirm(
      'Settle Trade? Open positions will be closed at the current live price. If Trading is above your baseline (last Safe→Trading amount), admin takes 50% of that profit once. Remaining funds move to Safe Wallet. Withdrawals do not take admin share.',
    );
    if (!ok) return;
    setTradingActionLoading(true);
    setTradingActionError('');
    try {
      const res = await fetch(`${API_BASE}/user/trading/stop/${currentUser.userId}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!data.success) {
        setTradingActionError(data.error || 'Could not settle trading');
        return;
      }
      liveRawByTicketRef.current = {};
      await loadFinance();
    } catch {
      setTradingActionError('Server error while settling trading');
    } finally {
      setTradingActionLoading(false);
    }
  };

  const handleRestartTrading = async () => {
    if (!currentUser?.userId || tradingActionLoading) return;
    if (walletBalance <= 0) {
      setTradingActionError('Add funds to your wallet before restarting trading.');
      return;
    }
    setTradingActionLoading(true);
    setTradingActionError('');
    try {
      const res = await fetch(`${API_BASE}/user/trading/restart/${currentUser.userId}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!data.success) {
        setTradingActionError(data.error || 'Could not restart trading');
        return;
      }
      await loadFinance();
    } catch {
      setTradingActionError('Server error while restarting trading');
    } finally {
      setTradingActionLoading(false);
    }
  };

  const applyLiveMt5Profit = useCallback((ticket: string, rawProfit: number, livePrice?: number | null) => {
    if (isBusted) return;
    if (tradingStopReason === 'manual_stop') return;
    const ctx = liveTicketRef.current[ticket];
    if (!ctx || !(ctx.V > 0 && ctx.v_i > 0)) return;
    const existing = allTradeRowsRef.current.find((row) => String(row.ticket_id ?? '') === ticket);
    if (existing && (isTradeClosed(existing) || isUserStoppedTrade(existing))) return;
    liveRawByTicketRef.current = { ...liveRawByTicketRef.current, [ticket]: rawProfit };
    allTradeRowsRef.current = allTradeRowsRef.current.map((row) =>
      String(row.ticket_id ?? '') === ticket
        ? {
            ...row,
            mt5_total_profit: rawProfit,
            mt5_volume: ctx.V,
            allocated_volume: ctx.v_i,
            ...(livePrice != null ? { price: livePrice } : {}),
          }
        : row,
    );
    setHistoryRows(allTradeRowsRef.current);
    setLiveRawByTicket({ ...liveRawByTicketRef.current });
    const sum = recomputeOpenPlSequential(walletBalance);
    setLivePl(sum);
    if (walletBalance + sum <= 0) {
      void loadFinance();
    }
  }, [isBusted, walletBalance, loadFinance, recomputeOpenPlSequential, tradingStopReason]);

  useEffect(() => {
    if (!currentUser?.userId || currentUser.role === 'admin') return;

    let cancelled = false;
    const loadSupportUnread = async () => {
      try {
        const res = await fetch(`${API_BASE}/user/support/${currentUser.userId}/unread-count`);
        const data = await res.json();
        if (!cancelled && data?.success) {
          setSupportUnreadTickets(Number(data.unread_tickets ?? 0));
          setSupportUnreadMessages(Number(data.unread_count ?? 0));
        }
      } catch {
        // best-effort
      }
    };

    loadSupportUnread();
    const interval = setInterval(loadSupportUnread, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [currentUser?.userId, currentUser?.role]);

  useEffect(() => {
    if (!currentUser?.userId) {
      navigate('/signup');
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    if (!currentUser?.userId || currentUser.role === 'admin') {
      setLoadingFinance(false);
      return;
    }
    loadFinance();
    const interval = setInterval(loadFinance, 10000);

    const onLive = (payload: { ticket?: unknown; profit?: unknown; price?: unknown }) => {
      const ticket = String(payload.ticket ?? '');
      const raw = Number(payload.profit);
      if (!ticket || !Number.isFinite(raw)) return;
      applyLiveMt5Profit(ticket, raw, parseMt5Price(payload.price));
    };
    socket.on('mt5live', onLive);
    socket.on('mt5data', onLive);

    return () => {
      clearInterval(interval);
      socket.off('mt5live', onLive);
      socket.off('mt5data', onLive);
    };
  }, [currentUser?.userId, currentUser?.role, loadFinance, applyLiveMt5Profit]);

  useEffect(() => {
    if (!currentUser?.userId) return;
    if (!navigator.geolocation) return;
    // Admin magic-login must never overwrite the user's real location.
    if (isAdminImpersonating()) return;
    // Already saved this session — do not re-trigger the browser prompt.
    if (sessionStorage.getItem("location_sent") === "true") return;

    let cancelled = false;
    void (async () => {
      // Only read when permission is already granted; never re-prompt on dashboard load.
      const result = await getGeolocationIfAllowed({
        allowPrompt: false,
        enableHighAccuracy: false,
        timeout: 10_000,
        maximumAge: 300_000,
      });
      if (cancelled || !result.ok) return;

      try {
        const res = await fetch(`${API_BASE}/save-location`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: result.lat,
            lng: result.lng,
            userId: currentUser.userId,
            skipLocationUpdate: isAdminImpersonating(),
            impersonating: isAdminImpersonating(),
          }),
        });
        const data = await res.json();
        if (data.success) sessionStorage.setItem("location_sent", "true");
      } catch (err) {
        console.error("Error saving location", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.userId]);

  return (
    <div className="bg-slate-50 p-0 font-sans sm:min-h-screen sm:p-3 md:p-5">
      <div className="mx-auto max-w-6xl space-y-2.5 sm:space-y-3 md:space-y-4">
        {currentUser?.role !== 'admin' && (
          <DashboardNotificationsBanner userId={currentUser?.userId} />
        )}

        {/* Live P/L — highlighted hero metric */}
        <div
          className={`rounded-xl border-2 p-3 shadow-lg sm:rounded-2xl sm:p-5 ${
            displayLivePl >= 0
              ? 'border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-yellow-50 shadow-emerald-200/50'
              : 'border-red-300 bg-gradient-to-br from-red-50 via-white to-amber-50 shadow-red-200/50'
          }`}
        >
          <div className="flex items-center gap-3 sm:gap-4">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-sm sm:h-14 sm:w-14 ${
                displayLivePl >= 0
                  ? 'bg-emerald-500 text-white shadow-emerald-300/60'
                  : 'bg-red-500 text-white shadow-red-300/60'
              }`}
            >
              {displayLivePl >= 0 ? (
                <>
                  <TrendingUp size={20} className="sm:hidden" />
                  <TrendingUp size={26} className="hidden sm:block" />
                </>
              ) : (
                <>
                  <TrendingDown size={20} className="sm:hidden" />
                  <TrendingDown size={26} className="hidden sm:block" />
                </>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 sm:text-xs">
                Live P/L (open)
              </p>
              <h1
                className={`text-2xl font-black tabular-nums tracking-tight sm:text-4xl ${
                  displayLivePl >= 0 ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {displayLivePl >= 0 ? '+' : '-'}
                {currency === 'USD' ? '$' : ''}
                {Math.abs(displayLivePl).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                {currency !== 'USD' ? ` ${currency}` : ''}
              </h1>
            </div>
          </div>
        </div>

        {currentUser?.role !== 'admin' && !isBusted && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm shadow-sm sm:px-3 sm:py-2.5">
            <p className="min-w-0 text-[11px] font-medium text-slate-700 sm:text-sm">
              {tradingActive ? 'Copy trading running' : 'Trading settled / paused'}
            </p>
            {tradingActive ? (
              <button
                type="button"
                onClick={handleStopTrading}
                disabled={tradingActionLoading}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-bold text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 sm:px-3 sm:text-sm"
              >
                {tradingActionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pause size={14} />}
                Settle Trade
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRestartTrading}
                disabled={tradingActionLoading || !subscriptionActive || walletBalance <= 0.01}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#FFD700] px-2.5 py-1.5 text-[11px] font-bold text-black transition hover:bg-[#E6C200] disabled:cursor-not-allowed disabled:opacity-60 sm:px-3 sm:text-sm"
              >
                {tradingActionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play size={14} />}
                Start Trade
              </button>
            )}
          </div>
        )}

        {currentUser?.role !== 'admin' && isBusted && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-2.5 py-2 text-[11px] text-red-900 sm:px-3 sm:text-sm">
            Account exhausted — add funds and restart trading to continue.
          </div>
        )}

        {tradingActionError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-2.5 py-2 text-[11px] text-red-800 sm:px-3 sm:text-sm">
            {tradingActionError}
          </div>
        )}

        {/* Mobile: active trades right under Live P/L + Settle Trade */}
        {currentUser?.role !== 'admin' && (
          <div className="flex min-w-0 flex-col lg:hidden">
            <h2 className="mb-1.5 text-sm font-bold text-slate-800">Active trades</h2>
            <Mt5TradeHistoryList
              trades={activeTradeRows as Mt5HistoryRow[]}
              getRowPl={getRowPl}
              loading={loadingFinance && historyRows.length === 0}
              currency={currency}
              entryByTicket={entryPriceByTicketRef.current}
              emptyMessage="No active trades"
              accountSummary={accountSummary}
            />
          </div>
        )}

        {currentUser?.role !== 'admin' && (
          <WalletTransferPanel
            userId={currentUser?.userId}
            tradingWallet={walletBalance}
            safeWallet={safeWalletUsd}
            currency={currency}
            adminPendingShare={adminFeeLive}
            userSharePct={userSharePct}
            tradingActive={tradingActive}
            onTransferred={() => void loadFinance()}
          />
        )}

        {currentUser?.role !== 'admin' && !isBusted && !subscriptionActive && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-950 sm:px-3 sm:text-sm">
            Package expired —{' '}
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => navigate('/packages')}
            >
              buy a new package
            </button>{' '}
            to receive trades.
          </div>
        )}

        {currentUser?.role !== 'admin' && assignFunded === false && walletBalance <= 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-950 sm:px-3 sm:text-sm">
            Trading wallet empty —{' '}
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => navigate('/user/recharge')}
            >
              add funds
            </button>
            {tradingActive ? ' and restart trading.' : ', then transfer Safe → Trading.'}
          </div>
        )}

        {/* Desktop: trades + chart */}
        {currentUser?.role !== 'admin' && (
          <section className="hidden gap-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4">
            <div className="flex min-w-0 flex-col">
              <h2 className="mb-2 text-base font-bold text-slate-800">Active trades</h2>
              <Mt5TradeHistoryList
                trades={activeTradeRows as Mt5HistoryRow[]}
                getRowPl={getRowPl}
                loading={loadingFinance && historyRows.length === 0}
                currency={currency}
                entryByTicket={entryPriceByTicketRef.current}
                emptyMessage="No active trades"
                accountSummary={accountSummary}
              />
            </div>
            <div className="flex min-w-0 flex-col">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-base font-bold text-slate-800">XAUUSD</h2>
                <span className="rounded-full border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-[10px] font-semibold text-yellow-800">
                  Live chart
                </span>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white p-2 shadow-md">
                <TradingViewChart theme={theme} />
              </div>
            </div>
          </section>
        )}

        {currentUser?.role !== 'admin' && supportUnreadTickets > 0 && (
          <button
            type="button"
            onClick={() => navigate('/user/support')}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-2.5 py-2 text-left text-[11px] text-sky-950 transition-colors hover:bg-sky-100 sm:px-3 sm:py-2.5 sm:text-sm"
          >
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-sky-100">
                <LifeBuoy className="h-4 w-4 text-sky-700" />
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-600 px-1 text-[10px] font-bold text-white">
                  {supportUnreadTickets}
                </span>
              </span>
              <p className="font-semibold">
                {supportUnreadTickets} support{' '}
                {supportUnreadTickets === 1 ? 'reply' : 'replies'} unread
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-sky-700" />
          </button>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;