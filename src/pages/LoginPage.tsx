import React, { useState, useEffect, useRef, memo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Mail, Loader2, Shield } from "lucide-react"; // Changed AtSign to Mail
import { AuthPasswordField } from "@/components/ui/password-input";
import { GoogleLogin } from "@react-oauth/google";
import { useApp } from "@/context/AppContext";
import { useVerifiedSession } from "@/hooks/useVerifiedSession";
import { API_BASE, GOOGLE_CLIENT_ID } from "@/config/api";
import { firstAllowedEmployeePath } from "@/config/employeePermissionCatalog";
import { resolveEmployeeLandingPath } from "@/utils/employeeExploreMode";
import { captureReferralKeyFromUrl, getStoredReferralKey } from "@/hooks/usePackages";
import { getDeviceFingerprint } from "@/utils/deviceFingerprint";
import { reportLoginLocation } from "@/utils/reportLoginLocation";

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
      className="h-11 w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm text-slate-800 shadow-sm outline-none transition-all placeholder-slate-400 focus:border-neutral-900 focus:ring-1 focus:ring-yellow-500"
    />
  </div>
);

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setCurrentUser, currentUser } = useApp();
  const { isReady, role } = useVerifiedSession();

  useEffect(() => {
    if (!isReady || !role) return;
    if (role === "admin") {
      navigate("/admin/dashboard", { replace: true });
    } else if (role === "employee") {
      const perms = currentUser?.employeePermissions ?? [];
      const uid = currentUser?.userId;
      if (uid) navigate(resolveEmployeeLandingPath(uid, perms), { replace: true });
    } else {
      navigate("/user/dashboard", { replace: true });
    }
  }, [isReady, role, navigate, currentUser?.employeePermissions, currentUser?.userId]);

  useEffect(() => {
    captureReferralKeyFromUrl();
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, []);

  // 1. Changed state from telegram to email
  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if ((location.state as { blocked?: boolean } | null)?.blocked) {
      setErrorMessage("This account has been permanently closed.");
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate]);

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
      const deviceFingerprint = await getDeviceFingerprint();
      const response = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...form, deviceFingerprint }),
      });

      const data = await response.json();

      if (response.status === 403) {
        setErrorMessage(data.error || "Access denied");
        return;
      }

      if (data.success) {
        const role =
          data.role === "admin" ? "admin" : data.role === "employee" ? "employee" : "user";
        setCurrentUser({
          userId: String(data.userId),
          telegram: data.telegram ?? undefined,
          name: data.name ?? undefined,
          email: data.email ?? form.email,
          role,
          employeePermissions:
            role === "employee" && Array.isArray(data.employeePermissions)
              ? data.employeePermissions
              : undefined,
          ...(data.created_at || data.createdAt
            ? { createdAt: String(data.created_at ?? data.createdAt) }
            : {}),
        });

        reportLoginLocation({ userId: data.userId, loginMethod: "password" });

        if (role === "admin") {
          navigate("/admin/dashboard");
        } else if (role === "employee") {
          const perms = Array.isArray(data.employeePermissions) ? data.employeePermissions : [];
          navigate(resolveEmployeeLandingPath(String(data.userId), perms));
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

  const handleGoogleLogin = async (credential: string) => {
    setErrorMessage("");
    setIsSubmitting(true);
    try {
      const storedRef = getStoredReferralKey();
      const deviceFingerprint = await getDeviceFingerprint();
      const response = await fetch(`${API_BASE}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credential,
          deviceFingerprint,
          ...(storedRef ? { ref_key: storedRef } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        setErrorMessage(data?.error || "Google login failed");
        return;
      }
      const appRole = data.role === "admin" ? "admin" : "user";
      setCurrentUser({
        userId: String(data.userId),
        telegram: data.telegram ?? undefined,
        name: data.name ?? undefined,
        email: data.email ?? undefined,
        role: appRole,
        ...(data.created_at ? { createdAt: String(data.created_at) } : {}),
      });
      reportLoginLocation({ userId: data.userId, loginMethod: "google" });
      navigate(appRole === "admin" ? "/admin/dashboard" : "/user/dashboard");
    } catch {
      setErrorMessage("Google login failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-slate-200">

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
      <div className="pointer-events-none absolute left-0 right-0 top-4 z-0 flex h-[56px] items-center overflow-hidden border-y border-slate-300/60 bg-white/50 backdrop-blur-md md:top-8">
        <div className="absolute inset-0 bg-gradient-to-r from-slate-200 via-transparent to-slate-200 z-10" />
        <div className="w-full opacity-80">
          <TradingViewTicker widgetId="ticker-crypto" symbols={cryptoSymbols} />
        </div>
      </div>

      {/* Form Container - Centered */}
      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4">
        <div className="w-full max-w-[24.2rem] rounded-2xl border border-slate-200/80 bg-white px-6 py-5 shadow-xl shadow-slate-900/10">
          <div className="text-center">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-yellow-200 bg-yellow-50 px-2.5 py-0.5 text-neutral-900">
              <Shield size={12} />
              <span className="text-[10px] font-semibold uppercase tracking-wide">
                Secure Login
              </span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">Welcome Back</h1>
            <p className="mt-0.5 text-xs text-slate-500">Login to continue to your account</p>
          </div>

          {errorMessage && (
            <div className="mt-3 rounded-lg border border-red-100 bg-red-50 px-2.5 py-1.5 text-center text-xs text-red-600">
              {errorMessage}
            </div>
          )}

          <div className="mt-3.5 space-y-3">
            <InputField
              icon={Mail}
              type="email"
              placeholder="Email Address"
              value={form.email}
              onChange={(e: any) => update("email", e.target.value)}
            />

            <AuthPasswordField
              placeholder="Password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
            />

            <div className="-mt-0.5 text-right text-xs">
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
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#FFD700] py-2.5 text-[15px] font-bold text-black shadow-sm transition hover:bg-[#E6C200] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="animate-spin" size={16} />}
              {isSubmitting ? "Logging in..." : "Login"}
            </button>

            <div className="relative py-0.5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-white px-2 text-slate-400">or</span>
              </div>
            </div>

            {GOOGLE_CLIENT_ID ? (
              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={(resp) => {
                    if (resp.credential) handleGoogleLogin(resp.credential);
                    else setErrorMessage("Google did not return a login token.");
                  }}
                  onError={() => setErrorMessage("Google login popup failed.")}
                  useOneTap={false}
                  text="signin_with"
                  size="medium"
                  width="320"
                />
              </div>
            ) : (
              <p className="text-center text-[11px] text-slate-400">
                Google login is disabled (missing client ID).
              </p>
            )}

            <p className="pt-0.5 text-center text-xs text-slate-500">
              Don't have an account?{" "}
              <span
                onClick={() => navigate("/signup")}
                className="cursor-pointer font-semibold text-neutral-900 hover:underline"
              >
                Sign up
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Parallel Line (Forex/Gold) - Visually Below the form */}
      <div className="pointer-events-none absolute bottom-4 left-0 right-0 z-0 flex h-[56px] items-center overflow-hidden border-y border-slate-300/30 bg-white/20 backdrop-blur-sm md:bottom-8">
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