import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API_BASE = "https://mt5api.inditechit.com/api";

const Transactions = () => {
  const { toast } = useToast();

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchPayments = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/admin/payments`);
      const data = await res.json();

      if (data.success) {
        setPayments(data.payments);
      } else {
        setError("Failed to fetch payments");
      }
    } catch (err) {
      setError("Server error");

      toast({
        title: "Error ❌",
        description: "Unable to fetch transactions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const formatDate = (date) => {
    return new Date(date).toLocaleString();
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case "pending":
        return "bg-yellow-50 text-yellow-600 border-yellow-200";
      case "success":
        return "bg-green-50 text-green-600 border-green-200";
      case "failed":
        return "bg-red-50 text-red-600 border-red-200";
      default:
        return "bg-slate-50 text-slate-600 border-slate-200";
    }
  };

  return (
    <div className="max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
             <h1 className="text-2xl text-black font-bold">💳 Transactions</h1>
          <p className="text-slate-500 text-sm">
            Monitor all payment activities
          </p>
        </div>

        <button
          onClick={fetchPayments}
          disabled={loading}
          className="px-5 py-2.5 rounded-xl bg-cyan-600 text-white font-bold hover:bg-cyan-700 transition flex items-center gap-2"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">

            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="px-6 py-4 text-xs font-bold text-slate-500">Payment ID</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500">User</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500">Email</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500">Amount</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500">Method</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500">Package</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500">Created</th>
              </tr>
            </thead>

            <tbody>
              {!loading && payments.map((p) => (
                <tr key={p.id} className="hover:bg-cyan-50/30 transition">

                  {/* Payment ID */}
                  <td className="px-6 py-4 font-bold text-slate-600">
                    {p.id}
                  </td>

                  {/* User */}
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-600">{p.name}</div>
                  </td>

                  {/* Email */}
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {p.email}
                  </td>

                  {/* Amount */}
                  <td className="px-6 py-4 text-sm font-semibold text-green-600">
                    ${parseFloat(p.amount).toFixed(2)}
                  </td>

                  {/* Method */}
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {p.payment_method}
                  </td>

                  {/* Package */}
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {p.package_id}
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1 text-xs rounded-lg border ${getStatusStyle(p.status)}`}
                    >
                      {p.status}
                    </span>
                  </td>

                  {/* Date */}
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {formatDate(p.created_at)}
                  </td>

                </tr>
              ))}
            </tbody>

          </table>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-10 text-slate-400">
          Loading transactions...
        </div>
      )}
    </div>
  );
};

export default Transactions;