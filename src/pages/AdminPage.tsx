import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin, ArrowLeft, RefreshCw, AlertTriangle
} from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

import EditUserModal from '../components/admin/EditUserModal';
import { log } from 'console';

const API_BASE = 'https://mt5api.inditechit.com/api';

const AdminPage = () => {
  const navigate = useNavigate();

  const [locations, setLocations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');


  // NEW STATES 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const { toast } = useToast();

  const fetchLocations = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/admin/users`);
      const data = await response.json();
      console.log(data.users)
      if (data.success) {
        setLocations(data.users);
      } else {
        setError(data.error || 'Failed to fetch data.');
      }
    } catch (err) {
      setError('Server connection error.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleString();
  };


  // update user 
  const handleUpdate = async (updatedUser: any) => {
    try {
      if (!updatedUser?.id) {
        alert("User ID missing ❌");
        return;
      }
      const payload: any = {};

      const allowedFields = [
        "password",
        "email",
        "photo",
        "name",
        "mobile",
        "telegram",
        "country",
        "state",
        "city",
        "pincode",
        "profit_percentage"
      ];

      allowedFields.forEach((field) => {
        if (updatedUser[field] !== undefined) {
          payload[field] = updatedUser[field];
        }
      });

      const res = await fetch(
        `${API_BASE}/admin/update-user/${updatedUser.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();
      console.log("✅ Response:", data);

      if (data.success) {
        setIsModalOpen(false);
        fetchLocations();

        toast({
          title: "User Updated ✅",
          description: "Changes applied successfully",
        });

      } else {
        toast({
          title: "Update Failed ❌",
          description: data.error || "Update failed",
        });
      }

    } catch (err) {
      toast({
        title: "Update Failed ❌",
        description: "Something went wrong",
      });
      console.error("❌ Update Error:", err);

    }
  };
  return (
    <>
      <div className="max-w-7xl mx-auto">

        {/* Header (UNCHANGED) */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Admin Panel
            </h1>
            <p className="text-slate-500 text-sm">
              Manage system data & monitoring
            </p>
          </div>

          <button
            onClick={fetchLocations}
            disabled={isLoading}
            className="px-5 py-2.5 rounded-xl bg-cyan-600 text-white font-bold hover:bg-cyan-700 transition flex items-center gap-2"
          >
            <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600">
            {error}
          </div>
        )}

        {/* TABLE (YOUR ORIGINAL UI PRESERVED) */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">

              <thead>
                <tr className="bg-slate-50 border-b">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500">Username</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500">Contact</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500">Location</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500">Created</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500">Profit %</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 text-right">Action</th>
                </tr>
              </thead>

              <tbody>
                {locations.map((loc, i) => (
                  <tr key={i} className="hover:bg-cyan-50/30 transition">

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

                    {/* Location */}
                    <td className="px-6 py-4">
                      {loc.address ? (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 max-w-xs">
                          <p className="text-xs text-slate-800 leading-relaxed break-words">
                            {loc.address}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">No address</span>
                      )}
                    </td>

                    {/* Created */}
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {formatDate(loc.created_at)}
                    </td>

                    {/* Profit % */}
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {loc.profit_percentage ? `${loc.profit_percentage}%` : "-"}
                    </td>

                    {/* ✅ EDIT BUTTON (ONLY CHANGE) */}
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => {
                          console.log("Selected user:", loc); // ✅ DEBUG
                          setSelectedUser(loc);   // ✅ store user 
                          setIsModalOpen(true);   // ✅ open modal
                        }}
                        className="px-3 py-2 bg-amber-50 text-amber-600 text-sm font-bold rounded-lg hover:bg-amber-100"
                      >
                        Edit
                      </button>
                    </td>

                  </tr>
                ))}
              </tbody>

            </table>
          </div>
        </div>

        {/* ✅ MODAL (ONLY ADDITION) */}
        <EditUserModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          user={selectedUser}
          onUpdate={handleUpdate}
        />

      </div>
    </>
  );
};

export default AdminPage;