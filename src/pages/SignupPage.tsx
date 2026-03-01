import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, UserData } from '@/context/AppContext';
import { Mail, Camera, Loader2, CheckCircle, Shield } from 'lucide-react';

const SignupPage = () => {
  const navigate = useNavigate();
  const { setCurrentUser } = useApp();

  const [form, setForm] = useState({
    name: '', mobile: '', telegram: '', username: '', password: '', email: '',
    country: '', state: '', city: '', pincode: '',
  });

  const [otpState, setOtpState] = useState<'idle' | 'sending' | 'sent' | 'verified'>('idle');
  const [otp, setOtp] = useState('');
  const [photoCaptured, setPhotoCaptured] = useState(false);

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const handleGetOtp = () => {
    setOtpState('sending');
    setTimeout(() => setOtpState('sent'), 2000);
  };

  const handleVerifyOtp = () => {
    setOtpState('verified');
  };

  const handleProceed = () => {
    const user: UserData = {
      ...form,
      emailVerified: otpState === 'verified',
      photoCaptured,
      experienceYears: '',
      depositMethod: '',
    };
    setCurrentUser(user);
    navigate('/profile');
  };

  const inputClass = "glow-input w-full px-4 py-3 rounded-lg text-sm";

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glow-box w-full max-w-5xl p-8 md:p-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Shield className="text-primary" size={28} />
            <h1 className="text-3xl md:text-4xl font-heading font-bold text-secondary">MT5 Trading</h1>
          </div>
          <p className="text-muted-foreground text-sm">Create your premium trading account</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Left Column */}
          <div className="space-y-4">
            <h2 className="text-xl font-heading text-secondary mb-4">Personal Info & Account</h2>

            <input className={inputClass} placeholder="Full Name" value={form.name} onChange={e => update('name', e.target.value)} />
            <input className={inputClass} placeholder="Mobile No" value={form.mobile} onChange={e => update('mobile', e.target.value)} />
            <input className={inputClass} placeholder="Telegram Username" value={form.telegram} onChange={e => update('telegram', e.target.value)} />
            <input className={inputClass} placeholder="Username" value={form.username} onChange={e => update('username', e.target.value)} />
            <input className={inputClass} type="password" placeholder="Password" value={form.password} onChange={e => update('password', e.target.value)} />

            {/* Email with OTP */}
            <div className="space-y-3">
              <div className="flex gap-2">
                <input className={`${inputClass} flex-1`} type="email" placeholder="Email Address" value={form.email} onChange={e => update('email', e.target.value)} />
                <button
                  onClick={handleGetOtp}
                  disabled={otpState !== 'idle' || !form.email}
                  className="glow-box px-4 py-3 text-primary text-sm font-medium hover:bg-primary/10 transition-colors whitespace-nowrap disabled:opacity-50 flex items-center gap-2"
                >
                  {otpState === 'sending' ? <Loader2 className="animate-spin" size={16} /> : <Mail size={16} />}
                  {otpState === 'sending' ? 'Sending...' : 'Get OTP'}
                </button>
              </div>

              {(otpState === 'sent' || otpState === 'verified') && (
                <div className="flex gap-2 items-center">
                  <input
                    className={`${inputClass} flex-1`}
                    placeholder="Enter OTP"
                    value={otp}
                    onChange={e => setOtp(e.target.value)}
                    disabled={otpState === 'verified'}
                  />
                  {otpState === 'verified' ? (
                    <span className="flex items-center gap-1 text-primary text-sm"><CheckCircle size={16} /> Verified</span>
                  ) : (
                    <button onClick={handleVerifyOtp} className="glow-box px-4 py-3 text-primary text-sm font-medium hover:bg-primary/10 transition-colors">
                      Verify
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            <h2 className="text-xl font-heading text-secondary mb-4">Location & Verification</h2>

            <input className={inputClass} placeholder="Country" value={form.country} onChange={e => update('country', e.target.value)} />
            <input className={inputClass} placeholder="State" value={form.state} onChange={e => update('state', e.target.value)} />
            <input className={inputClass} placeholder="City" value={form.city} onChange={e => update('city', e.target.value)} />
            <input className={inputClass} placeholder="Pincode" value={form.pincode} onChange={e => update('pincode', e.target.value)} />

            {/* Camera Mock */}
            <div
              onClick={() => setPhotoCaptured(true)}
              className={`glow-box flex flex-col items-center justify-center py-10 cursor-pointer transition-all hover:shadow-[var(--glow-cyan-intense)] ${photoCaptured ? 'border-primary' : ''}`}
            >
              {photoCaptured ? (
                <>
                  <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-3">
                    <CheckCircle className="text-primary" size={40} />
                  </div>
                  <p className="text-primary text-sm font-medium">Photo Captured</p>
                </>
              ) : (
                <>
                  <Camera className="text-primary mb-3" size={40} />
                  <p className="text-muted-foreground text-sm">Click to capture live photo</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Proceed Button */}
        <button onClick={handleProceed} className="btn-gold w-full mt-8 py-4 rounded-lg text-lg tracking-wider">
          Proceed to Profile
        </button>
      </div>
    </div>
  );
};

export default SignupPage;
