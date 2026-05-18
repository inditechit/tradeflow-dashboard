import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, PurchasedPackage } from '@/context/AppContext';
import { Calendar, TrendingUp, Shield, Crown, Sparkles, Check, X, AlertTriangle } from 'lucide-react';

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

const riskProfiles = [
  {
    id: 'LOW',
    title: 'LOW RISK',
    allocation: 'Capital divided into 5 allocation parts',
    exposure: '5% – 10%',
    color: 'bg-green-100 border-green-300 text-green-800'
  },
  {
    id: 'MEDIUM',
    title: 'MEDIUM RISK',
    allocation: 'Capital divided into 4 allocation parts',
    exposure: '10% – 20%',
    color: 'bg-yellow-100 border-yellow-300 text-yellow-800'
  },
  {
    id: 'HIGH',
    title: 'HIGH RISK',
    allocation: 'Capital divided into 3 allocation parts',
    exposure: '20% – 50%',
    color: 'bg-orange-100 border-orange-300 text-orange-800'
  },
  {
    id: 'SUPER_HIGH',
    title: 'SUPER HIGH RISK',
    allocation: 'Capital divided into 2 allocation parts',
    exposure: '20% – 100%',
    color: 'bg-red-100 border-red-300 text-red-800'
  }
];

const PackagesPage = () => {
  const navigate = useNavigate();
  const { setSelectedPackage } = useApp();

  const API_BASE = 'https://api.copytradeengine.org/api';

  // New states for Risk Modal
  const [isRiskModalOpen, setIsRiskModalOpen] = useState(false);
  const [pendingPackage, setPendingPackage] = useState<typeof packages[0] | null>(null);
  const [selectedRisks, setSelectedRisks] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { currentUser } = useApp();

  // console.log("User ID: ", currentUser?.userId);

  const handleSelectPackageClick = (pkg: typeof packages[0]) => {
    setPendingPackage(pkg);
    setIsRiskModalOpen(true);
  };

  const toggleRiskSelection = (riskId: string) => {
    setSelectedRisks((prev) =>
      prev.includes(riskId)
        ? prev.filter(id => id !== riskId)
        : [...prev, riskId]
    );
  };

  const proceedToCheckout = async () => {
    if (selectedRisks.length === 0) {
      alert("Please select at least one risk profile to proceed.");
      return;
    }

    if (!pendingPackage) return;

    setIsSubmitting(true);

    try {
      await fetch(`${API_BASE}/user/${currentUser?.userId}/save-risk-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          risks: selectedRisks
        })
      });

      // Simulating API delay
      await new Promise(resolve => setTimeout(resolve, 800));

      const selected: PurchasedPackage = {
        id: pendingPackage.id,
        name: pendingPackage.name,
        price: pendingPackage.price,
        icon: pendingPackage.icon.name,
        purchasedAt: new Date().toISOString(),
      };

      setSelectedPackage(selected);
      navigate('/payment');

    } catch (error) {
      console.error("Failed to save risk profile:", error);
      alert("Something went wrong saving your risk profile. Please try again.");
    } finally {
      setIsSubmitting(false);
      setIsRiskModalOpen(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 py-12 bg-white relative">

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

                <div className="mb-4 flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-slate-900">${pkg.price}</span>
                  <span className="text-lg font-medium text-slate-400 line-through">${pkg.originalPrice}</span>
                </div>

                <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                  {pkg.description}
                </p>

                <div className="space-y-2.5 mb-8">
                  {pkg.features.map((feature, idx) => {
                    const isHighlightedFeature = feature.includes("ROBOT");
                    return (
                      <div
                        key={idx}
                        className={`flex items-start gap-2 text-sm rounded transition-all ${isHighlightedFeature
                            ? "text-neutral-900 font-bold bg-yellow-100/70 border border-yellow-300 p-1.5 shadow-sm"
                            : "text-slate-600"
                          }`}
                      >
                        <Check
                          className={`mt-0.5 h-4 w-4 shrink-0 ${isHighlightedFeature ? "text-yellow-800" : "text-yellow-700"
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
                onClick={() => handleSelectPackageClick(pkg)}
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

      {/* --- RISK PROFILE MODAL --- */}
      {isRiskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-lg">
                <AlertTriangle className="text-yellow-500" size={24} />
                Choose Your Robot Risk Profile ✅
              </div>
              <button
                onClick={() => setIsRiskModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <p className="text-sm text-slate-500 mb-4">
                Please select one or more risk profiles that match your trading strategy. You can update this later in your profile.
              </p>

              <div className="space-y-3">
                {riskProfiles.map((risk) => {
                  const isSelected = selectedRisks.includes(risk.id);
                  return (
                    <label
                      key={risk.id}
                      className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${isSelected
                          ? 'border-yellow-400 bg-yellow-50/50'
                          : 'border-slate-100 hover:border-slate-300'
                        }`}
                    >
                      <div className="pt-1">
                        <input
                          type="checkbox"
                          className="w-5 h-5 rounded text-[#FFD700] focus:ring-[#FFD700]"
                          checked={isSelected}
                          onChange={() => toggleRiskSelection(risk.id)}
                        />
                      </div>
                      <div className="flex-1">
                        <div className={`inline-block px-2 py-0.5 rounded text-xs font-bold mb-2 border ${risk.color}`}>
                          {risk.title}
                        </div>
                        <p className="text-sm font-semibold text-slate-800 mb-1">{risk.allocation}</p>
                        <p className="text-xs text-slate-500">Estimated Monthly Risk Exposure: <span className="font-semibold text-slate-700">{risk.exposure}</span></p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-slate-100 bg-white flex justify-end gap-3">
              <button
                onClick={() => setIsRiskModalOpen(false)}
                className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={proceedToCheckout}
                disabled={isSubmitting || selectedRisks.length === 0}
                className="px-6 py-2.5 text-sm font-bold bg-[#FFD700] hover:bg-[#E6C200] text-black rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? 'Saving...' : 'Confirm & Proceed'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PackagesPage;