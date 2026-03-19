import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, AtSign, Loader2, Shield } from "lucide-react";
import { useApp } from "@/context/AppContext";

const InputField = ({ icon: Icon, placeholder, type = "text", value, onChange }: any) => (
  <div className="relative group w-full">
    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-cyan-500 transition-colors">
      <Icon size={18} />
    </div>

    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full pl-10 pr-4 py-3.5 rounded-xl text-sm bg-white border border-slate-200 text-slate-800 placeholder-slate-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all outline-none shadow-sm"
    />
  </div>
);

const tickerContent = (
  <>
    <span className="mx-8">BTC/USD <span className="text-emerald-500">▲ 64,230.12</span></span>
    <span className="mx-8">EUR/USD <span className="text-red-500">▼ 1.0845</span></span>
    <span className="mx-8">GBP/JPY <span className="text-emerald-500">▲ 191.24</span></span>
    <span className="mx-8">GOLD <span className="text-emerald-500">▲ 2,341.80</span></span>
    <span className="mx-8">US30 <span className="text-red-500">▼ 38,460.50</span></span>
    <span className="mx-8">ETH/USD <span className="text-emerald-500">▲ 3,120.45</span></span>

    {/* duplicate for smooth loop */}
    <span className="mx-8">BTC/USD <span className="text-emerald-500">▲ 64,230.12</span></span>
    <span className="mx-8">EUR/USD <span className="text-red-500">▼ 1.0845</span></span>
    <span className="mx-8">GBP/JPY <span className="text-emerald-500">▲ 191.24</span></span>
    <span className="mx-8">GOLD <span className="text-emerald-500">▲ 2,341.80</span></span>
    <span className="mx-8">US30 <span className="text-red-500">▼ 38,460.50</span></span>
    <span className="mx-8">ETH/USD <span className="text-emerald-500">▲ 3,120.45</span></span>
  </>
);


const LoginPage = () => {
  const navigate = useNavigate();
  const { setCurrentUser } = useApp();

  const API_BASE = "https://mt5api.inditechit.com/api";

  const [form, setForm] = useState({
    telegram: "",
    password: "",
  });

  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrorMessage("");
  };

  const isValid = form.telegram.trim() !== "" && form.password.trim() !== "";

  const handleLogin = async () => {
    setErrorMessage("");

    if (!isValid) {
      setErrorMessage("Telegram username and password are required");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (data.success) {
        setCurrentUser({
          userId: data.userId,
          telegram: data.telegram,
        });

        navigate('/dashboard');
      } else {
        setErrorMessage(data.error || "Invalid login credentials");
      }
    } catch (err) {
      setErrorMessage("Server error. Please try again.");
    }

    setIsSubmitting(false);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-slate-50 overflow-hidden">

      {/* --- CREATIVE BACKGROUND ELEMENTS --- */}

      {/* 1. Subtle Trading Grid */}
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]" />

      <div className="absolute z-0 w-[200%] h-16 top-1/4 -left-1/2 -rotate-12 bg-white/50 border-y border-slate-200/60 backdrop-blur-md flex items-center overflow-hidden">

        <div className="absolute inset-0 bg-gradient-to-r from-slate-50 via-transparent to-slate-50 z-10" />

        <div className="animate-ticker-fast flex w-max whitespace-nowrap text-slate-500 font-mono text-sm tracking-wider opacity-80">
          {tickerContent}
        </div>
      </div>

      <div className="absolute z-0 w-[200%] h-14 top-[50%] -left-1/2 -rotate-12 bg-white/30 border-y border-slate-200/40 backdrop-blur-sm flex items-center overflow-hidden">

        <div className="absolute inset-0 bg-gradient-to-r from-slate-50 via-transparent to-slate-50 z-10" />

        <div className="animate-ticker-medium flex w-max whitespace-nowrap text-slate-400 font-mono text-sm tracking-wider opacity-60">
          {tickerContent}
        </div>
      </div>

      <div className="absolute z-0 w-[200%] h-12 bottom-[10%] -left-1/2 -rotate-12 bg-white/20 border-y border-slate-200/30 backdrop-blur-sm flex items-center overflow-hidden">

        <div className="absolute inset-0 bg-gradient-to-r from-slate-50 via-transparent to-slate-50 z-10" />

        <div className="animate-ticker-slow flex w-max whitespace-nowrap text-slate-400 font-mono text-xs tracking-wider opacity-40">
          {tickerContent}
        </div>
      </div>


      {/* 3. Floating Graphic Candlesticks */}

      {/* Bullish Candle 1 */}
      <div className="absolute z-0 left-[15%] top-[20%] w-6 h-48 animate-float-slow opacity-40">
        <div className="w-1 h-full bg-emerald-400 mx-auto rounded-full" /> {/* Wick */}
        <div className="absolute top-[20%] w-full h-[50%] bg-emerald-400 rounded-sm shadow-[0_0_15px_rgba(52,211,153,0.3)]" /> {/* Body */}
      </div>

      {/* Bearish Candle 1 */}
      <div className="absolute z-0 right-[20%] bottom-[15%] w-8 h-40 animate-float-medium opacity-30">
        <div className="w-1 h-full bg-red-400 mx-auto rounded-full" /> {/* Wick */}
        <div className="absolute top-[40%] w-full h-[40%] bg-red-400 rounded-sm shadow-[0_0_15px_rgba(248,113,113,0.3)]" /> {/* Body */}
      </div>

      {/* Bullish Candle 2 */}
      <div className="absolute z-0 right-[10%] top-[10%] w-4 h-32 animate-float-fast opacity-30">
        <div className="w-1 h-full bg-cyan-400 mx-auto rounded-full" /> {/* Wick */}
        <div className="absolute top-[10%] w-full h-[60%] bg-cyan-400 rounded-sm shadow-[0_0_15px_rgba(34,211,238,0.3)]" /> {/* Body */}
      </div>

      {/* Bearish Candle 2 */}
      <div className="absolute z-0 left-[25%] bottom-[10%] w-5 h-24 animate-float-slow opacity-20" style={{ animationDelay: '2s' }}>
        <div className="w-0.5 h-full bg-slate-400 mx-auto rounded-full" /> {/* Wick */}
        <div className="absolute top-[30%] w-full h-[30%] bg-slate-400 rounded-sm" /> {/* Body */}
      </div>

      {/* --- ORIGINAL FORM UNTOUCHED --- */}
      <div className="relative z-10 w-full max-w-md bg-white rounded-2xl border border-slate-100 shadow-2xl shadow-cyan-900/5 overflow-hidden">

        {/* Header */}
        <div className="text-center p-8 border-b border-slate-100">
          <div className="inline-flex items-center gap-3 mb-3 px-4 py-2 rounded-full bg-cyan-50 text-cyan-600 border border-cyan-100">
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

          <InputField
            icon={AtSign}
            placeholder="Telegram Username"
            value={form.telegram}
            onChange={(e: any) => update("telegram", e.target.value)}
          />

          <InputField
            icon={Lock}
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e: any) => update("password", e.target.value)}
          />

          <button
            onClick={handleLogin}
            disabled={!isValid || isSubmitting}
            className="w-full py-4 rounded-xl bg-cyan-600 text-white text-lg font-bold shadow-lg shadow-cyan-600/25 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting && <Loader2 className="animate-spin" size={20} />}
            {isSubmitting ? "Logging in..." : "Login"}
          </button>

          <div className="text-center text-sm text-slate-500">
            Don't have an account?{" "}
            <span
              onClick={() => navigate("/signup")}
              className="text-cyan-600 font-semibold cursor-pointer hover:underline"
            >
              Sign up
            </span>
          </div>
        </div>
      </div>

      {/* Keyframes for the custom animations */}
      <style>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-ticker {
          animation: ticker 30s linear infinite;
        }
        
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