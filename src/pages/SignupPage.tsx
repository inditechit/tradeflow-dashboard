import { useEffect, useRef, useState, memo } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { Loader2, Shield } from "lucide-react";
import { useApp, UserData } from "@/context/AppContext";
import { API_BASE, GOOGLE_CLIENT_ID } from "@/config/api";
import { getDeviceFingerprint } from "@/utils/deviceFingerprint";

const TradingViewTicker = memo(({ symbols }: { symbols: { proName: string; title: string }[] }) => {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;
    container.current.innerHTML = "";
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols,
      showSymbolLogo: true,
      isTransparent: true,
      displayMode: "regular",
      colorTheme: "light",
      locale: "en",
    });
    container.current.appendChild(script);
  }, [symbols]);

  return (
    <div className="tradingview-widget-container" ref={container} style={{ width: "100%" }}>
      <div className="tradingview-widget-container__widget" />
    </div>
  );
});

const cryptoSymbols = [
  { proName: "BITSTAMP:BTCUSD", title: "Bitcoin" },
  { proName: "BITSTAMP:ETHUSD", title: "Ethereum" },
  { proName: "BINANCE:SOLUSDT", title: "Solana" },
  { proName: "BINANCE:BNBUSDT", title: "BNB" },
];

const forexSymbols = [
  { proName: "FX_IDC:EURUSD", title: "EUR/USD" },
  { proName: "OANDA:XAUUSD", title: "Gold" },
  { proName: "FX_IDC:GBPUSD", title: "GBP/USD" },
];

export default function SignupPage() {
  const navigate = useNavigate();
  const { setCurrentUser } = useApp();
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refValue = params.get("r") || params.get("ref");
    if (refValue) {
      sessionStorage.setItem("referrer_key", refValue);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleGoogleSignup = async (credential: string) => {
    setErrorMessage("");
    setIsSubmitting(true);
    try {
      const storedRef = sessionStorage.getItem("referrer_key");
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
        setErrorMessage(data?.error || "Google signup failed.");
        return;
      }
      sessionStorage.removeItem("referrer_key");
      const user: UserData = {
        name: data.name ?? "",
        mobile: "",
        telegram: data.telegram ?? "",
        email: data.email ?? "",
        userId: String(data.userId),
        role: data.role === "admin" ? "admin" : "user",
        createdAt: data.created_at ? String(data.created_at) : new Date().toISOString(),
        emailVerified: true,
        photoCaptured: false,
        experienceYears: "",
        depositMethod: "USDT",
      };
      setCurrentUser(user);
      navigate(data.isNewUser ? "/user/post-signup" : "/user/dashboard");
    } catch {
      setErrorMessage("Google signup failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-200 p-4 py-10">
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]" />

      <div className="pointer-events-none absolute top-[1.5%] z-0 flex h-[60px] w-full items-center overflow-hidden border-y border-slate-300/50 bg-white/60 backdrop-blur-md">
        <div className="w-full opacity-90">
          <TradingViewTicker symbols={cryptoSymbols} />
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-[1.5%] z-0 flex h-[60px] w-full items-center overflow-hidden border-y border-slate-300/30 bg-white/30 backdrop-blur-sm">
        <div className="w-full opacity-70">
          <TradingViewTicker symbols={forexSymbols} />
        </div>
      </div>

      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-100 bg-white/95 shadow-2xl shadow-neutral-900/12 backdrop-blur-md">
        <div className="border-b border-slate-100 bg-white p-8 text-center">
          <div className="mb-2 inline-flex items-center justify-center gap-2 rounded-full border border-yellow-200 bg-yellow-50 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-neutral-900">
            <Shield size={18} />
            Copy Trade Engine
          </div>
          <h1 className="mt-4 text-3xl font-bold text-slate-800">Create your account</h1>
          <p className="mt-2 text-sm text-slate-500">Sign up with Google to get started</p>
        </div>

        <div className="space-y-6 p-8">
          {errorMessage && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-center text-sm font-medium text-red-600">
              {errorMessage}
            </div>
          )}

          {isSubmitting ? (
            <div className="flex flex-col items-center justify-center gap-3 py-6 text-slate-600">
              <Loader2 className="h-8 w-8 animate-spin text-yellow-700" />
              <p className="text-sm font-medium">Creating your account…</p>
            </div>
          ) : GOOGLE_CLIENT_ID ? (
            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={(resp) => {
                  if (resp.credential) void handleGoogleSignup(resp.credential);
                  else setErrorMessage("Google did not return a signup token.");
                }}
                onError={() => setErrorMessage("Google signup popup failed.")}
                useOneTap={false}
                text="signup_with"
              />
            </div>
          ) : (
            <p className="text-center text-sm text-slate-400">
              Google signup is disabled (missing client ID).
            </p>
          )}

          <p className="text-center text-sm text-slate-500">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="font-semibold text-neutral-900 hover:underline"
            >
              Log in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
