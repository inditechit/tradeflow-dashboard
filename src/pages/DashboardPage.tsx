import React, { useEffect, useState, useRef, memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { 
  Plane, Globe, Video, User, LogOut, 
  Loader2, CheckCircle2, Clock, Plus, TrendingUp,
  Wallet, CircleDollarSign, ArrowRight, Pause, Play,
  LifeBuoy,
} from 'lucide-react';
import { formatMoneyAmount } from '@/utils/userProfitShare';
import { getPackageById, packageDisplayName } from '@/constants/packages';
import { API_BASE, SOCKET_URL } from '@/config/api';
import { fetchAllUserTrades } from '@/utils/fetchAllUserTrades';
import { plTextClass } from '@/utils/plColors';
import { DashboardNotificationsBanner } from '@/components/notifications/DashboardNotificationsBanner';
import { io } from 'socket.io-client';
import {
  resolveEffectiveSlice,
  isTradeClosed,
  recomputeOpenUserLivePl,
  type UserTradeRowLike,
} from '@/utils/userTradePl';

const socket = io(SOCKET_URL, { transports: ['websocket'] });

type PaymentTxn = {
  id: number | string;
  package_id: string;
  package_name?: string;
  status: string;
  amount: number | string;
  payment_method?: string;
  tx_hash?: string;
};

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

// Helper to assign icons based on the package name saved in the DB
const getPackageIcon = (name: string) => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('india')) return <Plane size={24} />;
  if (lowerName.includes('international')) return <Globe size={24} />;
  return <Video size={24} />;
};

const DashboardPage = () => {
  const navigate = useNavigate();
  const { currentUser, setSelectedPackage, updateUser, logout } = useApp();
  
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [wallet, setWallet] = useState<{ balance: string | number; currency: string } | null>(null);
  const [livePl, setLivePl] = useState(0);
  const [pendingClosedPl, setPendingClosedPl] = useState(0);
  const [openPositionCount, setOpenPositionCount] = useState(0);
  const [loadingFinance, setLoadingFinance] = useState(true);
  const [assignFunded, setAssignFunded] = useState(true);
  const [tradingActive, setTradingActive] = useState(true);
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

  const walletBalance = Math.max(0, Number(wallet?.balance ?? 0));
  const currency = wallet?.currency || "USD";
  /** Open P/L only when wallet &gt; 0 (no new assigns at $0). */
  const displayLivePl =
    walletBalance > 0.01 && openPositionCount > 0 && !isBusted ? livePl : 0;
  const equity =
    isBusted || walletBalance <= 0.01 ? 0 : Math.max(0, walletBalance + displayLivePl);
  const withdrawableDisplay =
    openPositionCount > 0 ? 0 : Math.max(0, isBusted && !softBust ? 0 : walletBalance);
  const displayPendingClosedPl = pendingClosedPl;

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
      const funded =
        summaryData?.funded !== false &&
        assignData?.funded !== false &&
        walletOk &&
        active;
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
          const row =
            liveRaw != null && Number.isFinite(liveRaw)
              ? { ...t, mt5_total_profit: liveRaw }
              : t;
          allRows.push(row as UserTradeRowLike);
          if (isTradeClosed(row)) continue;
          openCount += 1;
          if (!ticket) continue;
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
        const busted = effectiveSummary.busted === true;
        const isSoft = effectiveSummary.soft_bust === true;
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
      'Stop trading? Open positions will be closed at the current P/L and your full equity will move into your wallet. You will not receive new trades until you restart.',
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

  const applyLiveMt5Profit = useCallback((ticket: string, rawProfit: number) => {
    if (isBusted) return;
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
          }
        : row,
    );
    const sum = recomputeOpenPlSequential(walletBalance);
    setLivePl(sum);
    if (walletBalance + sum <= 0) {
      void loadFinance();
    }
  }, [isBusted, walletBalance, loadFinance, recomputeOpenPlSequential]);

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
      return;
    }

    const fetchTransactions = async () => {
      try {
        const response = await fetch(`${API_BASE}/user/payments/${currentUser.userId}`);
        const data = await response.json();

        if (data.success) {
          setTransactions(data.data);
        } else {
          setError('Failed to load your packages.');
        }
      } catch (err) {
        setError('Server connection error.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransactions();
  }, [currentUser, navigate]);

  useEffect(() => {
    if (!currentUser?.userId || currentUser.role === 'admin') {
      setLoadingFinance(false);
      return;
    }
    loadFinance();
    const interval = setInterval(loadFinance, 10000);

    const onLive = (payload: { ticket?: unknown; profit?: unknown }) => {
      const ticket = String(payload.ticket ?? '');
      const raw = Number(payload.profit);
      if (!ticket || !Number.isFinite(raw)) return;
      applyLiveMt5Profit(ticket, raw);
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

  const handleContinueJourney = (txn: PaymentTxn) => {
    const pkg = getPackageById(txn.package_id);
    if (!pkg) {
      navigate('/packages');
      return;
    }
    setSelectedPackage({
      id: pkg.id,
      name: pkg.name,
      price: Number(txn.amount) || pkg.price,
      icon: pkg.icon.name,
      purchasedAt: new Date().toISOString(),
    });
    navigate('/payment', { state: { resumePayment: true } });
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
              onClick={handleLogout} 
              className="flex-1 md:flex-none px-5 py-2.5 bg-red-50 text-red-600 rounded-xl border border-red-100 hover:bg-red-100 transition-colors flex items-center justify-center gap-2 font-medium text-sm"
            >
              <LogOut size={18} /> Logout
            </button>
          </div>
        </div>

        {currentUser?.role !== 'admin' && isBusted && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            <p className="font-medium">Account balance exhausted</p>
            <p className="mt-1 text-red-800">
              Your equity reached zero. Wallet and equity are now $0. Add funds and restart trading to continue.
            </p>
          </div>
        )}

        {currentUser?.role !== 'admin' && !isBusted && !tradingActive && walletBalance > 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
            <p className="font-medium">Trading is paused</p>
            <p className="mt-1 text-slate-600">
              Your equity is in your wallet. Restart trading when you want to join new live trades again.
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

        {currentUser?.role !== 'admin' && (
          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm shadow-neutral-900/8">
              <div className="mb-2 flex items-center gap-2 text-slate-500">
                <Wallet className="h-5 w-5 text-neutral-900" />
                <span className="text-xs font-bold uppercase tracking-wide">Account balance</span>
              </div>
              {loadingFinance && !wallet ? (
                <Loader2 className="h-8 w-8 animate-spin text-yellow-800" />
              ) : (
                <p className="text-2xl font-extrabold tabular-nums text-slate-900">
                  {formatMoneyAmount(walletBalance, currency)}
                </p>
              )}
              <p className="mt-2 text-xs text-slate-500">
                Money left in your account after all closed trades are settled. This is not your
                original deposit.
              </p>
            <button 
                  onClick={() => navigate('/user/recharge')}
                  className="flex items-center gap-1 bg-[#ecd888] mt-4 hover:bg-[#FFD700] text-gray-800 hover:text-black border border-yellow-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                >
                  <Plus size={14} /> Add Fund
                </button>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm shadow-neutral-900/8">
              <div className="mb-2 flex items-center gap-2 text-slate-500">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                <span className="text-xs font-bold uppercase tracking-wide">Open trade P/L</span>
              </div>
              {loadingFinance ? (
                <Loader2 className="h-8 w-8 animate-spin text-yellow-800" />
              ) : (
                <p className={`text-2xl font-extrabold tabular-nums ${plTextClass(displayLivePl)}`}>
                  {displayLivePl > 0 ? '+' : ''}{formatMoneyAmount(displayLivePl, currency)}
                </p>
              )}
              <p className="mt-2 text-xs text-slate-500">
                {walletBalance <= 0.01
                  ? 'Balance is $0 — no open P/L and no new trades until you recharge'
                  : isBusted
                    ? 'Trading stopped — add funds to continue'
                    : openPositionCount > 0
                      ? `${openPositionCount} open · estimate only until close`
                      : 'No open trades'}
              </p>
            </div>

            <div className="rounded-2xl border border-yellow-200 bg-gradient-to-br from-yellow-50/80 to-white p-6 shadow-sm shadow-neutral-900/8">
              <div className="mb-2 flex items-center gap-2 text-slate-500">
                <CircleDollarSign className="h-5 w-5 text-neutral-900" />
                <span className="text-xs font-bold uppercase tracking-wide">Equity</span>
              </div>
              {loadingFinance ? (
                <Loader2 className="h-8 w-8 animate-spin text-yellow-800" />
              ) : (
                <p className={`text-2xl font-extrabold tabular-nums ${equity >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
                  {formatMoneyAmount(equity, currency)}
                </p>
              )}
              <p className="mt-2 text-xs text-slate-500">
                {isBusted || walletBalance <= 0.01 ? (
                  <>Balance + open P/L = $0 — recharge to trade again</>
                ) : !tradingActive && openPositionCount === 0 ? (
                  <>
                    {formatMoneyAmount(walletBalance, currency)} in account — trading paused
                    {withdrawableDisplay > 0
                      ? ` · withdrawable ${formatMoneyAmount(withdrawableDisplay, currency)}`
                      : ''}
                  </>
                ) : (
                  <>
                    {formatMoneyAmount(walletBalance, currency)} + open P/L{' '}
                    {formatMoneyAmount(displayLivePl, currency)} ={' '}
                    {formatMoneyAmount(equity, currency)}
                    {withdrawableDisplay !== equity && openPositionCount === 0 && (
                      <>
                        {' '}
                        · withdrawable {formatMoneyAmount(withdrawableDisplay, currency)}
                      </>
                    )}
                  </>
                )}
              </p>
              {!isBusted && walletBalance > 0.01 && openPositionCount > 0 && (
                <p className="mt-1 text-[11px] text-amber-800">
                  Account balance stays {formatMoneyAmount(walletBalance, currency)} until the open
                  trade closes; then profit or loss is applied to your wallet.
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {tradingActive ? (
                  <button
                    type="button"
                    disabled={tradingActionLoading}
                    onClick={handleStopTrading}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-60"
                  >
                    {tradingActionLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Pause className="h-3.5 w-3.5" />
                    )}
                    Exit trading
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={tradingActionLoading || walletBalance <= 0}
                    onClick={handleRestartTrading}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-yellow-300 bg-[#FFD700] px-3 py-2 text-xs font-bold text-black hover:bg-[#E6C200] disabled:opacity-60"
                  >
                    {tradingActionLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    Restart trading
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

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

        {/* Packages Section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-800">Your Active Packages</h2>
            <button 
              onClick={() => navigate('/packages')}
              className="text-neutral-900 text-sm font-bold hover:text-neutral-800 flex items-center gap-1"
            >
              <Plus size={16} /> Add New 
            </button>
          </div>

          {isLoading ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 shadow-sm flex flex-col items-center justify-center">
              <Loader2 className="animate-spin text-yellow-800 mb-4" size={32} />
              <p className="text-slate-500 font-medium">Loading your portfolio...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-600 p-6 rounded-2xl border border-red-100 text-center font-medium">
              {error}
            </div>
          ) : transactions.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 shadow-sm">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                <Globe size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">No Packages Yet</h3>
              <p className="text-slate-500 mb-6 max-w-sm mx-auto">You haven't purchased any trading packages yet.</p>
              <button 
                onClick={() => navigate('/packages')} 
                className="px-8 py-3.5 bg-[#FFD700] text-black rounded-xl font-bold shadow-lg shadow-black/20 hover:bg-[#E6C200] transition-all hover:-translate-y-0.5"
              >
                Browse Packages
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(transactions as PaymentTxn[])
              .filter((txn) => txn.package_id !== "recharge") 
              .map((txn, i) => {
                const pkgMeta = getPackageById(txn.package_id);
                const isPending = txn.status !== 'success';
                const title = packageDisplayName(txn.package_id, txn.package_name);

                return (
                <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-full h-1 bg-[#FFD700] opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-yellow-50 text-neutral-900 rounded-xl flex items-center justify-center border border-yellow-200">
                      {pkgMeta ? <pkgMeta.icon size={24} /> : getPackageIcon(title)}
                    </div>
                    {txn.status === 'success' ? (
                      <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-[#FFF9E6] text-yellow-700 border border-yellow-200">
                        <CheckCircle2 size={14} /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                        <Clock size={14} /> Pending
                      </span>
                    )}
                  </div>
                  
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg mb-1 leading-tight">{title}</h3>
                    <p className="text-slate-400 text-xs font-mono mb-4">
                      {isPending
                        ? 'Payment not completed'
                        : `TXN: ${txn.tx_hash ? txn.tx_hash.slice(0, 10) + "..." : "—"}`}
                    </p>
                    <div className="flex items-end justify-between mt-auto">
                      <p className="text-3xl font-extrabold text-slate-900">
                        ${Number(txn.amount).toFixed(0)}
                        <span className="ml-1 text-sm font-semibold text-slate-500">USDT</span>
                      </p>
                    </div>
                    {isPending && (
                      <button
                        type="button"
                        onClick={() => handleContinueJourney(txn)}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FFD700] px-4 py-2.5 text-sm font-bold text-black transition hover:bg-[#E6C200]"
                      >
                        Proceed to payment
                        <ArrowRight size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default DashboardPage;