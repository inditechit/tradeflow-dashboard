import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MapPin, ArrowLeft, RefreshCw, User, 
  Globe, Clock, AlertTriangle, ExternalLink 
} from 'lucide-react';

const AdminPage = () => {
  const navigate = useNavigate();
  
  const [locations, setLocations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const API_BASE = 'https://mt5api.inditechit.com/api';

  const fetchLocations = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/admin/users`);
      const data = await response.json();

      if (data.success) {
        setLocations(data.users);
      } else {
        setError(data.error || 'Failed to fetch data.');
      }
    } catch (err) {
      console.error(err);
      setError('Server connection error. Could not fetch data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', 
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <>
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/dashboard')} 
              className="p-3 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-cyan-600 hover:border-cyan-200 hover:bg-cyan-50 transition-all shadow-sm"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">
                Admin Panel
              </h1>
              <p className="text-slate-500 text-sm">
                Manage system data & monitoring
              </p>
            </div>
          </div>

          <button 
            onClick={fetchLocations}
            disabled={isLoading}
            className="px-5 py-2.5 rounded-xl bg-cyan-600 text-white font-bold hover:bg-cyan-700 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 font-medium flex items-center gap-3">
            <AlertTriangle size={20} /> {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-xl shadow-cyan-900/5 border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              
              {/* Header */}
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Username
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Trading
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                    Action
                  </th>
                </tr>
              </thead>

              {/* Body */}
              <tbody className="divide-y divide-slate-100">
                
                {isLoading && locations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      <RefreshCw size={32} className="animate-spin text-cyan-500 mx-auto mb-3" />
                      Loading data...
                    </td>
                  </tr>
                ) : locations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      <MapPin size={32} className="text-slate-300 mx-auto mb-3" />
                      No user data found.
                    </td>
                  </tr>
                ) : (
                  locations.map((loc, i) => (
                    <tr key={i} className="hover:bg-cyan-50/30 transition-colors group">
                      
                      {/* Username */}
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{loc.name}</div>
                        <div className="text-xs text-slate-500">{loc.email}</div>
                      </td>

                      {/* Contact */}
                      <td className="px-6 py-4 text-sm text-slate-600">
                        <div>{loc.mobile}</div>
                        <div className="text-xs text-cyan-600">@{loc.telegram}</div>
                      </td>

                      {/* Trading */}
                      <td className="px-6 py-4 text-sm">
                        <div className="font-medium text-slate-700">{loc.experience}</div>
                        <div className="text-xs text-slate-500">{loc.deposit_method}</div>
                      </td>

                      {/* Coordinates
                      <td className="px-6 py-4">
                        {loc.latitude && loc.longitude ? (
                          <div className="flex flex-col">
                            <span className="text-xs text-black font-mono bg-slate-50 px-2 py-1 rounded border">
                              {parseFloat(loc.latitude).toFixed(4)}
                            </span>
                            <span className="text-xs text-black font-mono bg-slate-50 px-2 py-1 rounded border mt-1">
                              {parseFloat(loc.longitude).toFixed(4)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">No data</span>
                        )}
                      </td> */}

                      {/* Location */}
                      <td className="px-6 py-4 text-xs text-slate-600">
                        <div className="text-slate-400">{loc.address || '-'}</div>
                      </td>

                      {/* Created */}
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {formatDate(loc.created_at)}
                      </td>

                      {/* Action */}
                      <td className="px-6 py-4 text-right">
                        {loc.latitude && loc.longitude && (
                          <a 
                            href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-cyan-50 text-cyan-600 text-sm font-bold rounded-lg hover:bg-cyan-100 transition-colors"
                          >
                            View <ExternalLink size={14} />
                          </a>
                        )}
                      </td>

                    </tr>
                  ))
                )}

              </tbody>
            </table>
          </div>
        </div>

      </div>
    </>
  );
};

export default AdminPage;