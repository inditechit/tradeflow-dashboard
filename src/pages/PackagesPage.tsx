import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, PurchasedPackage } from '@/context/AppContext';
import { Plane, Globe, Video } from 'lucide-react';

const packages = [
  {
    id: 'india-tour',
    name: '7 DAYS INDIA BUSINESS TOUR',
    price: 500,
    icon: 'Plane',
    description: 'Exclusive guided tour across major Indian financial hubs',
  },
  {
    id: 'intl-tour',
    name: 'INTERNATIONAL 1 MONTH BUSINESS TOUR',
    price: 3000,
    icon: 'Globe',
    description: 'Global forex trading exposure across 5 countries',
  },
  {
    id: 'meet-guru',
    name: 'GOOGLE MEET WITH GURUJI',
    price: 100,
    icon: 'Video',
    description: 'One-on-one mentorship session with trading expert',
  },
];

const IconMap: Record<string, React.ReactNode> = {
  Plane: <Plane size={40} />,
  Globe: <Globe size={40} />,
  Video: <Video size={40} />,
};

const PackagesPage = () => {
  const navigate = useNavigate();
  const { setSelectedPackage } = useApp();

  const handleSelect = (pkg: typeof packages[0]) => {
    const selected: PurchasedPackage = {
      id: pkg.id,
      name: pkg.name,
      price: pkg.price,
      icon: pkg.icon,
      purchasedAt: '',
    };
    setSelectedPackage(selected);
    navigate('/payment');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl md:text-4xl font-heading font-bold text-secondary text-center mb-2">
        Premium Packages
      </h1>
      <p className="text-muted-foreground text-center text-sm mb-10">
        Select a package to elevate your trading journey
      </p>

      <div className="grid md:grid-cols-3 gap-6 w-full max-w-5xl">
        {packages.map(pkg => (
          <button
            key={pkg.id}
            onClick={() => handleSelect(pkg)}
            className="glow-box p-8 text-left transition-all duration-300 hover:scale-105 hover:shadow-[var(--glow-cyan-intense)] group"
          >
            <div className="text-primary mb-5 group-hover:drop-shadow-[0_0_8px_rgba(77,169,167,0.6)] transition-all">
              {IconMap[pkg.icon]}
            </div>
            <h3 className="font-heading text-lg font-bold text-foreground mb-3 leading-tight">{pkg.name}</h3>
            <p className="text-muted-foreground text-sm mb-5">{pkg.description}</p>
            <p className="text-secondary text-3xl font-heading font-bold">${pkg.price.toLocaleString()}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default PackagesPage;
