import React, { useEffect, useState, useRef, memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { 
  Plane, Globe, Video, User, LogOut, 
  Loader2, CheckCircle2, Clock, Plus, TrendingUp,
  Wallet, CircleDollarSign, ArrowRight,
} from 'lucide-react';
import { formatMoneyAmount } from '@/utils/userProfitShare';
import { getPackageById, packageDisplayName } from '@/constants/packages';
import { API_BASE, SOCKET_URL } from '@/config/api';
import { io } from 'socket.io-client';
import { applyUserRules, resolveEffectiveSlice, isTradeClosed, rowNetPl } from '@/utils/userTradePl';

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
  const liveTicketRef = useRef<Record<string, { v_i: number; V: number; fee: number; pct: number }>>({});
  const openPlByTicketRef = useRef<Record<string, number>>({});

  const walletBalance = Number(wallet?.balance ?? 0);
  const currency = wallet?.currency || "USD";
  const tradePl = livePl + pendingClosedPl;
  const equity = walletBalance + tradePl;
  const profitLoss = livePl;

  const sumOpenPl = () =>
    Object.values(openPlByTicketRef.current).reduce((s, n) => s + (Number(n) || 0), 0);

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

      const funded =
        summaryData?.funded !== false && assignData?.funded !== false && Number(wData?.wallet?.balance ?? assignData?.balance ?? 0) > 0;
      setAssignFunded(funded);

      const tradesRes = await fetch(`${API_BASE}/user/trades/${uid}`);
      const tradesData = await tradesRes.json();

      const nextOpenPl: Record<string, number> = {};
      const nextSlice: Record<string, { v_i: number; V: number; fee: number; pct: number }> = {};
      let openCount = 0;
      if (tradesData?.success && Array.isArray(tradesData.trades)) {
        for (const t of tradesData.trades) {
          if (isTradeClosed(t)) continue;
          openCount += 1;
          const ticket = String(t.ticket_id ?? '');
          if (!ticket) continue;
          nextOpenPl[ticket] = rowNetPl(t);
          const slice = resolveEffectiveSlice(t);
          nextSlice[ticket] = {
            v_i: slice.v_i,
            V: slice.V,
            fee: slice.fee,
            pct: slice.pct,
          };
        }
      }
      openPlByTicketRef.current = nextOpenPl;
      liveTicketRef.current = nextSlice;
      setOpenPositionCount(openCount);

      if (summaryData?.success) {
        const apiLive = Number(summaryData.live_pl ?? 0);
        const apiPending = Number(summaryData.pending_closed_pl ?? 0);
        setPendingClosedPl(apiPending);
        setLivePl(openCount > 0 ? sumOpenPl() : apiLive);
      } else {
        setPendingClosedPl(0);
        setLivePl(sumOpenPl());
      }
    } catch (err) {
      console.error('Finance load error:', err);
    } finally {
      setLoadingFinance(false);
    }
  }, [currentUser?.userId, currentUser?.role, currentUser?.createdAt, updateUser]);

  const applyLiveMt5Profit = useCallback((ticket: string, rawProfit: number) => {
    const ctx = liveTicketRef.current[ticket];
    if (!ctx || !(ctx.V > 0 && ctx.v_i > 0)) return;
    const userRaw = rawProfit * (ctx.v_i / ctx.V);
    openPlByTicketRef.current[ticket] = applyUserRules(userRaw, ctx.fee, ctx.pct);
    setLivePl(
      Object.values(openPlByTicketRef.current).reduce((s, n) => s + (Number(n) || 0), 0),
    );
  }, []);

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

        {currentUser?.role !== 'admin' && assignFunded === false && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {walletBalance <= 0 ? (
              <p>
                Wallet is empty — open trades are settled and you will not receive new trades until you{' '}
                <button
                  type="button"
                  className="font-semibold text-neutral-800 underline decoration-neutral-900"
                  onClick={() => navigate('/user/recharge')}
                >
                  add funds
                </button>
            
              </p>
            ) : (
              <p>
                <button
                  type="button"
                  className="font-semibold text-neutral-800 underline decoration-neutral-900"
                  onClick={() => navigate('/user/recharge')}
                >
                  Add funds
                </button>{' '}
                to join live trades.
              </p>
            )}
          </div>
        )}

        {currentUser?.role !== 'admin' && (
          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm shadow-neutral-900/8">
              <div className="mb-2 flex items-center gap-2 text-slate-500">
                <Wallet className="h-5 w-5 text-neutral-900" />
                <span className="text-xs font-bold uppercase tracking-wide">Wallet</span>
              </div>
              {loadingFinance && !wallet ? (
                <Loader2 className="h-8 w-8 animate-spin text-yellow-800" />
              ) : wallet ? (
                <p className="text-2xl font-extrabold tabular-nums text-slate-900">
                  {formatMoneyAmount(walletBalance, currency)}
                </p>
              ) : (
                <p className="text-slate-500 text-sm">Could not load</p>
              )}
            <button 
                  onClick={() => navigate('/user/recharge')}
                  className="flex items-center gap-1 bg-[#ecd888] mt-4 hover:bg-[#FFD700] text-gray-800 hover:text-black border border-yellow-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                >
                  <Plus size={14} /> Add Fund
                </button>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm shadow-neutral-900/8">
              <div className="mb-2 flex items-center gap-2 text-slate-500">
                <TrendingUp className="h-5 w-5 text-yellow-700" />
                <span className="text-xs font-bold uppercase tracking-wide">Live P/L</span>
              </div>
              {loadingFinance ? (
                <Loader2 className="h-8 w-8 animate-spin text-yellow-800" />
              ) : (
                <p className={`text-2xl font-extrabold tabular-nums ${profitLoss >= 0 ? 'text-yellow-700' : 'text-red-600'}`}>
                  {profitLoss > 0 ? '+' : ''}{formatMoneyAmount(profitLoss, currency)}
                </p>
              )}
              <p className="mt-2 text-xs text-slate-500">
                {openPositionCount > 0
                  ? `${openPositionCount} open · your proportional share`
                  : 'No open positions'}
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
                {formatMoneyAmount(walletBalance, currency)} wallet
                {livePl !== 0 ? ` + ${formatMoneyAmount(livePl, currency)} open` : ''}
                {pendingClosedPl !== 0
                  ? ` + ${formatMoneyAmount(pendingClosedPl, currency)} closed (pending)`
                  : ''}
                {' '}= equity
              </p>
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