import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, UserData } from '@/context/AppContext';
import {
  Mail, Camera, Loader2, CheckCircle, Shield,
  User, Phone, Send, Lock, AtSign, Mic, MapPin, ArrowRight, ArrowLeft
} from 'lucide-react';

// Input Field (Kept outside to prevent focus loss)
const InputField = ({ icon: Icon, placeholder, type = "text", value, onChange }: any) => (
  <div className="relative group w-full">
    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-cyan-500 transition-colors">
      <Icon size={18} />
    </div>
    <input
      type={type}
      className="w-full pl-10 pr-4 py-3.5 rounded-xl text-sm bg-white border border-slate-200 text-slate-800 placeholder-slate-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all outline-none shadow-sm"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
    />
  </div>
);

const SignupPage = () => {
  const navigate = useNavigate();
  const { setCurrentUser } = useApp();

  const API_BASE = 'https://mt5api.inditechit.com/api'; // Your backend URL

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: '', mobile: '', telegram: '', username: '', password: '', email: ''
  });

  const [otpState, setOtpState] = useState<'idle' | 'sending' | 'sent' | 'verified'>('idle');
  const [otp, setOtp] = useState('');
  const [permissionsState, setPermissionsState] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');

  // New states for error handling and submission
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrorMessage(''); // Clear errors when user types
  };

  // --- API: 1. Send OTP ---
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

  // --- API: 2. Verify OTP ---
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
    setPermissionsState('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach(track => track.stop());

      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          () => setPermissionsState('granted'),
          () => setPermissionsState('denied')
        );
      } else {
        setPermissionsState('denied');
      }
    } catch (error) {
      setPermissionsState('denied');
    }
  };

  // --- API: 3. Final Signup ---
  const handleProceed = async () => {
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      // Create the payload matching your MySQL database columns
      const payload = {
        ...form,
        photo: 'permissions_granted', // Backend expects photo_data, we send a placeholder since we did device auth
        country: '', // Sending empty strings so the DB doesn't crash on undefined
        state: '',
        city: '',
        pincode: ''
      };

      const response = await fetch(`${API_BASE}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (data.success) {
        // Update context with the new User ID and navigate
        const user: UserData = {
          ...form,
          userId: data.userId, // Storing DB ID
          emailVerified: true,
          photoCaptured: true,
          experienceYears: '',
          depositMethod: '',
        };
        setCurrentUser(user);
        navigate('/profile');
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

  const isStep1Valid = form.name.trim() !== '' && form.mobile.trim() !== '' && form.username.trim() !== '' && form.password.trim() !== '';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-10 bg-slate-50">
      <div className="w-full max-w-3xl rounded-2xl bg-white border border-slate-100 shadow-2xl shadow-cyan-900/5 overflow-hidden flex flex-col">

        {/* Header Section */}
        <div className="text-center p-8 pb-6 border-b border-slate-100 bg-white">
          <div className="inline-flex items-center justify-center gap-3 mb-2 px-4 py-2 rounded-full bg-cyan-50 text-cyan-600 border border-cyan-100">
            <Shield size={20} />
            <span className="font-semibold tracking-wide uppercase text-sm">DWG Secure Setup</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mt-4">Join DWG</h1>
          <p className="text-slate-500 text-sm mt-2">Create your account and verify your device to get started</p>

          <div className="flex items-center justify-center mt-8 max-w-xs mx-auto">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 1 ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-400'}`}>1</div>
            <div className={`flex-1 h-1 mx-2 rounded-full ${step >= 2 ? 'bg-cyan-600' : 'bg-slate-100'}`}></div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 2 ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-400'}`}>2</div>
          </div>
        </div>

        {/* Global Error Message Display */}
        {errorMessage && (
          <div className="mx-8 mt-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium text-center">
            {errorMessage}
          </div>
        )}

        {/* Body Section */}
        <div className="p-8 md:p-10 flex-1 pt-6">
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2 pb-2">
                <User size={22} className="text-cyan-500" /> Account Details
              </h2>

              <div className="grid sm:grid-cols-2 gap-5">
                <InputField icon={User} placeholder="Full Name" value={form.name} onChange={(e: any) => update('name', e.target.value)} />
                <InputField icon={Phone} placeholder="Mobile Number" value={form.mobile} onChange={(e: any) => update('mobile', e.target.value)} />
                <InputField icon={Send} placeholder="Telegram Username (Optional)" value={form.telegram} onChange={(e: any) => update('telegram', e.target.value)} />
                <InputField icon={AtSign} placeholder="Account Username" value={form.username} onChange={(e: any) => update('username', e.target.value)} />
              </div>

              <InputField icon={Lock} type="password" placeholder="Secure Password" value={form.password} onChange={(e: any) => update('password', e.target.value)} />

              <div className="pt-6 flex flex-col gap-4">
                <button
                  onClick={() => setStep(2)}
                  disabled={!isStep1Valid}
                  className="w-full py-4 rounded-xl bg-cyan-600 text-white text-lg font-bold shadow-lg shadow-cyan-600/25 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  Continue to Verification <ArrowRight size={20} />
                </button>

                <div className="text-center text-sm text-slate-500">
                  Already have an account?{" "}
                  <span
                    onClick={() => navigate("/login")}
                    className="text-cyan-600 font-semibold cursor-pointer hover:underline"
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
                <Shield size={22} className="text-cyan-500" /> Verification
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
                    className="px-6 py-3.5 rounded-xl bg-cyan-50 text-cyan-600 text-sm font-semibold hover:bg-cyan-100 transition-colors whitespace-nowrap disabled:opacity-50 flex items-center justify-center gap-2 h-[50px] border border-cyan-100"
                  >
                    {otpState === 'sending' && <Loader2 className="animate-spin" size={18} />}
                    {otpState === 'sending' ? 'Sending...' : otpState === 'sent' ? 'Resend OTP' : otpState === 'verified' ? 'OTP Sent' : 'Get OTP'}
                  </button>
                </div>

                {(otpState === 'sent' || otpState === 'verified') && (
                  <div className="flex flex-col sm:flex-row gap-3 items-center pt-2">
                    <input
                      className="flex-1 w-full px-4 py-3.5 rounded-xl text-sm border border-slate-200 text-center tracking-widest font-mono focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none h-[50px]"
                      placeholder="Enter 6-digit OTP"
                      value={otp}
                      onChange={e => setOtp(e.target.value)}
                      disabled={otpState === 'verified'}
                    />
                    {otpState === 'verified' ? (
                      <div className="w-full sm:w-auto px-6 h-[50px] rounded-xl bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center gap-2 font-medium">
                        <CheckCircle size={18} /> Verified
                      </div>
                    ) : (
                      <button onClick={handleVerifyOtp} className="w-full sm:w-auto px-8 h-[50px] rounded-xl bg-cyan-600 text-white text-sm font-bold hover:bg-cyan-700 shadow-md shadow-cyan-600/20 transition-all">
                        Verify
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className={`p-6 rounded-xl border transition-all duration-300 ${permissionsState === 'granted' ? 'border-teal-200 bg-teal-50/30' : 'border-slate-100 bg-slate-50/50 shadow-sm'}`}>
                <div className="flex items-start gap-4 mb-5">
                  <div className={`p-3 rounded-full flex-shrink-0 ${permissionsState === 'granted' ? 'bg-teal-100 text-teal-600' : 'bg-cyan-100 text-cyan-600'}`}>
                    {permissionsState === 'granted' ? <CheckCircle size={24} /> : <Shield size={24} />}
                  </div>
                  <div>
                    <h3 className="font-medium text-slate-800">System Permissions</h3>
                    <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                      DWG requires access to your camera, microphone, and location to verify your identity.
                    </p>
                  </div>
                </div>

                <button
                  onClick={requestSystemPermissions}

                  disabled={permissionsState === 'requesting' || permissionsState === 'granted'}
                  className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2
                    ${permissionsState === 'granted'
                      ? 'bg-teal-100 text-teal-700 cursor-default'
                      : permissionsState === 'denied'
                        ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                        : 'bg-white border border-cyan-200 text-cyan-700 hover:bg-cyan-50 shadow-sm'}`}
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
                        className="text-cyan-600 font-semibold hover:underline"
                      >
                        Watch How to Enable Permissions
                      </a>
                    </div>
                  )}
                </button>
              </div>

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
                  disabled={otpState !== 'verified' || permissionsState !== 'granted' || isSubmitting}
                  className="flex-1 py-4 rounded-xl bg-cyan-600 text-white text-lg font-bold shadow-lg shadow-cyan-600/25 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : null}
                  {isSubmitting ? 'Creating Account...' : 'Create Account'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SignupPage;