import React, { useEffect, useState, useRef, memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { 
  Plane, Globe, Video, User, LogOut, 
  Loader2, CheckCircle2, Clock, Plus, TrendingUp,
  Wallet, Percent,
} from 'lucide-react';
import { formatMoneyAmount } from '@/utils/userProfitShare';
import { tradeEventMs } from '@/utils/mt5TradeDates';

// --- TradingView Component (Memoized for performance) ---
const TradingViewChart = memo(() => {
  const container = useRef<HTMLDivElement>(null);


  useEffect(() => {

    const scriptId = 'tradingview-widget-script';


    // Clean up any existing script/iframe to force a fresh render with new height

    if (container.current) {

      container.current.innerHTML = "";

    }



    const script = document.createElement("script");

    script.id = scriptId;

    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";

    script.type = "text/javascript";

    script.async = true;

    script.innerHTML = JSON.stringify({

      "width": "100%",

      "height": 400,

      "symbol": "BINANCE:BTCUSDT",

      "interval": "D",

      "timezone": "Etc/UTC",

      "theme": "light",

      "style": "1",

      "locale": "en",

      "enable_publishing": false,

      "allow_symbol_change": true,

      "calendar": false,

      "support_host": "https://www.tradingview.com"

    });


    if (container.current) {

      container.current.appendChild(script);

    }



    return () => {

      if (container.current) {

        container.current.innerHTML = "";

      }

    };

  }, []);

  
  return (
    <div 
      className="tradingview-widget-container" 
      ref={container} 
      style={{ height: "600px", width: "100%", overflow: "hidden" }}
    >
      <div 
        className="tradingview-widget-container__widget" 
        style={{ height: "100%", width: "100%" }}
      ></div>
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
  const { currentUser, setCurrentUser, updateUser } = useApp();
  
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [wallet, setWallet] = useState<{ balance: string | number; currency: string } | null>(null);
  const [tradesFeed, setTradesFeed] = useState<Record<string, unknown>[]>([]);
  const [loadingFinance, setLoadingFinance] = useState(true);
  const [assignFunded, setAssignFunded] = useState(true);

  const API_BASE = 'https://mt5api.inditechit.com/api';

  const joinMs = useMemo(() => {
    const iso = currentUser?.createdAt;
    if (!iso) return null;
    const ms = Date.parse(String(iso));
    return Number.isFinite(ms) ? ms : null;
  }, [currentUser?.createdAt]);

  /** Settled trades: stored P/L. Open trades: live estimate from your row only */
  const yourShareSinceJoin = useMemo(() => {
    if (tradesFeed.length === 0) return 0;
    let sum = 0;
    for (const r of tradesFeed as Record<string, unknown>[]) {
      if (joinMs != null) {
        const ev = tradeEventMs({
          status: r.mt5_status as string | undefined,
          open_time: r.open_time as string | null,
          close_time: r.close_time as string | null,
        });
        if (ev == null || ev < joinMs) continue;
      }
      if (r.wallet_settled_at) {
        sum += Number(r.final_profit_loss ?? 0);
      } else if (r.user_estimated_net_pl != null) {
        sum += Number(r.user_estimated_net_pl);
      } else {
        sum += Number(r.user_estimated_live_pl ?? 0);
      }
    }
    return sum;
  }, [tradesFeed, joinMs]);

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

    let cancelled = false;

    const loadFinance = async () => {
      setLoadingFinance(true);
      try {
        const uid = currentUser.userId;
        
        const [wRes, pRes, assignRes, userTradesRes] = await Promise.all([
          fetch(`${API_BASE}/user/wallet/${uid}`),
          fetch(`${API_BASE}/user/profit/${uid}`),
          fetch(`${API_BASE}/user/trade-assign/${uid}`),
          fetch(`${API_BASE}/user/trades/${uid}`),
        ]);

        const wData = await wRes.json();
        const pData = await pRes.json();
        const assignData = await assignRes.json();
        const utData = await userTradesRes.json();

        if (cancelled) return;

        if (wData.success && wData.wallet) {
          setWallet(wData.wallet);
        }

        if (pData.success) {
          const joinFromApi = pData.created_at || pData.joined_at || pData.signup_date;
          if (joinFromApi && !currentUser.createdAt) {
            updateUser({ createdAt: String(joinFromApi) });
          }
        }

        setAssignFunded(assignData?.funded !== false);

        if (utData.success && Array.isArray(utData.trades)) {
          setTradesFeed(utData.trades);
        } else {
          setTradesFeed([]);
        }
      } catch (err) {
        console.error("Finance load error:", err);
      } finally {
        if (!cancelled) setLoadingFinance(false);
      }
    };

    loadFinance();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.userId, currentUser?.role, currentUser?.createdAt]);

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
    setCurrentUser(null);
    localStorage.removeItem('mt5_user');
    localStorage.removeItem('mt5_packages'); 
    navigate('/login');
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
            <button
              type="button"
              className="font-semibold text-neutral-800 underline decoration-neutral-900"
              onClick={() => navigate('/user/recharge')}
            >
              Add funds
            </button>
          </div>
        )}

        {/* Wallet & trade P/L (user only) */}
        {currentUser?.role !== 'admin' && (
          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm shadow-neutral-900/8">
              <div className="mb-2 flex items-center gap-2 text-slate-500">
                <Wallet className="h-5 w-5 text-neutral-900" />
                <span className="text-xs font-bold uppercase tracking-wide">Wallet balance</span>
              </div>
              {loadingFinance && !wallet ? (
                <Loader2 className="h-8 w-8 animate-spin text-yellow-800" />
              ) : wallet ? (
                <p className="text-2xl font-extrabold tabular-nums text-slate-900">
                  {wallet.currency}{' '}
                  {Number(wallet.balance).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              ) : (
                <p className="text-slate-500 text-sm">Could not load wallet</p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm shadow-neutral-900/8 md:col-span-1">
              <div className="mb-2 flex items-center gap-2 text-slate-500">
                <TrendingUp className="h-5 w-5 text-yellow-700" />
                <span className="text-xs font-bold uppercase tracking-wide">Trade P/L</span>
              </div>
              {loadingFinance && tradesFeed.length === 0 ? (
                <Loader2 className="h-8 w-8 animate-spin text-yellow-800" />
              ) : (
                <p
                  className={`text-2xl font-extrabold tabular-nums ${
                    yourShareSinceJoin >= 0 ? "text-yellow-700" : "text-red-600"
                  }`}
                >
                  {yourShareSinceJoin > 0 ? "+" : ""}
                  {formatMoneyAmount(yourShareSinceJoin, wallet?.currency || "USD")}
                </p>
              )}
            </div>
          </section>
        )}

        {/* Market Analysis Section - High Impact Chart */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="text-neutral-900" size={24} />
            <h2 className="text-xl font-bold text-slate-800">Market Analysis</h2>
          </div>
          <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-lg overflow-hidden">
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
              {transactions
              .filter((txn) => txn.package_id !== "recharge") 
              .map((txn, i) => (
                <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-full h-1 bg-[#FFD700] opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-yellow-50 text-neutral-900 rounded-xl flex items-center justify-center border border-yellow-200">
                      {getPackageIcon(txn.package_name)}
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
                    <h3 className="font-bold text-slate-800 text-lg mb-1 leading-tight">{txn.package_name}</h3>
                    {txn.payment_method !== "INR" && (
                      <p className="text-slate-400 text-xs font-mono mb-4">
                        TXN: {txn.tx_hash ? txn.tx_hash.slice(0, 10) + "..." : "Processing..."}
                      </p>
                    )}
                    <div className="flex items-end justify-between mt-auto">
                      <p className="text-3xl font-extrabold text-slate-900">
                        {txn.payment_method === "INR" ? "₹" : "$"}
                        {txn.payment_method === "USD"
                          ? Number(txn.amount).toFixed(0)
                          : Number(txn.amount).toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-500 font-medium uppercase">{txn.payment_method}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default DashboardPage;