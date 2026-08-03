import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  FileText,
  Home,
  Loader2,
  Mail,
  Shield,
  User,
  Phone,
  Send,
  Lock,
  CheckCircle2,
} from "lucide-react";
import { useApp, UserData } from "@/context/AppContext";
import { API_BASE, GOOGLE_CLIENT_ID } from "@/config/api";
import { getDeviceFingerprint } from "@/utils/deviceFingerprint";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { LiveCameraCaptureDialog } from "@/components/profile/LiveCameraCaptureDialog";
import {
  clearSignupDraft,
  loadSignupDraft,
  nextStep,
  prevStep,
  saveSignupDraft,
  type ManualSignupStep,
  type SignupDraftForm,
} from "@/utils/signupDraftStorage";

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

const STEP_COPY: Record<
  ManualSignupStep,
  { title: string; hint: string; Icon: typeof User }
> = {
  name: { title: "What is your name?", hint: "Enter your full legal name", Icon: User },
  mobile: { title: "Your mobile number", hint: "We use this for account security", Icon: Phone },
  telegram: { title: "Telegram username", hint: "Without @ — used for support alerts", Icon: Send },
  email: { title: "Your email", hint: "We will send a one-time code", Icon: Mail },
  otp: { title: "Verify your email", hint: "Enter the 6-digit code we sent", Icon: Mail },
  password: { title: "Create a password", hint: "At least 6 characters", Icon: Lock },
  images: {
    title: "Identity photos",
    hint: "Live selfie is required. ID & address proof help speed up KYC.",
    Icon: Camera,
  },
};

function DocUploadRow({
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
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          {icon}
          {label}
        </div>
        {value ? (
          <button type="button" onClick={onClear} className="text-xs text-slate-500 hover:text-red-600">
            Remove
          </button>
        ) : null}
      </div>
      {value ? (
        <img
          src={value}
          alt={label}
          className="max-h-40 w-full rounded-lg border border-slate-200 bg-white object-contain"
        />
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-5 text-center"
        >
          <Camera size={20} className="mb-2 text-slate-400" />
          <span className="text-sm font-semibold text-neutral-800">Take / upload photo</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={onPick} className="hidden" />
    </div>
  );
}

export default function SignupPage() {
  const navigate = useNavigate();
  const { setCurrentUser } = useApp();

  const draft = useMemo(() => loadSignupDraft(), []);
  const [step, setStep] = useState<ManualSignupStep>(draft?.step || "name");
  const [form, setForm] = useState<SignupDraftForm>(
    draft?.form || { name: "", mobile: "", telegram: "", email: "", password: "" },
  );
  const [emailVerified, setEmailVerified] = useState(Boolean(draft?.emailVerified));
  const [otp, setOtp] = useState("");
  const [otpState, setOtpState] = useState<"idle" | "sending" | "sent" | "verified">(
    draft?.emailVerified ? "verified" : "idle",
  );
  const [livePhoto, setLivePhoto] = useState("");
  const [idProof, setIdProof] = useState("");
  const [addressProof, setAddressProof] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [acceptedLegal, setAcceptedLegal] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refValue = params.get("r") || params.get("ref");
    if (refValue) {
      sessionStorage.setItem("referrer_key", refValue);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    saveSignupDraft({ mode: "manual", step, form, emailVerified });
  }, [step, form, emailVerified]);

  const update = useCallback((key: keyof SignupDraftForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrorMessage("");
  }, []);

  const handleGoogleSignup = async (credential: string) => {
    setErrorMessage("");
    setGoogleBusy(true);
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
      clearSignupDraft();
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
      setGoogleBusy(false);
    }
  };

  const sendOtp = async () => {
    const email = form.email.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setErrorMessage("Enter a valid email address.");
      return;
    }
    setErrorMessage("");
    setOtpState("sending");
    try {
      const res = await fetch(`${API_BASE}/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!data.success) {
        setErrorMessage(data.error || "Failed to send OTP.");
        setOtpState("idle");
        return;
      }
      setOtpState("sent");
    } catch {
      setErrorMessage("Could not send OTP. Check your connection.");
      setOtpState("idle");
    }
  };

  const verifyOtp = async () => {
    setErrorMessage("");
    try {
      const res = await fetch(`${API_BASE}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email.trim().toLowerCase(), otp: otp.trim() }),
      });
      const data = await res.json();
      if (!data.success) {
        setErrorMessage(data.error || "Invalid or expired code.");
        return;
      }
      setOtpState("verified");
      setEmailVerified(true);
      const n = nextStep("otp");
      if (n) setStep(n);
    } catch {
      setErrorMessage("Could not verify OTP.");
    }
  };

  const validateCurrent = (): boolean => {
    setErrorMessage("");
    if (step === "name" && form.name.trim().length < 2) {
      setErrorMessage("Enter your full name.");
      return false;
    }
    if (step === "mobile" && form.mobile.replace(/\D/g, "").length < 8) {
      setErrorMessage("Enter a valid mobile number.");
      return false;
    }
    if (step === "telegram" && form.telegram.trim().length < 3) {
      setErrorMessage("Enter your Telegram username.");
      return false;
    }
    if (step === "email") {
      const email = form.email.trim().toLowerCase();
      if (!email.includes("@") || !email.includes(".")) {
        setErrorMessage("Enter a valid email.");
        return false;
      }
    }
    if (step === "otp" && otpState !== "verified") {
      setErrorMessage("Verify the email code to continue.");
      return false;
    }
    if (step === "password" && form.password.trim().length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return false;
    }
    if (step === "images") {
      if (!livePhoto || livePhoto.length < 500) {
        setErrorMessage("Live selfie is required.");
        return false;
      }
      if (!acceptedLegal) {
        setErrorMessage("Please accept the Terms and Privacy Policy.");
        return false;
      }
    }
    return true;
  };

  const goNext = async () => {
    if (!validateCurrent()) return;
    if (step === "email") {
      await sendOtp();
      const n = nextStep(step);
      if (n) setStep(n);
      return;
    }
    if (step === "images") {
      await submitSignup();
      return;
    }
    const n = nextStep(step);
    if (n) setStep(n);
  };

  const goBack = () => {
    setErrorMessage("");
    const p = prevStep(step);
    if (p) setStep(p);
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("read failed"));
      reader.readAsDataURL(file);
    });

  const handleFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (v: string) => void,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setter(await readFileAsDataUrl(file));
      setErrorMessage("");
    } catch {
      setErrorMessage("Could not read that image.");
    }
  };

  const submitSignup = async () => {
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const storedRef = sessionStorage.getItem("referrer_key");
      const deviceFingerprint = await getDeviceFingerprint();
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        mobile: form.mobile.trim(),
        telegram: form.telegram.trim().replace(/^@/, ""),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        photo: livePhoto,
        deviceFingerprint,
        ...(storedRef ? { ref_key: storedRef } : {}),
      };
      const res = await fetch(`${API_BASE}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setErrorMessage(data?.error || "Signup failed.");
        return;
      }
      const userId = String(data.userId);
      if (idProof || addressProof) {
        try {
          await fetch(`${API_BASE}/user/profile/${userId}/documents`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...(idProof ? { idProofBase64: idProof } : {}),
              ...(addressProof ? { addressProofBase64: addressProof } : {}),
            }),
          });
        } catch {
          /* optional KYC docs */
        }
      }
      sessionStorage.removeItem("referrer_key");
      clearSignupDraft();
      const user: UserData = {
        name: form.name.trim(),
        mobile: form.mobile.trim(),
        telegram: form.telegram.trim().replace(/^@/, ""),
        email: form.email.trim().toLowerCase(),
        userId,
        role: "user",
        createdAt: new Date().toISOString(),
        emailVerified: true,
        photoCaptured: true,
        experienceYears: "",
        depositMethod: "USDT",
      };
      setCurrentUser(user);
      navigate("/packages");
    } catch {
      setErrorMessage("Signup failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const copy = STEP_COPY[step];
  const StepIcon = copy.Icon;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-200 p-4 py-10">
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]" />
      <div className="pointer-events-none absolute top-[1.5%] z-0 flex h-[60px] w-full items-center overflow-hidden border-y border-slate-300/50 bg-white/60 backdrop-blur-md">
        <TradingViewTicker symbols={cryptoSymbols} />
      </div>
      <div className="pointer-events-none absolute bottom-[1.5%] z-0 flex h-[60px] w-full items-center overflow-hidden border-y border-slate-300/30 bg-white/30 backdrop-blur-sm">
        <TradingViewTicker symbols={forexSymbols} />
      </div>

      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-100 bg-white/95 shadow-2xl shadow-neutral-900/12 backdrop-blur-md">
        <div className="border-b border-slate-100 bg-white p-6 text-center sm:p-8">
          <div className="mb-2 inline-flex items-center justify-center gap-2 rounded-full border border-yellow-200 bg-yellow-50 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-neutral-900">
            <Shield size={18} />
            Copy Trade Engine
          </div>
          <h1 className="mt-3 text-2xl font-bold text-slate-800 sm:text-3xl">Create your account</h1>
          <p className="mt-2 text-sm text-slate-500">{copy.title}</p>
        </div>

        <div className="space-y-5 p-6 sm:p-8">
          {errorMessage ? (
            <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-center text-sm font-medium text-red-600">
              {errorMessage}
            </div>
          ) : null}

          {googleBusy ? (
            <div className="flex flex-col items-center gap-3 py-6 text-slate-600">
              <Loader2 className="h-8 w-8 animate-spin text-yellow-700" />
              <p className="text-sm font-medium">Creating your account…</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-50 text-neutral-900 ring-1 ring-yellow-200">
                  <StepIcon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900">{copy.title}</h2>
                  <p className="mt-0.5 text-xs text-slate-500">{copy.hint}</p>
                </div>
              </div>

              {step === "name" ? (
                <input
                  autoFocus
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-800 outline-none focus:border-neutral-900 focus:ring-1 focus:ring-yellow-500"
                  placeholder="Full name"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void goNext()}
                />
              ) : null}

              {step === "mobile" ? (
                <PhoneInput
                  country="in"
                  value={form.mobile}
                  onChange={(v) => update("mobile", v)}
                  inputClass="!w-full !h-12 !rounded-xl !text-sm"
                  containerClass="!w-full"
                  buttonClass="!rounded-l-xl"
                />
              ) : null}

              {step === "telegram" ? (
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">@</span>
                  <input
                    autoFocus
                    className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-8 pr-4 text-sm text-slate-800 outline-none focus:border-neutral-900 focus:ring-1 focus:ring-yellow-500"
                    placeholder="telegram_username"
                    value={form.telegram}
                    onChange={(e) => update("telegram", e.target.value.replace(/^@/, ""))}
                    onKeyDown={(e) => e.key === "Enter" && void goNext()}
                  />
                </div>
              ) : null}

              {step === "email" ? (
                <input
                  autoFocus
                  type="email"
                  autoComplete="email"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-800 outline-none focus:border-neutral-900 focus:ring-1 focus:ring-yellow-500"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => {
                    update("email", e.target.value);
                    setEmailVerified(false);
                    setOtpState("idle");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && void goNext()}
                />
              ) : null}

              {step === "otp" ? (
                <div className="space-y-3">
                  <input
                    autoFocus
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-center font-mono text-lg tracking-[0.35em] text-slate-800 outline-none focus:border-neutral-900 focus:ring-1 focus:ring-yellow-500"
                    placeholder="••••••"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-slate-200"
                      disabled={otpState === "sending"}
                      onClick={() => void sendOtp()}
                    >
                      {otpState === "sending" ? "Sending…" : otpState === "sent" ? "Resend code" : "Send code"}
                    </Button>
                    <Button
                      type="button"
                      className="bg-[#FFD700] font-semibold text-black hover:bg-[#E6C200]"
                      onClick={() => void verifyOtp()}
                    >
                      Verify code
                    </Button>
                  </div>
                  {otpState === "verified" ? (
                    <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" /> Email verified
                    </p>
                  ) : null}
                </div>
              ) : null}

              {step === "password" ? (
                <PasswordInput
                  autoFocus
                  autoComplete="new-password"
                  className="h-12 rounded-xl border-slate-200"
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void goNext()}
                />
              ) : null}

              {step === "images" ? (
                <div className="space-y-4">
                  <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <p className="text-sm font-semibold text-slate-800">Live selfie (required)</p>
                    {livePhoto ? (
                      <img
                        src={livePhoto}
                        alt="Live selfie"
                        className="max-h-48 w-full rounded-lg border border-slate-200 object-contain"
                      />
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full border-yellow-300"
                        onClick={() => setCameraOpen(true)}
                      >
                        <Camera className="mr-2 h-4 w-4" />
                        Open camera
                      </Button>
                    )}
                    {livePhoto ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setLivePhoto("")}>
                        Retake
                      </Button>
                    ) : null}
                  </div>
                  <DocUploadRow
                    label="ID proof (optional)"
                    icon={<FileText className="h-4 w-4" />}
                    value={idProof}
                    onPick={(e) => void handleFile(e, setIdProof)}
                    onClear={() => setIdProof("")}
                  />
                  <DocUploadRow
                    label="Address proof (optional)"
                    icon={<Home className="h-4 w-4" />}
                    value={addressProof}
                    onPick={(e) => void handleFile(e, setAddressProof)}
                    onClear={() => setAddressProof("")}
                  />
                  <label className="flex items-start gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={acceptedLegal}
                      onChange={(e) => setAcceptedLegal(e.target.checked)}
                    />
                    <span>
                      I agree to the{" "}
                      <a href="/terms" target="_blank" rel="noreferrer" className="font-semibold underline">
                        Terms
                      </a>{" "}
                      and{" "}
                      <a href="/privacy-policy" target="_blank" rel="noreferrer" className="font-semibold underline">
                        Privacy Policy
                      </a>
                      .
                    </span>
                  </label>
                </div>
              ) : null}

              <div className="flex gap-2 pt-1">
                {step !== "name" ? (
                  <Button type="button" variant="outline" className="border-slate-200" onClick={goBack}>
                    <ArrowLeft className="mr-1 h-4 w-4" />
                    Back
                  </Button>
                ) : null}
                {step !== "otp" ? (
                  <Button
                    type="button"
                    className="flex-1 bg-[#FFD700] font-bold text-black hover:bg-[#E6C200]"
                    disabled={isSubmitting}
                    onClick={() => void goNext()}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…
                      </>
                    ) : step === "images" ? (
                      <>
                        Create account <ArrowRight className="ml-1 h-4 w-4" />
                      </>
                    ) : (
                      <>
                        Continue <ArrowRight className="ml-1 h-4 w-4" />
                      </>
                    )}
                  </Button>
                ) : null}
              </div>

              {step === "name" && GOOGLE_CLIENT_ID ? (
                <div className="space-y-3 pt-2">
                  <div className="relative py-1 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <span className="relative z-10 bg-white px-3">or</span>
                    <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-slate-100" />
                  </div>
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
                </div>
              ) : null}
            </div>
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

      <LiveCameraCaptureDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        facingMode="user"
        title="Live selfie"
        onCaptured={(dataUrl) => {
          setLivePhoto(dataUrl);
          setCameraOpen(false);
          setErrorMessage("");
        }}
      />
    </div>
  );
}
