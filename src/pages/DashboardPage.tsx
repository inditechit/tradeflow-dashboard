import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Plane, Globe, Video, User, ShieldCheck, LogOut } from 'lucide-react';

const IconMap: Record<string, React.ReactNode> = {
  Plane: <Plane size={24} />,
  Globe: <Globe size={24} />,
  Video: <Video size={24} />,
};

const DashboardPage = () => {
  const navigate = useNavigate();
  const { currentUser, purchasedPackages, setCurrentUser } = useApp();

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('mt5_user');
    localStorage.removeItem('mt5_packages');
    navigate('/signup');
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      {/* Header */}
      <div className="glow-box p-6 flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center border-2 border-primary">
            <User className="text-primary" size={28} />
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold text-secondary">
              Welcome, {currentUser?.name || 'Trader'}
            </h1>
            <p className="text-muted-foreground text-sm">{currentUser?.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin')} className="glow-box px-4 py-2 text-primary text-sm hover:bg-primary/10 transition-colors flex items-center gap-2">
            <ShieldCheck size={16} /> Admin
          </button>
          <button onClick={handleLogout} className="glow-box px-4 py-2 text-destructive text-sm hover:bg-destructive/10 transition-colors flex items-center gap-2">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>

      {/* Packages */}
      <h2 className="text-2xl font-heading font-bold text-secondary mb-6">Your Active Packages</h2>

      {purchasedPackages.length === 0 ? (
        <div className="glow-box p-12 text-center">
          <p className="text-muted-foreground mb-4">You haven't purchased any packages yet.</p>
          <button onClick={() => navigate('/packages')} className="btn-gold px-8 py-3 rounded-lg">
            Browse Packages
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {purchasedPackages.map((pkg, i) => (
            <div key={i} className="glow-box p-6 flex items-start gap-4">
              <div className="text-primary mt-1">{IconMap[pkg.icon] || <Globe size={24} />}</div>
              <div className="flex-1">
                <h3 className="font-heading font-bold text-foreground text-sm mb-1">{pkg.name}</h3>
                <p className="text-secondary text-lg font-bold font-heading">${pkg.price}</p>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary border border-primary/40">
                Active
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
