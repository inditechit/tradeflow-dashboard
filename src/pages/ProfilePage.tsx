import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Loader2, ArrowRight, Activity, Wallet, CheckCircle2 } from 'lucide-react';

const experienceOptions = [
  '0 years', '0-1 year', '1-2 years', '2-3 years',
  '3-5 years', '5-7 years', '7-10 years', '10+ years',
];

const depositOptions = ['INR', 'USDT', 'AED'];

const ProfilePage = () => {
  const navigate = useNavigate();
  const { currentUser, updateUser } = useApp();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const experience = currentUser?.experienceYears || '';
  const deposit = currentUser?.depositMethod || '';

  const API_BASE = 'https://mt5api.inditechit.com/api';

  const handleSaveAndProceed = async () => {
    if (!currentUser?.userId) {
      // Fallback if they refreshed the page and lost context, just send them forward
      navigate('/packages');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const response = await fetch(`${API_BASE}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.userId,
          experience: experience,
          depositMethod: deposit
        })
      });

      const data = await response.json();

      if (data.success) {
        navigate('/packages');
      } else {
        setErrorMessage(data.error || 'Failed to save profile.');
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage('Server error. Could not save profile.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-10 bg-slate-50">
      <div className="w-full max-w-3xl rounded-2xl bg-white border border-slate-100 shadow-2xl shadow-cyan-900/5 overflow-hidden flex flex-col">
        
        {/* Header Section */}
        <div className="text-center p-8 pb-6 border-b border-slate-100 bg-white">
          <div className="inline-flex items-center justify-center gap-2 mb-3 px-4 py-2 rounded-full bg-cyan-50 text-cyan-600 border border-cyan-100">
            <Activity size={18} />
            <span className="font-semibold tracking-wide uppercase text-sm">Step 2 of 3</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mt-2">Trading Profile</h1>
          <p className="text-slate-500 text-sm mt-2">Help DWG personalize your trading experience</p>
        </div>

        {/* Global Error Message */}
        {errorMessage && (
          <div className="mx-8 mt-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium text-center">
            {errorMessage}
          </div>
        )}

        {/* Body Section */}
        <div className="p-8 md:p-10 flex-1 space-y-10">
          
          {/* Question 1: Experience */}
          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Activity className="text-cyan-500" size={20} />
              Trading Experience
            </h2>
            <p className="text-sm text-slate-500 mb-4">How many years have you been actively trading?</p>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {experienceOptions.map(opt => {
                const isSelected = experience === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => updateUser({ experienceYears: opt })}
                    className={`relative p-4 rounded-xl border text-sm font-medium transition-all duration-200 flex flex-col items-center justify-center gap-2
                      ${isSelected 
                        ? 'border-cyan-500 bg-cyan-50 text-cyan-700 shadow-sm shadow-cyan-500/10' 
                        : 'border-slate-200 bg-white text-slate-600 hover:border-cyan-200 hover:bg-slate-50'
                      }`}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 text-cyan-500 animate-in zoom-in">
                        <CheckCircle2 size={16} fill="currentColor" className="text-white" />
                      </div>
                    )}
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-px bg-slate-100 w-full"></div>

          {/* Question 2: Deposit Method */}
          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Wallet className="text-cyan-500" size={20} />
              Preferred Funding
            </h2>
            <p className="text-sm text-slate-500 mb-4">What is your primary method of deposit?</p>
            
            <div className="grid grid-cols-3 gap-4">
              {depositOptions.map(opt => {
                const isSelected = deposit === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => updateUser({ depositMethod: opt })}
                    className={`relative p-5 rounded-xl border transition-all duration-200 flex flex-col items-center justify-center gap-2
                      ${isSelected 
                        ? 'border-cyan-500 bg-cyan-50 text-cyan-700 shadow-sm shadow-cyan-500/10' 
                        : 'border-slate-200 bg-white text-slate-600 hover:border-cyan-200 hover:bg-slate-50'
                      }`}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 text-cyan-500 animate-in zoom-in">
                        <CheckCircle2 size={18} fill="currentColor" className="text-white" />
                      </div>
                    )}
                    <span className={`text-base ${isSelected ? 'font-bold' : 'font-semibold'}`}>{opt}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Proceed Button */}
          <div className="pt-6">
            <button
              onClick={handleSaveAndProceed}
              disabled={!experience || !deposit || isSubmitting}
              className="w-full py-4 rounded-xl bg-cyan-600 text-white text-lg font-bold shadow-lg shadow-cyan-600/25 hover:bg-cyan-700 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : null}
              {isSubmitting ? 'Saving Profile...' : 'View Packages'} 
              {!isSubmitting && <ArrowRight size={20} />}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ProfilePage;