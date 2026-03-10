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

  const API_BASE = 'https://mt5api.inditechit.com/api'; // Your live API

  const fetchLocations = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/admin/locations`);
      const data = await response.json();

      // Your backend returns an array of rows directly
      if (Array.isArray(data)) {
        setLocations(data);
      } else {
        setError(data.error || 'Failed to fetch location data.');
      }
    } catch (err) {
      console.error(err);
      setError('Server connection error. Could not fetch locations.');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch on initial load
  useEffect(() => {
    fetchLocations();
  }, []);

  // Format date safely
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', 
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/dashboard')} 
              className="p-3 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-cyan-600 hover:border-cyan-200 hover:bg-cyan-50 transition-all shadow-sm"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                DWG Admin <span className="text-slate-300 font-light">|</span> Location Hub
              </h1>
              <p className="text-slate-500 text-sm mt-0.5">Real-time user geolocation monitoring</p>
            </div>
          </div>

          <button 
            onClick={fetchLocations}
            disabled={isLoading}
            className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-cyan-600 font-bold hover:bg-cyan-50 hover:border-cyan-200 transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
            {isLoading ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>

        {/* Global Error */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 font-medium flex items-center gap-3">
            <AlertTriangle size={20} /> {error}
          </div>
        )}

        {/* Data Table */}
        <div className="bg-white rounded-2xl shadow-xl shadow-cyan-900/5 border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <User size={14} /> Username
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <Globe size={14} className="inline mr-1" /> Coordinates (Lat / Lng)
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <Clock size={14} className="inline mr-1" /> Last Updated
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                
                {isLoading && locations.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      <RefreshCw size={32} className="animate-spin text-cyan-500 mx-auto mb-3" />
                      Loading location data...
                    </td>
                  </tr>
                ) : locations.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      <MapPin size={32} className="text-slate-300 mx-auto mb-3" />
                      No location data found in the database.
                    </td>
                  </tr>
                ) : (
                  locations.map((loc, i) => (
                    <tr key={i} className="hover:bg-cyan-50/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{loc.username}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-mono text-slate-600 bg-slate-50 px-2 py-1 rounded inline-block w-fit mb-1 border border-slate-100">
                            Lat: {parseFloat(loc.latitude).toFixed(6)}
                          </span>
                          <span className="text-sm font-mono text-slate-600 bg-slate-50 px-2 py-1 rounded inline-block w-fit border border-slate-100">
                            Lng: {parseFloat(loc.longitude).toFixed(6)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600 font-medium">
                          {formatDate(loc.last_updated)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <a 
                          href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-cyan-50 text-cyan-600 text-sm font-bold rounded-lg hover:bg-cyan-100 transition-colors opacity-80 group-hover:opacity-100"
                        >
                          View Map <ExternalLink size={14} />
                        </a>
                      </td>
                    </tr>
                  ))
                )}

              </tbody>
            </table>
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default AdminPage;