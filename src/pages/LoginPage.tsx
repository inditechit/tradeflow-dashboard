import React, { useState, useEffect, useRef, memo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock, Mail, Loader2, Shield } from "lucide-react"; // Changed AtSign to Mail
import { useApp } from "@/context/AppContext";

// --- TRADINGVIEW WIDGET COMPONENT ---
// Added a unique `widgetId` prop to prevent conflicts when rendering multiple widgets
const TradingViewTicker = memo(({ symbols, widgetId }: { symbols: any[], widgetId: string }) => {
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
  }, [symbols, widgetId]);

  return (
    <div id={widgetId} className="tradingview-widget-container" ref={container} style={{ width: '100%' }}>
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

const InputField = ({ icon: Icon, placeholder, type = "text", value, onChange }: any) => (
  <div className="relative group w-full">
    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-yellow-800 transition-colors">
      <Icon size={18} />
    </div>

    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full pl-10 pr-4 py-3.5 rounded-xl text-sm bg-white border border-slate-200 text-slate-800 placeholder-slate-400 focus:border-neutral-900 focus:ring-1 focus:ring-yellow-500 transition-all outline-none shadow-sm"
    />
  </div>
);

const LoginPage = () => {
  const navigate = useNavigate();
  const { setCurrentUser } = useApp();

  const API_BASE = "https://api.copytradeengine.org/api";

  // 1. Changed state from telegram to email
  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrorMessage("");
  };

  // 2. Updated validation to check email
  const isValid = form.email.trim() !== "" && form.password.trim() !== "";

  const handleLogin = async () => {
    setErrorMessage("");

    if (!isValid) {
      // 3. Updated error message
      setErrorMessage("Email and password are required");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form), // This now naturally sends { email, password }
      });

      const data = await response.json();

      if (data.success) {
        setCurrentUser((prev: any) => ({
          ...(prev || {}),
          userId: String(data.userId),
          telegram: data.telegram ?? prev?.telegram,
          name: data.name ?? prev?.name,
          email: data.email ?? prev?.email,
          role: data.role,
          ...(data.created_at || data.createdAt
            ? { createdAt: String(data.created_at ?? data.createdAt) }
            : {}),
        }));

        if (data.role === "admin") {
          navigate("/admin/dashboard");
        } else {
          navigate("/user/dashboard");
        }
      } else {
        setErrorMessage(data.error || "Invalid login credentials");
      }
    } catch (err) {
      setErrorMessage("Server error. Please try again.");
    }

    setIsSubmitting(false);
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between bg-slate-200 overflow-hidden">

      {/* --- CREATIVE BACKGROUND ELEMENTS --- */}

      {/* 1. Subtle Trading Grid */}
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]" />

      {/* 2. Floating Graphic Candlesticks - FOREGROUND (z-20) */}

      {/* Bullish Candle 1 */}
      <div className="absolute z-20 left-[10%] top-[25%] w-6 h-48 animate-float-slow opacity-80 pointer-events-none">
        <div className="w-1 h-full bg-green-600 mx-auto rounded-full" /> {/* Wick */}
        <div className="absolute top-[20%] w-full h-[50%] bg-green-600 rounded-sm shadow-[0_0_20px_rgba(255,215,0,0.4)]" /> {/* Body */}
      </div>

      {/* Bearish Candle 1 */}
      <div className="absolute z-20 right-[15%] bottom-[20%] w-8 h-40 animate-float-medium opacity-70 pointer-events-none">
        <div className="w-1 h-full bg-red-600 mx-auto rounded-full" /> {/* Wick */}
        <div className="absolute top-[40%] w-full h-[40%] bg-red-600 rounded-sm shadow-[0_0_20px_rgba(248,113,113,0.4)]" /> {/* Body */}
      </div>

      {/* Bullish Candle 2 */}
      <div className="absolute z-20 right-[8%] top-[15%] w-4 h-32 animate-float-fast opacity-70 pointer-events-none">
        <div className="w-1 h-full bg-green-600 mx-auto rounded-full" /> {/* Wick */}
        <div className="absolute top-[10%] w-full h-[60%] bg-green-600 rounded-sm shadow-[0_0_20px_rgba(34,211,238,0.4)]" /> {/* Body */}
      </div>

      {/* Bearish Candle 2 */}
      <div className="absolute z-20 left-[20%] bottom-[15%] w-5 h-24 animate-float-slow opacity-60 pointer-events-none" style={{ animationDelay: '2s' }}>
        <div className="w-0.5 h-full bg-slate-400 mx-auto rounded-full" /> {/* Wick */}
        <div className="absolute top-[30%] w-full h-[30%] bg-slate-400 rounded-sm" /> {/* Body */}
      </div>


      {/* --- PAGE LAYOUT: TOP STRIP, FORM, BOTTOM STRIP --- */}

      {/* Top Parallel Line (Crypto) - Visually Above the form */}
      <div className="relative z-0 w-full h-[72px] mt-10 md:mt-16 bg-white/50 border-y border-slate-300/60 backdrop-blur-md flex items-center overflow-hidden pointer-events-none shrink-0">
        <div className="absolute inset-0 bg-gradient-to-r from-slate-200 via-transparent to-slate-200 z-10" />
        <div className="w-full opacity-80">
          <TradingViewTicker widgetId="ticker-crypto" symbols={cryptoSymbols} />
        </div>
      </div>

      {/* Form Container - Centered */}
      <div className="relative z-10 flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white/95 backdrop-blur-md rounded-2xl border border-slate-100 shadow-2xl shadow-neutral-900/12 overflow-hidden">

          {/* Header */}
          <div className="text-center p-8 border-b border-slate-100 bg-white">
            <div className="inline-flex items-center gap-3 mb-3 px-4 py-2 rounded-full bg-yellow-50 text-neutral-900 border border-yellow-200">
              <Shield size={20} />
              <span className="text-sm font-semibold uppercase">
                Secure Login
              </span>
            </div>

            <h1 className="text-3xl font-bold text-slate-800 mt-3">
              Welcome Back
            </h1>

            <p className="text-slate-500 text-sm mt-2">
              Login to continue to your account
            </p>
          </div>

          {/* Error */}
          {errorMessage && (
            <div className="mx-6 mt-6 p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm text-center">
              {errorMessage}
            </div>
          )}

          {/* Form */}
          <div className="p-8 space-y-6">
            {/* 4. Changed Input to Email */}
            <InputField
              icon={Mail}
              type="email"
              placeholder="Email Address"
              value={form.email}
              onChange={(e: any) => update("email", e.target.value)}
            />

            <InputField
              icon={Lock}
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={(e: any) => update("password", e.target.value)}
            />

            <div className="text-right text-sm">
              <Link
                to="/forgot-password"
                className="font-semibold text-neutral-900 hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            <button
              onClick={handleLogin}
              disabled={!isValid || isSubmitting}
              className="w-full py-4 rounded-xl bg-[#FFD700] text-black text-lg font-bold shadow-lg shadow-black/25 hover:bg-[#E6C200] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 className="animate-spin" size={20} />}
              {isSubmitting ? "Logging in..." : "Login"}
            </button>

            <div className="text-center text-sm text-slate-500">
              Don't have an account?{" "}
              <span
                onClick={() => navigate("/signup")}
                className="text-neutral-900 font-semibold cursor-pointer hover:underline"
              >
                Sign up
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Parallel Line (Forex/Gold) - Visually Below the form */}
      <div className="relative z-0 w-full h-[72px] mb-10 md:mb-16 bg-white/20 border-y border-slate-300/30 backdrop-blur-sm flex items-center overflow-hidden pointer-events-none shrink-0">
        <div className="absolute inset-0 bg-gradient-to-r from-slate-200 via-transparent to-slate-200 z-10" />
        <div className="w-full opacity-60">
          <TradingViewTicker widgetId="ticker-forex" symbols={forexSymbols} />
        </div>
      </div>

      {/* Keyframes for the floating candles animations */}
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

export default LoginPage;