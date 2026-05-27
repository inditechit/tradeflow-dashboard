import React, { useState, useEffect, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, UserData } from '@/context/AppContext';
import { GoogleLogin } from "@react-oauth/google";
import {
  Mail, Camera, Loader2, CheckCircle, Shield,
  User, Phone, Send, Lock, AtSign, Mic, MapPin, ArrowRight, ArrowLeft,
  FileText, Home, X as XIcon,
} from 'lucide-react';
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { API_BASE, GOOGLE_CLIENT_ID } from "@/config/api";

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

// Generic document upload row (KYC docs at signup).
// Uses a native file input with capture="environment" so mobile users get the
// back-camera. Desktop users get the file picker. No extra deps.
const DocUploadRow = ({
  label,
  icon,
  value,
  onPick,
  onClear,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onPick: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          {icon}
          {label}
        </div>
        {value && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-slate-500 hover:text-red-600 flex items-center gap-1"
          >
            Remove
          </button>
        )}
      </div>

      {value ? (
        <img
          src={value}
          alt={label}
          className="w-full max-h-48 object-contain rounded-lg bg-white border border-slate-200"
        />
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 flex flex-col items-center justify-center text-center">
          <Camera size={22} className="text-slate-400 mb-2" />
          <p className="text-xs text-slate-500 mb-3">No image yet</p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="px-4 py-2 rounded-lg bg-white border border-yellow-300 text-neutral-800 text-sm font-semibold hover:bg-yellow-50 shadow-sm"
          >
            Take / upload photo
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onPick}
        className="hidden"
      />

      {value && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50"
        >
          Replace
        </button>
      )}
    </div>
  );
};

// Input Field (Kept outside to prevent focus loss)
const InputField = ({ icon: Icon, placeholder, type = "text", value, onChange }: any) => (
  <div className="relative group w-full">
    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-yellow-800 transition-colors">
      <Icon size={18} />
    </div>
    <input
      type={type}
      className="w-full pl-10 pr-4 py-3.5 rounded-xl text-sm bg-white border border-slate-200 text-slate-800 placeholder-slate-400 focus:border-neutral-900 focus:ring-1 focus:ring-yellow-500 transition-all outline-none shadow-sm"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
    />
  </div>
);

const SignupPage = () => {
  const navigate = useNavigate();
  const { setCurrentUser } = useApp();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: '', mobile: '', telegram: '', password: '', email: ''
  });

  const [otpState, setOtpState] = useState<'idle' | 'sending' | 'sent' | 'verified'>('idle');
  const [otp, setOtp] = useState('');
  const [permissionsState, setPermissionsState] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
  const [livePhotoBase64, setLivePhotoBase64] = useState('');
  const [idProofBase64, setIdProofBase64] = useState('');
  const [addressProofBase64, setAddressProofBase64] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);

  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [docsStatus, setDocsStatus] = useState<string>('');

  // Handle URL parsing and cleaning immediately on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refValue = params.get('ref');

    if (refValue) {
      // Secretly save to sessionStorage
      sessionStorage.setItem('referrer_code', refValue);

      // Remove 'ref' from URL without a full page reload
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);

  useEffect(() => {
    return () => {
      liveStream?.getTracks().forEach((t) => t.stop());
    };
  }, [liveStream]);

  // Attach the stream to the <video> element once it is rendered in the DOM.
  // The video tag is mounted only after permissionsState becomes 'granted',
  // so we wait until both the ref and the stream are available.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !liveStream) return;
    if (video.srcObject !== liveStream) {
      video.srcObject = liveStream;
    }
    video.play().catch(() => {});
  }, [liveStream, permissionsState, livePhotoBase64]);

  const update = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrorMessage('');
  };

  const handleGetOtp = async () => {
    setErrorMessage('');
    setOtpState('sending');
    try {
      const response = await fetch(`${API_BASE}/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email })
      });
      const data = await response.json();

      if (data.success) {
        setOtpState('sent');
      } else {
        setErrorMessage(data.error || 'Failed to send OTP.');
        setOtpState('idle');
      }
    } catch (error) {
      console.error(error);
      setErrorMessage('Server error. Is the backend running?');
      setOtpState('idle');
    }
  };

  const handleVerifyOtp = async () => {
    setErrorMessage('');
    try {
      const response = await fetch(`${API_BASE}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, otp })
      });
      const data = await response.json();

      if (data.success) {
        setOtpState('verified');
      } else {
        setErrorMessage(data.error || 'Invalid or expired OTP.');
      }
    } catch (error) {
      console.error(error);
      setErrorMessage('Server error while verifying OTP.');
    }
  };

  const requestSystemPermissions = async () => {
    setErrorMessage('');
    setPermissionsState('requesting');
    try {
      setLiveStream((prev) => {
        prev?.getTracks().forEach((t) => t.stop());
        return null;
      });

      if (!navigator.mediaDevices?.getUserMedia) {
        setErrorMessage('Camera is not available. Please use a modern browser on an HTTPS page.');
        setPermissionsState('denied');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });

      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          () => {
            setLiveStream(stream);
            setPermissionsState('granted');
          },
          () => {
            stream.getTracks().forEach((t) => t.stop());
            setPermissionsState('denied');
          }
        );
      } else {
        stream.getTracks().forEach((t) => t.stop());
        setPermissionsState('denied');
      }
    } catch {
      setPermissionsState('denied');
    }
  };

  const captureLivePhoto = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) {
      setErrorMessage('Camera preview is not ready. Wait a moment or tap Grant again.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    setLivePhotoBase64(dataUrl);
    liveStream?.getTracks().forEach((t) => t.stop());
    setLiveStream(null);
    if (videoRef.current) videoRef.current.srcObject = null;
    setErrorMessage('');
  };

  const retakeLivePhoto = () => {
    setLivePhotoBase64('');
    requestSystemPermissions();
  };

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
    setter: (b64: string) => void,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setErrorMessage('Image is too large. Please pick something under 8 MB.');
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setter(dataUrl);
      setErrorMessage('');
    } catch (err) {
      console.error(err);
      setErrorMessage('Could not read that file. Try a different image.');
    }
  };

  const uploadProofDoc = async (
    userId: number | string,
    field: 'idProofBase64' | 'addressProofBase64',
    base64: string,
  ) => {
    if (!base64) return;
    try {
      await fetch(`${API_BASE}/user/profile/${userId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: base64 }),
      });
    } catch (err) {
      console.error(`upload ${field} failed:`, err);
    }
  };

  const handleProceed = async () => {
    setErrorMessage('');
    setDocsStatus('');
    setIsSubmitting(true);

    const storedRef = sessionStorage.getItem('referrer_code');

    try {
      const payload = {
        ...form,
        photo: livePhotoBase64,
        country: '',
        state: '',
        city: '',
        pincode: '',
        ...(storedRef ? { ref: storedRef } : {}),
      };

      const response = await fetch(`${API_BASE}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (data.success) {
        // Account created. If the user attached extra KYC docs at signup,
        // push them now via the existing /user/profile/:userId/documents
        // endpoint. This is fire-and-forget so signup never blocks on it.
        if (idProofBase64 || addressProofBase64) {
          setDocsStatus('Uploading documents…');
          await Promise.all([
            idProofBase64
              ? uploadProofDoc(data.userId, 'idProofBase64', idProofBase64)
              : Promise.resolve(),
            addressProofBase64
              ? uploadProofDoc(data.userId, 'addressProofBase64', addressProofBase64)
              : Promise.resolve(),
          ]);
        }

        const user: UserData = {
          name: form.name,
          mobile: form.mobile,
          telegram: form.telegram,
          email: form.email,
          userId: String(data.userId),
          role: "user",
          createdAt: new Date().toISOString(),
          emailVerified: true,
          photoCaptured: true,
          experienceYears: "",
          depositMethod: "USDT",
        };
        setCurrentUser(user);
        navigate('/packages');
      } else {
        setErrorMessage(data.error || 'Failed to create account.');
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage('Server error. Could not create account.');
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignup = async (credential: string) => {
    setErrorMessage("");
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        setErrorMessage(data?.error || "Google signup failed.");
        return;
      }
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
      navigate(data.isNewUser ? "/packages" : "/user/dashboard");
    } catch (error) {
      console.error(error);
      setErrorMessage("Google signup failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isStep1Valid = form.name.trim() !== '' && form.mobile.trim() !== '' && form.telegram.trim() !== '' && form.password.trim() !== '';

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 py-10 bg-slate-200 overflow-hidden">
      
      {/* --- CREATIVE BACKGROUND ELEMENTS --- */}

      {/* 1. Subtle Trading Grid */}
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]" />

    {/* --- CLEAN STRAIGHT BACKGROUND STRIPS --- */}

{/* Top Strip (Crypto) */}
<div className="absolute z-0 w-full h-[60px] top-[1.5%] left-0 bg-white/60 border-y border-slate-300/50 backdrop-blur-md flex items-center overflow-hidden pointer-events-none">
  <div className="absolute inset-0 bg-gradient-to-r from-slate-200 via-transparent to-slate-200 z-10" />
  <div className="w-full opacity-90">
    <TradingViewTicker symbols={cryptoSymbols} />
  </div>
</div>

{/* Middle Strip (Indices)
<div className="absolute z-0 w-full h-[60px] top-[50%] left-0 -translate-y-1/2 bg-white/40 border-y border-slate-300/40 backdrop-blur-sm flex items-center overflow-hidden pointer-events-none">
  <div className="absolute inset-0 bg-gradient-to-r from-slate-200 via-transparent to-slate-200 z-10" />
  <div className="w-full opacity-80">
    <TradingViewTicker symbols={indexSymbols} />
  </div>
</div> */}

{/* Bottom Strip (Forex) */}
<div className="absolute z-0 w-full h-[60px] bottom-[1.5%] left-0 bg-white/30 border-y border-slate-300/30 backdrop-blur-sm flex items-center overflow-hidden pointer-events-none">
  <div className="absolute inset-0 bg-gradient-to-r from-slate-200 via-transparent to-slate-200 z-10" />
  <div className="w-full opacity-70">
    <TradingViewTicker symbols={forexSymbols} />
  </div>
</div>

      {/* 3. Floating Graphic Candlesticks */}
      
      {/* Bullish Candle 1 */}
      <div className="absolute z-0 left-[10%] top-[25%] w-6 h-48 animate-float-slow opacity-60">
        <div className="w-1 h-full bg-green-600 mx-auto rounded-full" />
        <div className="absolute top-[20%] w-full h-[50%] bg-green-600 rounded-sm shadow-[0_0_15px_rgba(255,215,0,0.3)]" />
      </div>

      {/* Bearish Candle 1 */}
      <div className="absolute z-0 right-[15%] bottom-[20%] w-8 h-40 animate-float-medium opacity-60">
        <div className="w-1 h-full bg-red-600 mx-auto rounded-full" />
        <div className="absolute top-[40%] w-full h-[40%] bg-red-600 rounded-sm shadow-[0_0_15px_rgba(248,113,113,0.3)]" />
      </div>

      {/* Bullish Candle 2 */}
      <div className="absolute z-0 right-[8%] top-[15%] w-4 h-32 animate-float-fast opacity-60">
        <div className="w-1 h-full bg-green-600 mx-auto rounded-full" />
        <div className="absolute top-[10%] w-full h-[60%] bg-green-600 rounded-sm shadow-[0_0_15px_rgba(34,211,238,0.3)]" />
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
          <div className="inline-flex items-center justify-center gap-3 mb-2 px-4 py-2 rounded-full bg-yellow-50 text-neutral-900 border border-yellow-200">
            <Shield size={20} />
            <span className="font-semibold tracking-wide uppercase text-sm">Copy Trade Engine — Secure setup</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mt-4">Join Copy Trade Engine</h1>
          <p className="text-slate-500 text-sm mt-2">Create your account and verify your device to get started</p>

          <div className="flex items-center justify-center mt-8 max-w-xs mx-auto">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 1 ? 'bg-[#FFD700] text-black' : 'bg-slate-100 text-slate-400'}`}>1</div>
            <div className={`flex-1 h-1 mx-2 rounded-full ${step >= 2 ? 'bg-[#FFD700]' : 'bg-slate-100'}`}></div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 2 ? 'bg-[#FFD700] text-black' : 'bg-slate-100 text-slate-400'}`}>2</div>
          </div>

       <div className="mt-8 text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-600 to-yellow-400 uppercase tracking-widest drop-shadow-sm">
            {step === 1 ? 'SIGNUP' : 'VERIFICATION'}
          </div>
        </div>

        {/* Global Error Message Display */}
        {errorMessage && (
          <div className="mx-8 mt-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium text-center">
            {errorMessage}
          </div>
        )}

        {/* Body Section */}
        <div className="p-8 md:p-10 flex-1 pt-6 bg-white/95 backdrop-blur-md">
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2 pb-2">
                <User size={22} className="text-yellow-800" /> Account Details
              </h2>

              <div className="grid sm:grid-cols-2 gap-5">
                <InputField icon={User} placeholder="Full Name" value={form.name} onChange={(e: any) => update('name', e.target.value)} />
                <div className="w-full">
                  <PhoneInput
                    country={"in"}
                    value={form.mobile}
                    onChange={(value) => update("mobile", value)}
                    inputClass="!w-full !py-3 !pl-14 !rounded-xl !border text-black !border-slate-200 !text-sm"
                    buttonClass="!border-none text-black !bg-transparent"
                    containerClass="w-full"
                  />
                </div>
                <InputField icon={Send} placeholder="Telegram Username" value={form.telegram} onChange={(e: any) => update('telegram', e.target.value)} />
                {/* <InputField icon={AtSign} placeholder="Account Username" value={form.username} onChange={(e: any) => update('username', e.target.value)} /> */}
                 <InputField icon={Lock} type="password" placeholder="Secure Password" value={form.password} onChange={(e: any) => update('password', e.target.value)} />
              </div>

              <div className="pt-6 flex flex-col gap-4">
                <button
                  onClick={() => setStep(2)}
                  disabled={!isStep1Valid}
                  className="w-full py-4 rounded-xl bg-[#FFD700] text-black text-lg font-bold shadow-lg shadow-black/25 hover:bg-[#E6C200] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  Continue to Verification <ArrowRight size={20} />
                </button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-3 text-slate-400">or</span>
                  </div>
                </div>

                {GOOGLE_CLIENT_ID ? (
                  <div className="flex justify-center">
                    <GoogleLogin
                      onSuccess={(resp) => {
                        if (resp.credential) handleGoogleSignup(resp.credential);
                        else setErrorMessage("Google did not return a signup token.");
                      }}
                      onError={() => setErrorMessage("Google signup popup failed.")}
                      useOneTap={false}
                      text="signup_with"
                    />
                  </div>
                ) : (
                  <p className="text-center text-xs text-slate-400">
                    Google signup is disabled (missing client ID).
                  </p>
                )}

                <div className="text-center text-sm text-slate-500">
                  Already have an account?{" "}
                  <span
                    onClick={() => navigate("/login")}
                    className="text-neutral-900 font-semibold cursor-pointer hover:underline"
                  >
                    Login
                  </span>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2 pb-2">
                <Shield size={22} className="text-yellow-800" /> Verification
              </h2>

              <div className="p-6 rounded-xl border border-slate-100 bg-slate-50/50 space-y-4 shadow-sm">
                <h3 className="font-medium text-slate-800 mb-2">Email Verification</h3>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <InputField icon={Mail} type="email" placeholder="Email Address" value={form.email} onChange={(e: any) => update('email', e.target.value)} />
                  </div>
                  <button
                    onClick={handleGetOtp}
                    disabled={otpState === 'sending' || otpState === 'verified' || !form.email}
                    className="px-6 py-3.5 rounded-xl bg-yellow-50 text-neutral-900 text-sm font-semibold hover:bg-yellow-100 transition-colors whitespace-nowrap disabled:opacity-50 flex items-center justify-center gap-2 h-[50px] border border-yellow-200"
                  >
                    {otpState === 'sending' && <Loader2 className="animate-spin" size={18} />}
                    {otpState === 'sending' ? 'Sending...' : otpState === 'sent' ? 'Resend OTP' : otpState === 'verified' ? 'OTP Sent' : 'Get OTP'}
                  </button>
                </div>

                {(otpState === 'sent' || otpState === 'verified') && (
                  <div className="flex flex-col sm:flex-row gap-3 items-center pt-2">
                    <input
                      className="flex-1 w-full px-4 py-3.5 rounded-xl text-sm border border-slate-200 text-center tracking-widest font-mono focus:border-neutral-900 focus:ring-1 focus:ring-yellow-500 outline-none h-[50px]"
                      placeholder="Enter 6-digit OTP"
                      value={otp}
                      onChange={e => setOtp(e.target.value)}
                      disabled={otpState === 'verified'}
                      style={{    color: 'black'}}
                    />
                    {otpState === 'verified' ? (
                      <div className="w-full sm:w-auto px-6 h-[50px] rounded-xl bg-yellow-50 text-neutral-900 border border-yellow-200 flex items-center justify-center gap-2 font-medium">
                        <CheckCircle size={18} /> Verified
                      </div>
                    ) : (
                      <button onClick={handleVerifyOtp} className="w-full sm:w-auto px-8 h-[50px] rounded-xl bg-[#FFD700] text-black text-sm font-bold hover:bg-[#E6C200] shadow-md shadow-black/20 transition-all">
                        Verify
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className={`p-6 rounded-xl border transition-all duration-300 ${permissionsState === 'granted' ? 'border-yellow-300 bg-yellow-50/60' : 'border-slate-100 bg-slate-50/50 shadow-sm'}`}>
                <div className="flex items-start gap-4 mb-5">
                  <div className={`p-3 rounded-full flex-shrink-0 ${permissionsState === 'granted' ? 'bg-yellow-100 text-neutral-900' : 'bg-yellow-100 text-neutral-900'}`}>
                    {permissionsState === 'granted' ? <CheckCircle size={24} /> : <Shield size={24} />}
                  </div>
                  <div>
                    <h3 className="font-medium text-slate-800">System Permissions</h3>
                    <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                      Copy Trade Engine requires access to your camera, microphone, and location to verify your identity.
                    </p>
                  </div>
                </div>

                <button
                  onClick={requestSystemPermissions}

                  disabled={permissionsState === 'requesting' || permissionsState === 'granted'}
                  className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2
                    ${permissionsState === 'granted'
                      ? 'bg-yellow-100 text-neutral-900 cursor-default'
                      : permissionsState === 'denied'
                        ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                        : 'bg-white border border-yellow-300 text-neutral-800 hover:bg-yellow-50 shadow-sm'}`}
                >
                  {permissionsState === 'requesting' && <Loader2 className="animate-spin" size={18} />}
                  {permissionsState === 'idle' && 'Grant Permissions'}
                  {permissionsState === 'requesting' && 'Waiting for approval...'}
                  {permissionsState === 'granted' && 'Permissions Granted'}
                  {permissionsState === 'denied' && 'Access Denied - Try Again'}
                  {permissionsState === 'denied' && (
                    <div className="mt-4 text-center">
                      <p className="text-sm text-red-500 mb-2">
                        Permissions were denied. Watch this video to enable them.
                      </p>

                      <a
                        href="/videos/video.mp4"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neutral-900 font-semibold hover:underline"
                      >
                        Watch How to Enable Permissions
                      </a>
                    </div>
                  )}
                </button>
              </div>

              {permissionsState === 'granted' && (
                <div className="p-6 rounded-xl border border-yellow-200 bg-yellow-50/40 space-y-4 shadow-sm">
                  <h3 className="font-medium text-slate-800 flex items-center gap-2">
                    <Camera size={18} className="text-neutral-900" />
                    Live photo (required)
                  </h3>
                  <p className="text-sm text-slate-500">
                    Position your face in the frame, then capture. This is stored with your registration.
                  </p>
                  {!livePhotoBase64 ? (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full max-h-72 rounded-xl bg-black object-cover border border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={captureLivePhoto}
                        className="w-full py-3.5 rounded-xl bg-[#FFD700] text-black text-sm font-bold hover:bg-[#E6C200] shadow-md"
                      >
                        Capture photo
                      </button>
                    </>
                  ) : (
                    <>
                      <img
                        src={livePhotoBase64}
                        alt="Your capture"
                        className="w-full max-h-72 rounded-xl object-contain border border-slate-200 bg-white"
                      />
                      <button
                        type="button"
                        onClick={retakeLivePhoto}
                        className="w-full py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50"
                      >
                        Retake photo
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Optional KYC documents – uploaded after signup via the existing documents endpoint */}
              {permissionsState === 'granted' && livePhotoBase64 && (
                <div className="p-6 rounded-xl border border-slate-200 bg-white space-y-5 shadow-sm">
                  <div>
                    <h3 className="font-medium text-slate-800 flex items-center gap-2">
                      <FileText size={18} className="text-neutral-900" />
                      KYC documents <span className="text-xs font-normal text-slate-400">(optional — finish in profile later)</span>
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Add a photo of your government ID and an address proof now to speed up KYC. You can also add them later from your profile.
                    </p>
                  </div>

                  <DocUploadRow
                    label="ID proof"
                    icon={<FileText size={16} className="text-yellow-800" />}
                    value={idProofBase64}
                    onPick={(e) => handleFileChange(e, setIdProofBase64)}
                    onClear={() => setIdProofBase64('')}
                  />

                  <DocUploadRow
                    label="Address proof"
                    icon={<Home size={16} className="text-yellow-800" />}
                    value={addressProofBase64}
                    onPick={(e) => handleFileChange(e, setAddressProofBase64)}
                    onClear={() => setAddressProofBase64('')}
                  />
                </div>
              )}

              {docsStatus && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 flex items-center gap-2">
                  <Loader2 className="animate-spin h-4 w-4 text-yellow-700" />
                  {docsStatus}
                </div>
              )}

              <div className="pt-4 flex gap-4">
                <button
                  onClick={() => setStep(1)}
                  disabled={isSubmitting}
                  className="px-6 py-4 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <ArrowLeft size={20} /> Back
                </button>
                <button
                  onClick={handleProceed}
                  disabled={
                    otpState !== 'verified' ||
                    permissionsState !== 'granted' ||
                    !livePhotoBase64 ||
                    isSubmitting
                  }
                  className="flex-1 py-4 rounded-xl bg-[#FFD700] text-black text-lg font-bold shadow-lg shadow-black/25 hover:bg-[#E6C200] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : null}
                  {isSubmitting ? 'Creating Account...' : 'Create Account'}
                </button>
              </div>
            </div>
          )}
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

export default SignupPage;