import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { 
  Plane, Globe, Video, User, ShieldCheck, LogOut, 
  Loader2, CheckCircle2, Clock, Plus 
} from 'lucide-react';

// Helper to assign icons based on the package name saved in the DB
const getPackageIcon = (name: string) => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('india')) return <Plane size={24} />;
  if (lowerName.includes('international')) return <Globe size={24} />;
  return <Video size={24} />;
};

const DashboardPage = () => {
  const navigate = useNavigate();
  const { currentUser, setCurrentUser } = useApp();
  
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const API_BASE = 'https://mt5api.inditechit.com/api';

  useEffect(() => {
    // If no user is logged in, kick them back to signup
    if (!currentUser?.userId) {
      navigate('/signup');
      return;
    }

    const fetchTransactions = async () => {
      try {
        const response = await fetch(`${API_BASE}/transactions/${currentUser.userId}`);
        const data = await response.json();

        if (data.success) {
          setTransactions(data.data);
        } else {
          setError('Failed to load your packages.');
        }
      } catch (err) {
        setError('Server connection error.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransactions();
  }, [currentUser, navigate]);

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('mt5_user');
    localStorage.removeItem('mt5_packages'); // Keeping this just to clean up old data
    navigate('/signup');
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Profile Card */}
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-xl shadow-cyan-900/5 border border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-cyan-50 flex items-center justify-center border border-cyan-100 text-cyan-600">
              <User size={32} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">
                Welcome back, {currentUser?.name || 'Trader'}
              </h1>
              <p className="text-slate-500 text-sm mt-1">{currentUser?.email || 'No email provided'}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button 
              onClick={() => navigate('/admin')} 
              className="flex-1 md:flex-none px-5 py-2.5 bg-slate-50 text-slate-600 rounded-xl border border-slate-200 hover:bg-slate-100 hover:text-slate-800 transition-colors flex items-center justify-center gap-2 font-medium text-sm"
            >
              <ShieldCheck size={18} /> Admin
            </button>
            <button 
              onClick={handleLogout} 
              className="flex-1 md:flex-none px-5 py-2.5 bg-red-50 text-red-600 rounded-xl border border-red-100 hover:bg-red-100 transition-colors flex items-center justify-center gap-2 font-medium text-sm"
            >
              <LogOut size={18} /> Logout
            </button>
          </div>
        </div>

        {/* Packages Section */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-800">Your Active Packages</h2>
            <button 
              onClick={() => navigate('/packages')}
              className="text-cyan-600 text-sm font-bold hover:text-cyan-700 flex items-center gap-1"
            >
              <Plus size={16} /> Add New
            </button>
          </div>

          {isLoading ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 shadow-sm flex flex-col items-center justify-center">
              <Loader2 className="animate-spin text-cyan-500 mb-4" size={32} />
              <p className="text-slate-500 font-medium">Loading your portfolio...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-600 p-6 rounded-2xl border border-red-100 text-center font-medium">
              {error}
            </div>
          ) : transactions.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 shadow-sm">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                <Globe size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">No Packages Yet</h3>
              <p className="text-slate-500 mb-6 max-w-sm mx-auto">You haven't purchased any trading packages yet. Elevate your journey today.</p>
              <button 
                onClick={() => navigate('/packages')} 
                className="px-8 py-3.5 bg-cyan-600 text-white rounded-xl font-bold shadow-lg shadow-cyan-600/20 hover:bg-cyan-700 transition-all hover:-translate-y-0.5"
              >
                Browse Packages
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {transactions.map((txn, i) => (
                <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                  {/* Decorative accent line */}
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 to-teal-400 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-cyan-50 text-cyan-600 rounded-xl flex items-center justify-center border border-cyan-100">
                      {getPackageIcon(txn.package_name)}
                    </div>
                    {txn.status === 'verified' ? (
                      <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-green-50 text-green-600 border border-green-200">
                        <CheckCircle2 size={14} /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                        <Clock size={14} /> Pending
                      </span>
                    )}
                  </div>
                  
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg mb-1 leading-tight">{txn.package_name}</h3>
                    <p className="text-slate-400 text-xs font-mono mb-4">TXN: {txn.transaction_ref}</p>
                    <div className="flex items-end justify-between mt-auto">
                      <p className="text-3xl font-extrabold text-slate-900">${txn.amount}</p>
                      <p className="text-xs text-slate-500 font-medium uppercase">{txn.payment_method}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;