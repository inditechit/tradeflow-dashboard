import React, { useState, useEffect, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Loader2, ArrowRight, Activity, CheckCircle2 } from 'lucide-react';

// --- TRADINGVIEW WIDGET COMPONENT ---
const TradingViewTicker = memo(({ symbols }: { symbols: any[] }) => {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;
    
    // Clear the container to prevent duplicates in strict mode
    container.current.innerHTML = ''; 

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols: symbols,
      showSymbolLogo: true,
      isTransparent: true,
      displayMode: "regular",
      colorTheme: "light",
      locale: "en"
    });

    container.current.appendChild(script);
  }, [symbols]);

  return (
    <div className="tradingview-widget-container" ref={container} style={{ width: '100%' }}>
      <div className="tradingview-widget-container__widget"></div>
    </div>
  );
});

// Real-time market data categories for the strips
const cryptoSymbols = [
  { proName: "BITSTAMP:BTCUSD", title: "Bitcoin" },
  { proName: "BITSTAMP:ETHUSD", title: "Ethereum" },
  { proName: "BINANCE:SOLUSDT", title: "Solana" },
  { proName: "BINANCE:BNBUSDT", title: "BNB" },
  { proName: "BINANCE:XRPUSDT", title: "XRP" },
  { proName: "BINANCE:ADAUSDT", title: "Cardano" }
];

const forexSymbols = [
  { proName: "FX_IDC:EURUSD", title: "EUR/USD" },
  { proName: "FX_IDC:GBPUSD", title: "GBP/USD" },
  { proName: "FX_IDC:USDJPY", title: "USD/JPY" },
  { proName: "OANDA:XAUUSD", title: "Gold" },
  { proName: "OANDA:XAGUSD", title: "Silver" },
  { proName: "FX_IDC:AUDUSD", title: "AUD/USD" }
];

const indexSymbols = [
  { proName: "FOREXCOM:SPXUSD", title: "S&P 500" },
  { proName: "FOREXCOM:NSXUSD", title: "US 100" },
  { proName: "FOREXCOM:DJI", title: "Dow 30" },
  { proName: "OANDA:UK100GBP", title: "UK 100" },
  { proName: "INDEX:NKY", title: "Nikkei 225" },
  { proName: "INDEX:DAX", title: "DAX" }
];

const experienceOptions = [
  '0 years', '0-1 year', '1-2 years', '2-3 years',
  '3-5 years', '5-7 years', '7-10 years', '10+ years',
];

const ProfilePage = () => {
  const navigate = useNavigate();
  const { currentUser, updateUser } = useApp();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const experience = currentUser?.experienceYears || '';

  const API_BASE = 'https://api.copytradeengine.org/api';

  const handleSaveAndProceed = async () => {
    if (!currentUser?.userId) {
      // Fallback if they refreshed the page and lost context, just send them forward
      navigate('/packages');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const response = await fetch(`${API_BASE}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.userId,
          experience: experience,
          depositMethod: 'USDT'
        })
      });

      const data = await response.json();

      if (data.success) {
        navigate('/packages');
      } else {
        setErrorMessage(data.error || 'Failed to save profile.');
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage('Server error. Could not save profile.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 py-10 bg-slate-200 overflow-hidden">
      
      {/* --- CREATIVE BACKGROUND ELEMENTS --- */}

      {/* 1. Subtle Trading Grid */}
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]" />

      {/* Parallel Line 1 (Crypto) */}
      <div className="absolute z-0 w-[200%] h-[72px] top-[15%] -left-1/2 -rotate-12 bg-white/50 border-y border-slate-300/60 backdrop-blur-md flex items-center overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-slate-200 via-transparent to-slate-200 z-10" />
        <div className="w-full opacity-80">
          <TradingViewTicker symbols={cryptoSymbols} />
        </div>
      </div>

      {/* Parallel Line 2 (Forex/Gold) */}
      <div className="absolute z-0 w-[200%] h-[72px] bottom-[15%] -left-1/2 -rotate-12 bg-white/20 border-y border-slate-300/30 backdrop-blur-sm flex items-center overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-slate-200 via-transparent to-slate-200 z-10" />
        <div className="w-full opacity-60">
          <TradingViewTicker symbols={forexSymbols} />
        </div>
      </div>

      {/* Intersecting Line (Indices) */}
      <div className="absolute z-0 w-[200%] h-[72px] top-[45%] -left-[30%] rotate-12 bg-white/30 border-y border-slate-300/40 backdrop-blur-sm flex items-center overflow-hidden shadow-sm shadow-neutral-900/8 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-slate-200 via-transparent to-slate-200 z-10" />
        <div className="w-full opacity-70">
          <TradingViewTicker symbols={indexSymbols} />
        </div>
      </div>

      {/* 3. Floating Graphic Candlesticks */}
      
      {/* Bullish Candle 1 */}
      <div className="absolute z-0 left-[10%] top-[25%] w-6 h-48 animate-float-slow opacity-50">
        <div className="w-1 h-full bg-[#FFD700] mx-auto rounded-full" />
        <div className="absolute top-[20%] w-full h-[50%] bg-[#FFD700] rounded-sm shadow-[0_0_15px_rgba(255,215,0,0.3)]" />
      </div>

      {/* Bearish Candle 1 */}
      <div className="absolute z-0 right-[15%] bottom-[20%] w-8 h-40 animate-float-medium opacity-40">
        <div className="w-1 h-full bg-red-400 mx-auto rounded-full" />
        <div className="absolute top-[40%] w-full h-[40%] bg-red-400 rounded-sm shadow-[0_0_15px_rgba(248,113,113,0.3)]" />
      </div>

      {/* Bullish Candle 2 */}
      <div className="absolute z-0 right-[8%] top-[15%] w-4 h-32 animate-float-fast opacity-40">
        <div className="w-1 h-full bg-yellow-400 mx-auto rounded-full" />
        <div className="absolute top-[10%] w-full h-[60%] bg-yellow-400 rounded-sm shadow-[0_0_15px_rgba(34,211,238,0.3)]" />
      </div>

      {/* Bearish Candle 2 */}
      <div className="absolute z-0 left-[20%] bottom-[15%] w-5 h-24 animate-float-slow opacity-30" style={{ animationDelay: '2s' }}>
        <div className="w-0.5 h-full bg-slate-400 mx-auto rounded-full" />
        <div className="absolute top-[30%] w-full h-[30%] bg-slate-400 rounded-sm" />
      </div>

      {/* --- ORIGINAL FORM UNTOUCHED --- */}
      <div className="relative z-10 w-full max-w-3xl rounded-2xl bg-white/95 backdrop-blur-md border border-slate-100 shadow-2xl shadow-neutral-900/12 overflow-hidden flex flex-col">
        
        {/* Header Section */}
        <div className="text-center p-8 pb-6 border-b border-slate-100 bg-white">
          <div className="inline-flex items-center justify-center gap-2 mb-3 px-4 py-2 rounded-full bg-yellow-50 text-neutral-900 border border-yellow-200">
            <Activity size={18} />
            <span className="font-semibold tracking-wide uppercase text-sm">Step 2 of 3</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mt-2">Trading Profile</h1>
          <p className="text-slate-500 text-sm mt-2">Tell us about yourself so Copy Trade Engine can personalize your experience</p>
        </div>

        {/* Global Error Message */}
        {errorMessage && (
          <div className="mx-8 mt-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium text-center">
            {errorMessage}
          </div>
        )}

        {/* Body Section */}
        <div className="p-8 md:p-10 flex-1 space-y-10 bg-white/95 backdrop-blur-md">
          
          {/* Question 1: Experience */}
          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Activity className="text-yellow-800" size={20} />
              Trading Experience
            </h2>
            <p className="text-sm text-slate-500 mb-4">How many years have you been actively trading?</p>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {experienceOptions.map(opt => {
                const isSelected = experience === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => updateUser({ experienceYears: opt })}
                    className={`relative p-4 rounded-xl border text-sm font-medium transition-all duration-200 flex flex-col items-center justify-center gap-2
                      ${isSelected 
                        ? 'border-neutral-900 bg-yellow-50 text-neutral-800 shadow-sm shadow-yellow-400/12' 
                        : 'border-slate-200 bg-white text-slate-600 hover:border-yellow-300 hover:bg-slate-50'
                      }`}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 text-yellow-800 animate-in zoom-in">
                        <CheckCircle2 size={16} fill="currentColor" className="text-white" />
                      </div>
                    )}
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Proceed Button */}
          <div className="pt-6">
            <button
              onClick={handleSaveAndProceed}
              disabled={!experience || isSubmitting}
              className="w-full py-4 rounded-xl bg-[#FFD700] text-black text-lg font-bold shadow-lg shadow-black/25 hover:bg-[#E6C200] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : null}
              {isSubmitting ? 'Saving Profile...' : 'View Packages'} 
              {!isSubmitting && <ArrowRight size={20} />}
            </button>
          </div>

        </div>
      </div>

      {/* Keyframes for the floating candles */}
      <style>{`        
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        .animate-float-slow {
          animation: float 8s ease-in-out infinite;
        }
        .animate-float-medium {
          animation: float 6s ease-in-out infinite;
        }
        .animate-float-fast {
          animation: float 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default ProfilePage;