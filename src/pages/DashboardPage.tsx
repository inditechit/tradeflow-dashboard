import React, { useEffect, useState, useRef, memo, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { 
  User, LogOut, 
  Loader2, Plus, TrendingUp,
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
  recomputeOpenUserLivePl,
  buildSequentialUserFacingPlMap,
  rowUserFacingPl,
  parseMt5Price,
  type UserTradeRowLike,
} from '@/utils/userTradePl';
import { Mt5TradeHistoryList, type Mt5HistoryRow } from '@/components/trades/Mt5TradeHistoryList';

const socket = io(SOCKET_URL, { transports: ['websocket'] });

/** Free embed supports OANDA gold spot; FXCM:XAUUSD is not available in widgets. */
const XAUUSD_SYMBOL = "OANDA:XAUUSD";

const TradingViewChart = memo(() => {
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
      height: 400,
      symbol: XAUUSD_SYMBOL,
      interval: "15",
      timezone: "Etc/UTC",
      theme: "light",
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
  }, []);

  return (
    <div
      className="tradingview-widget-container"
      ref={container}
      style={{ height: "520px", width: "100%", overflow: "hidden" }}
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
  const { currentUser, updateUser, logout } = useApp();

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
    }),
    [acctTotals, walletBalance, equity],
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
          const entryPx = parseMt5Price((row as UserTradeRowLike).price);
          if (entryPx != null && entryPriceByTicketRef.current[ticket] == null) {
            entryPriceByTicketRef.current[ticket] = entryPx;
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
              effectiveSummary.can_withdraw ? effectiveSummary.wallet_balance ?? wBal : 0,
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
            Number(effectiveSummary.can_withdraw ? effectiveSummary.wallet_balance ?? summaryWallet : 0),
          );
        }
      } else {
        setIsBusted(false);
        setPendingClosedPl(0);
        setLivePl(openPlSum);
        setWithdrawableFromApi(walletBalance + openPlSum);
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
      'Stop trading? Your current share of each open position will be frozen from the live MT5 feed. Your wallet will update only when those trades close on the master account.',
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
        setTradingActionError(data.error || 'Could not stop trading');
        return;
      }
      liveRawByTicketRef.current = {};
      await loadFinance();
    } catch {
      setTradingActionError('Server error while stopping trading');
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

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        try {
          const res = await fetch(`${API_BASE}/save-location`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat, lng, userId: currentUser.userId }),
          });
          const data = await res.json();
          if (data.success) sessionStorage.setItem("location_sent", "true");
        } catch (err) {
          console.error("Error saving location", err);
        }
      },
      (error) => console.log("Location permission denied:", error),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [currentUser]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        {currentUser?.role !== 'admin' && (
          <DashboardNotificationsBanner userId={currentUser?.userId} />
        )}
        
        {/* Header Profile Card */}
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-xl shadow-neutral-900/8 border border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-yellow-50 flex items-center justify-center border border-yellow-200 text-neutral-900">
              <User size={32} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">  
                Welcome back, {currentUser?.telegram || 'Trader'}
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => navigate('/user/recharge')}
              className="flex-1 md:flex-none px-5 py-2.5 bg-[#FFD700] text-black rounded-xl border border-yellow-300 hover:bg-[#E6C200] transition-colors flex items-center justify-center gap-2 font-bold text-sm"
            >
              <Plus size={18} /> Add Fund
            </button>
            <button 
              onClick={handleLogout} 
              className="flex-1 md:flex-none px-5 py-2.5 bg-red-50 text-red-600 rounded-xl border border-red-100 hover:bg-red-100 transition-colors flex items-center justify-center gap-2 font-medium text-sm"
            >
              <LogOut size={18} /> Logout
            </button>
          </div>
        </div>

        {/* Live chart at the top of the user panel */}
        {currentUser?.role !== 'admin' && (
          <section>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="text-neutral-900" size={24} />
                <div>
                  <h2 className="text-xl font-bold text-slate-800">XAUUSD</h2>
                  <p className="text-xs text-slate-500">
                    Gold spot (XAU/USD) · OANDA feed
                  </p>
                </div>
              </div>
              <span className="rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-xs font-semibold text-yellow-800">
                XAUUSD
              </span>
            </div>
            <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white p-4 shadow-lg">
              <TradingViewChart />
            </div>
          </section>
        )}

        {currentUser?.role !== 'admin' && isBusted && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            <p className="font-medium">Account balance exhausted</p>
            <p className="mt-1 text-red-800">
              Your equity reached zero. Wallet and equity are now $0. Add funds and restart trading to continue.
            </p>
          </div>
        )}

        {currentUser?.role !== 'admin' && !isBusted && !subscriptionActive && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-medium">Copy trading stopped — package expired</p>
            <p className="mt-1 text-amber-900">
              Your trading package has ended. You will not receive new trades until you{' '}
              <button
                type="button"
                className="font-semibold text-amber-950 underline decoration-amber-800"
                onClick={() => navigate('/packages')}
              >
                buy a new package
              </button>
              . Open positions still settle to your wallet when they close on the master account.
            </p>
          </div>
        )}

        {currentUser?.role !== 'admin' && assignFunded === false && walletBalance <= 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p>
              Wallet is empty — you will not receive new trades until you{' '}
              <button
                type="button"
                className="font-semibold text-neutral-800 underline decoration-neutral-900"
                onClick={() => navigate('/user/recharge')}
              >
                add funds
              </button>
              {tradingActive ? ' and restart trading.' : '.'}
            </p>
          </div>
        )}

        {tradingActionError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {tradingActionError}
          </div>
        )}

        {currentUser?.role !== 'admin' && !isBusted && (
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm shadow-sm md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-semibold text-slate-900">
                {tradingActive ? 'Copy trading is running' : 'Copy trading is paused'}
              </p>
              <p className="mt-1 text-slate-500">
                {tradingActive
                  ? 'Stop trading freezes your current open-position P/L from the live MT5 feed and blocks new trades.'
                  : tradingStopReason === 'manual_stop'
                    ? 'Your open-position P/L is frozen. Start trading again to receive new copy trades.'
                    : 'Start trading after your wallet and package are active.'}
              </p>
            </div>
            {tradingActive ? (
              <button
                type="button"
                onClick={handleStopTrading}
                disabled={tradingActionLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 font-bold text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {tradingActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause size={16} />}
                Stop Trade
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRestartTrading}
                disabled={tradingActionLoading || !subscriptionActive || walletBalance <= 0.01}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FFD700] px-4 py-2.5 font-bold text-black transition hover:bg-[#E6C200] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {tradingActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play size={16} />}
                Start Trade
              </button>
            )}
          </div>
        )}

        {currentUser?.role !== 'admin' && supportUnreadTickets > 0 && (
          <button
            type="button"
            onClick={() => navigate('/user/support')}
            className="flex w-full items-center justify-between gap-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-left text-sm text-sky-950 transition-colors hover:bg-sky-100"
          >
            <div className="flex items-center gap-3">
              <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-sky-100">
                <LifeBuoy className="h-5 w-5 text-sky-700" />
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-600 px-1 text-[10px] font-bold text-white">
                  {supportUnreadTickets}
                </span>
              </span>
              <div>
                <p className="font-semibold">New support {supportUnreadMessages === 1 ? 'reply' : 'replies'}</p>
                <p className="mt-0.5 text-sky-800">
                  {supportUnreadTickets === 1
                    ? 'You have 1 ticket with an unread reply'
                    : `You have ${supportUnreadTickets} tickets with unread replies`}
                  {supportUnreadMessages > supportUnreadTickets
                    ? ` (${supportUnreadMessages} messages)`
                    : ''}
                  .
                </p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 text-sky-700" />
          </button>
        )}

        {/* Active trades (MT5-style) + account summary */}
        {currentUser?.role !== 'admin' && (
          <section>
            <h2 className="mb-4 text-xl font-bold text-slate-800">Active trades</h2>
            <Mt5TradeHistoryList
              trades={activeTradeRows as Mt5HistoryRow[]}
              getRowPl={getRowPl}
              loading={loadingFinance && historyRows.length === 0}
              currency={currency}
              entryByTicket={entryPriceByTicketRef.current}
              emptyMessage="No active trades"
              accountSummary={accountSummary}
            />
          </section>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;