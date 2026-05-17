import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, PurchasedPackage } from '@/context/AppContext';
import { Calendar, TrendingUp, Shield, Crown, Sparkles, Check } from 'lucide-react';

const packages = [
  {
    id: '1-month',
    name: '1 Month Pack',
    duration: '1 Month',
    originalPrice: 300,
    price: 255,
    icon: Calendar,
    description: 'Begin copy trading with essential tools and a focused portfolio.',
    features: [
      'JACKPOT ROBOT',
      'Mirror up to 2 strategies',
      'Live trade feed',
      'Wallet & transaction history',
      'Email support',
    ],
    popular: false,
  },
  {
    id: '3-month',
    name: '3 Month Pack',
    duration: '3 Months',
    originalPrice: 900,
    price: 666,
    icon: TrendingUp,
    description: 'Scale with more strategies, affiliate access, and priority sync.',
    features: [
      'JACKPOT ROBOT',
      'Mirror up to 5 strategies',
      'Priority trade sync',
      'P/L & trade history',
      'Priority support',
    ],
    popular: false,
  },
  {
    id: '6-month',
    name: '6 Month Pack',
    duration: '6 Months',
    originalPrice: 1800,
    price: 1110,
    icon: Shield,
    description: 'Higher limits, allocation controls, and daily settlement reports.',
    features: [
      'JACKPOT ROBOT',
      'Mirror up to 12 strategies',
      'Advanced allocation',
      'Daily settlement reports',
      'Withdrawal priority',
    ],
    popular: false,
  },
  {
    id: '1-year',
    name: '1 Year Pack',
    subtitle: 'JACKPOT HEDGE PORTFOLIO',
    duration: '12 Months',
    originalPrice: 10800,
    price: 2200,
    icon: Crown,
    description: 'Maximum capacity, custom allocation, and white-glove onboarding.',
    features: [
      'JACKPOT ROBOT',
      'HEDGE ROBOT',
      'PORTFOLIO ROBOT',
      'High accuracy robot',
      'Less drawdown',
      'Profit factor upto 5',
      '24/7 priority support',
    ],
    popular: true,
  },
] as const;

const PackagesPage = () => {
  const navigate = useNavigate();
  const { setSelectedPackage } = useApp();

  const handleSelect = (pkg: typeof packages[0]) => {
    const selected: PurchasedPackage = {
      id: pkg.id,
      name: pkg.name,
      price: pkg.price,
      icon: pkg.icon.name, 
      purchasedAt: '',
    };
    setSelectedPackage(selected);
    navigate('/payment');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 py-12 bg-white">
      
      {/* Header */}
      <div className="text-center mb-12 max-w-2xl">
        <div className="inline-flex items-center justify-center gap-2 mb-4 px-4 py-2 rounded-full bg-[#FFF9E6] text-neutral-900 border border-yellow-200/80">
          <Sparkles size={18} />
          <span className="font-semibold tracking-wide uppercase text-sm">Step 3 of 3</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
          Select Your Premium Plan
        </h1>
        <p className="text-slate-500 text-sm md:text-base">
          Choose a package to elevate your trading journey and gain exclusive market access.
        </p>
      </div>

      {/* Pricing Grid */}
      <div className="grid lg:grid-cols-4 sm:grid-cols-2 gap-6 w-full max-w-7xl items-center">
        {packages.map((pkg) => {
          const Icon = pkg.icon;
          const isPopular = pkg.popular;

          return (
            <div
              key={pkg.id}
              className={`relative bg-white rounded-xl p-6 transition-all duration-300 flex flex-col h-full border
                ${isPopular 
                  ? 'border-2 border-[#FFD700] shadow-lg shadow-yellow-900/10 lg:-translate-y-2' 
                  : 'border-slate-200 shadow-sm hover:border-slate-300 hover:-translate-y-1'
                }`}
            >
              {/* "Most Popular" Badge */}
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#FFD700] text-black px-4 py-0.5 rounded-full text-xs font-bold tracking-wider uppercase whitespace-nowrap shadow-sm">
                  Most Popular
                </div>
              )}

              {/* Flex-1 container to push the button to the bottom */}
              <div className="flex-1">
                {/* Card Header */}
                <div className="mb-6">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 
                    ${isPopular ? 'bg-[#FFD700] text-black shadow-sm' : 'bg-slate-100 text-slate-700'}`}
                  >
                    <Icon size={24} />
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    <h3 className="text-xl font-bold text-slate-900 leading-tight">{pkg.name}</h3>
                    {"subtitle" in pkg && pkg.subtitle && (
                      <span className="w-fit rounded bg-neutral-900 px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-[#FFD700]">
                        {pkg.subtitle}
                      </span>
                    )}
                  </div>
                </div>

                {/* Price */}
                <div className="mb-4 flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-slate-900">${pkg.price}</span>
                  <span className="text-lg font-medium text-slate-400 line-through">${pkg.originalPrice}</span>
                </div>

                <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                  {pkg.description}
                </p>

                {/* Features List */}
                <div className="space-y-2.5 mb-8">
                  {pkg.features.map((feature, idx) => {
                    const isHighlightedFeature = feature.includes("ROBOT");
                    return (
                      <div 
                        key={idx} 
                        className={`flex items-start gap-2 text-sm rounded transition-all ${
                          isHighlightedFeature 
                            ? "text-neutral-900 font-bold bg-yellow-100/70 border border-yellow-300 p-1.5 shadow-sm" 
                            : "text-slate-600"
                        }`}
                      >
                        <Check 
                          className={`mt-0.5 h-4 w-4 shrink-0 ${
                            isHighlightedFeature ? "text-yellow-800" : "text-yellow-700"
                          }`} 
                          strokeWidth={3} 
                        />
                        <span>{feature}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => handleSelect(pkg)}
                className={`w-full py-3 rounded-xl text-sm font-bold transition-all mt-auto
                  ${isPopular 
                    ? 'bg-[#FFD700] text-black hover:bg-[#E6C200]' 
                    : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                  }`}
              >
                Select {pkg.name}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PackagesPage;