import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, PurchasedPackage } from '@/context/AppContext';
import { Plane, Globe, Video, Sparkles, Check } from 'lucide-react';

const packages = [
  {
    id: 'india-tour',
    name: 'India Business Tour',
    duration: '7 Days',
    price: 612,
    icon: Plane,
    description: 'Exclusive guided tour across major Indian financial hubs and trading centers.',
    features: ['Guided financial tour', 'Networking events', 'Local market insights'],
    popular: false,
  },
  {
    id: 'intl-tour',
    name: 'International Tour',
    duration: '1 Month',
    price: 3000,
    
    icon: Globe,
    description: 'Global forex trading exposure across 5 major international countries.',
    features: ['5-country access', 'Global trading floors', 'VIP accommodation'],
    popular: true, // Highlights the middle card
  },
  {
    id: 'meet-guru',
    name: 'Consult with Guruji',
    duration: '1 Session',
    price: 100,
    icon: Video,
    description: 'One-on-one private mentorship session with our lead trading expert.',
    features: ['1-on-1 strategy call', 'Portfolio review', 'Q&A session'],
    popular: false,
  },
];

const PackagesPage = () => {
  const navigate = useNavigate();
  const { setSelectedPackage } = useApp();

  const handleSelect = (pkg: typeof packages[0]) => {
    const selected: PurchasedPackage = {
      id: pkg.id,
      name: pkg.name,
      price: pkg.price,
      icon: pkg.icon.name, // Storing icon name as string for context
      purchasedAt: '',
    };
    setSelectedPackage(selected);
    navigate('/payment');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 py-12 bg-slate-50">
      
      {/* Header */}
      <div className="text-center mb-12 max-w-2xl">
        <div className="inline-flex items-center justify-center gap-2 mb-4 px-4 py-2 rounded-full bg-cyan-50 text-cyan-600 border border-cyan-100">
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
      <div className="grid lg:grid-cols-3 gap-8 w-full max-w-6xl items-center">
        {packages.map((pkg) => {
          const Icon = pkg.icon;
          const isPopular = pkg.popular;

          return (
            <div
              key={pkg.id}
              className={`relative bg-white rounded-3xl p-8 transition-all duration-300 flex flex-col h-full
                ${isPopular 
                  ? 'border-2 border-cyan-500 shadow-xl shadow-cyan-900/10 lg:-translate-y-4' 
                  : 'border border-slate-200 shadow-lg shadow-slate-200/50 hover:border-cyan-300 hover:-translate-y-2 hover:shadow-xl'
                }`}
            >
              {/* "Most Popular" Badge */}
              {isPopular && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-cyan-500 to-teal-400 text-white px-4 py-1 rounded-full text-xs font-bold tracking-wider uppercase shadow-md">
                  Most Popular
                </div>
              )}

              {/* Card Header */}
              <div className="mb-6">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 
                  ${isPopular ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/25' : 'bg-cyan-50 text-cyan-600'}`}
                >
                  <Icon size={28} />
                </div>
                <div className="text-cyan-600 font-semibold text-sm mb-1">{pkg.duration}</div>
                <h3 className="text-2xl font-bold text-slate-800 leading-tight">{pkg.name}</h3>
              </div>

              {/* Price */}
              <div className="mb-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-slate-900">${pkg.price.toLocaleString()}</span>
                <span className="text-slate-500 text-sm font-medium">/ one-time</span>
              </div>

              <p className="text-slate-600 text-sm mb-8 leading-relaxed">
                {pkg.description}
              </p>

              {/* Features List */}
              <div className="flex-1 space-y-3 mb-8">
                {pkg.features.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="mt-0.5 bg-green-100 text-green-600 rounded-full p-0.5">
                      <Check size={14} strokeWidth={3} />
                    </div>
                    <span className="text-slate-600 text-sm">{feature}</span>
                  </div>
                ))}
              </div>

              {/* Action Button */}
              <button
                onClick={() => handleSelect(pkg)}
                className={`w-full py-4 rounded-xl text-base font-bold transition-all mt-auto
                  ${isPopular 
                    ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/25 hover:bg-cyan-700 hover:-translate-y-0.5' 
                    : 'bg-cyan-50 text-cyan-700 hover:bg-cyan-600 hover:text-white'
                  }`}
              >
                Select {pkg.name.split(' ')[0]}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PackagesPage;