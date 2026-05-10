import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Lock, Mail, Shield, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const API_BASE = "https://mt5api.inditechit.com/api";

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  const sendCode = async () => {
    setError("");
    setInfo("");
    const e = email.trim();
    if (!e) {
      setError("Enter the email you used when signing up.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e }),
      });
      const data = await res.json();
      if (data.success) {
        setInfo(data.message ?? "Check your inbox for the code.");
        setCodeSent(true);
      } else {
        setError(data.error || "Could not send code.");
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSending(false);
    }
  };

  const resetPassword = async () => {
    setError("");
    setInfo("");
    const e = email.trim();
    if (!e || !otp.trim()) {
      setError("Email and code are required.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: e,
          otp: otp.trim(),
          newPassword,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setInfo(data.message ?? "Password updated.");
        navigate("/login", { replace: true });
      } else {
        setError(data.error || "Reset failed.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-slate-200 p-4">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]" />

      <div className="relative z-10 mx-auto w-full max-w-md">
        <Link
          to="/login"
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to login
        </Link>

        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white/95 shadow-2xl shadow-neutral-900/12 backdrop-blur-md">
          <div className="border-b border-slate-100 bg-white p-8 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-yellow-200 bg-yellow-50 px-4 py-2 text-neutral-900">
              <Shield size={20} />
              <span className="text-sm font-semibold uppercase">Reset password</span>
            </div>
            <h1 className="mt-3 text-2xl font-bold text-slate-800">Forgot password</h1>
            <p className="mt-2 text-sm text-slate-500">
              We will email a code to the address on your account. You log in with your Telegram username and
              password.
            </p>
          </div>

          <div className="space-y-5 p-8">
            {error ? (
              <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-center text-sm text-red-600">
                {error}
              </div>
            ) : null}
            {info ? (
              <div className="rounded-xl border border-yellow-100 bg-[#FFF9E6] p-3 text-center text-sm text-neutral-900">
                {info}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="fp-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                <Input
                  id="fp-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  className="h-11 border-slate-200 pl-10"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            {!codeSent ? (
              <Button
                type="button"
                className="h-12 w-full bg-[#FFD700] font-bold text-black hover:bg-[#E6C200]"
                disabled={sending}
                onClick={sendCode}
              >
                {sending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Sending…
                  </>
                ) : (
                  "Send verification code"
                )}
              </Button>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fp-otp">Verification code</Label>
                  <Input
                    id="fp-otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="h-11 border-slate-200 font-mono tracking-widest"
                    placeholder="6-digit code"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fp-new">New password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                    <Input
                      id="fp-new"
                      type="password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="h-11 border-slate-200 pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fp-confirm">Confirm new password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                    <Input
                      id="fp-confirm"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="h-11 border-slate-200 pl-10"
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  className="h-12 w-full bg-[#FFD700] font-bold text-black hover:bg-[#E6C200]"
                  disabled={submitting}
                  onClick={resetPassword}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Updating…
                    </>
                  ) : (
                    "Set new password"
                  )}
                </Button>

                <button
                  type="button"
                  className="w-full text-center text-sm font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
                  onClick={() => {
                    setCodeSent(false);
                    setOtp("");
                    setInfo("");
                    setError("");
                  }}
                >
                  Use a different email
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
