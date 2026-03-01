import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { MapPin, ArrowLeft } from 'lucide-react';

const AdminPage = () => {
  const navigate = useNavigate();
  const { mockLocations } = useApp();

  return (
    <div className="min-h-screen p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/dashboard')} className="glow-box p-3 text-primary hover:bg-primary/10 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-heading font-bold text-secondary flex items-center gap-2">
            <MapPin className="text-primary" size={24} /> Admin — Location Tracking
          </h1>
          <p className="text-muted-foreground text-sm">Real-time user location monitoring</p>
        </div>
      </div>

      {/* Table */}
      <div className="glow-box overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-primary/30">
              <th className="px-6 py-4 text-left text-xs font-semibold text-primary uppercase tracking-wider">Username</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-primary uppercase tracking-wider">Latitude</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-primary uppercase tracking-wider">Longitude</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-primary uppercase tracking-wider">Last Update</th>
            </tr>
          </thead>
          <tbody>
            {mockLocations.map((loc, i) => (
              <tr key={i} className="border-b border-primary/10 hover:bg-primary/5 transition-colors">
                <td className="px-6 py-4 text-sm text-foreground font-medium">{loc.username}</td>
                <td className="px-6 py-4 text-sm text-muted-foreground font-mono">{loc.latitude}</td>
                <td className="px-6 py-4 text-sm text-muted-foreground font-mono">{loc.longitude}</td>
                <td className="px-6 py-4 text-sm text-muted-foreground">{loc.lastUpdate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminPage;
