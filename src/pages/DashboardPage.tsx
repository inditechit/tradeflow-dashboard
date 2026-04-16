import React, { useEffect, useState, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { 
  Plane, Globe, Video, User, ShieldCheck, LogOut, 
  Loader2, CheckCircle2, Clock, Plus, TrendingUp 
} from 'lucide-react';

// --- TradingView Component (Memoized for performance) ---
const TradingViewChart = memo(() => {
  const container = useRef();

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
    /* We use a wrapper with a hard-coded height to force the iframe to expand */
    <div 
      className="tradingview-widget-container" 
      ref={container} 
      style={{ height: "800px", width: "100%", overflow: "hidden" }}
    >
      <div 
        className="tradingview-widget-container__widget" 
        style={{ height: "800px", width: "100%" }}
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
  const { currentUser, setCurrentUser } = useApp();
  
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const API_BASE = 'https://mt5api.inditechit.com/api';

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

  // Location tracking logic
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
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-xl shadow-cyan-900/5 border border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-cyan-50 flex items-center justify-center border border-cyan-100 text-cyan-600">
              <User size={32} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">  
                Welcome back, {currentUser?.name || 'Trader'}
              </h1>
              <p className="text-slate-500 text-sm mt-1">{currentUser?.email || 'No email provided'}</p>
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

        {/* Market Analysis Section - High Impact Chart */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="text-cyan-600" size={24} />
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
              className="text-cyan-600 text-sm font-bold hover:text-cyan-700 flex items-center gap-1"
            >
              <Plus size={16} /> Add New 
            </button>
          </div>

          {isLoading ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 shadow-sm flex flex-col items-center justify-center">
              <Loader2 className="animate-spin text-cyan-500 mb-4" size={32} />
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
                className="px-8 py-3.5 bg-cyan-600 text-white rounded-xl font-bold shadow-lg shadow-cyan-600/20 hover:bg-cyan-700 transition-all hover:-translate-y-0.5"
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
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 to-teal-400 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-cyan-50 text-cyan-600 rounded-xl flex items-center justify-center border border-cyan-100">
                      {getPackageIcon(txn.package_name)}
                    </div>
                    {txn.status === 'success' ? (
                      <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-green-50 text-green-600 border border-green-200">
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