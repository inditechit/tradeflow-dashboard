import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';

const experienceOptions = [
  '0 years', '0-1 year', '1-2 years', '2-3 years',
  '3-5 years', '5-7 years', '7-10 years', 'More than 10 years',
];

const depositOptions = ['INR', 'USDT', 'AED'];

const ProfilePage = () => {
  const navigate = useNavigate();
  const { currentUser, updateUser } = useApp();

  const experience = currentUser?.experienceYears || '';
  const deposit = currentUser?.depositMethod || '';

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glow-box w-full max-w-2xl p-8 md:p-10">
        <h1 className="text-3xl font-heading font-bold text-secondary text-center mb-2">Your Trading Profile</h1>
        <p className="text-muted-foreground text-center text-sm mb-8">Help us personalize your experience</p>

        {/* Question 1 */}
        <div className="mb-8">
          <h2 className="text-lg font-heading text-foreground mb-4">
            How many years have you been working in the Forex market?
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {experienceOptions.map(opt => (
              <button
                key={opt}
                onClick={() => updateUser({ experienceYears: opt })}
                className={`glow-box px-4 py-3 text-sm text-left transition-all flex items-center gap-3 ${
                  experience === opt ? 'border-primary shadow-[var(--glow-cyan-intense)]' : 'hover:bg-primary/5'
                }`}
              >
                <div className={`w-5 h-5 rounded-sm border-2 flex items-center justify-center transition-all ${
                  experience === opt ? 'border-primary bg-primary' : 'border-muted-foreground'
                }`}>
                  {experience === opt && <div className="w-2.5 h-2.5 bg-primary-foreground rounded-sm" />}
                </div>
                <span className={experience === opt ? 'text-primary' : 'text-foreground'}>{opt}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Question 2 */}
        <div className="mb-8">
          <h2 className="text-lg font-heading text-foreground mb-4">
            Method of deposit?
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {depositOptions.map(opt => (
              <button
                key={opt}
                onClick={() => updateUser({ depositMethod: opt })}
                className={`glow-box px-4 py-4 text-center text-sm transition-all ${
                  deposit === opt ? 'border-primary shadow-[var(--glow-cyan-intense)]' : 'hover:bg-primary/5'
                }`}
              >
                <div className={`w-5 h-5 mx-auto mb-2 rounded-sm border-2 flex items-center justify-center transition-all ${
                  deposit === opt ? 'border-primary bg-primary' : 'border-muted-foreground'
                }`}>
                  {deposit === opt && <div className="w-2.5 h-2.5 bg-primary-foreground rounded-sm" />}
                </div>
                <span className={deposit === opt ? 'text-primary font-semibold' : 'text-foreground'}>{opt}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => navigate('/packages')}
          disabled={!experience || !deposit}
          className="btn-gold w-full py-4 rounded-lg text-lg tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
        >
          View Packages
        </button>
      </div>
    </div>
  );
};

export default ProfilePage;
