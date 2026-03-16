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

const LoginPage = () => {
  const navigate = useNavigate();
  const { setCurrentUser } = useApp();

  const API_BASE = "https://mt5api.inditechit.com/api";

  const [form, setForm] = useState({
    username: "",
    password: "",
  });

  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrorMessage("");
  };

  const isValid = form.username.trim() !== "" && form.password.trim() !== "";

  const handleLogin = async () => {
    setErrorMessage("");

    if (!isValid) {
      setErrorMessage("Username and password are required");
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
          username: data.username,
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-100 shadow-2xl shadow-cyan-900/5 overflow-hidden">

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
            placeholder="Username"
            value={form.username}
            onChange={(e: any) => update("username", e.target.value)}
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
    </div>
  );
};

export default LoginPage;