import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API_BASE = "https://mt5api.inditechit.com/api";

const UserTransactions = () => {
  const { toast } = useToast();

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const userData = JSON.parse(localStorage.getItem("mt5_user"));
  const userId = userData?.userId;

  const fetchPayments = async () => {
    if (!userId) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/user/payments/${userId}`);

      if (!res.ok) {
        throw new Error("API not reachable");
      }

      const data = await res.json();

      console.log("Payments API:", data); // debug

      if (data.success) {
        setPayments(data.data); // ✅ FIXED
      } else {
        setError("Failed to fetch payments");
      }
    } catch (err) {
      console.error(err);
      setError("Server error");

      toast({
        title: "Error ❌",
        description: "Unable to fetch payments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [userId]);
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
    <div className="max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl text-black font-bold">💳 My Transactions</h1>
          <p className="text-slate-500 text-sm">
            View your payment history
          </p>
        </div>

        <button
          onClick={fetchPayments}
          disabled={loading}
          className="px-5 py-2.5 rounded-xl bg-neutral-950 text-[#FFD700] font-bold hover:bg-black transition flex items-center gap-2"
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

      {/* Empty State */}
      {!loading && payments.length === 0 && (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-12">
          <div className="text-center">
            <div className="text-slate-400 text-6xl mb-4">📄</div>
            <p className="text-slate-600 font-medium text-lg">No transaction history found</p>
            <p className="text-slate-400 text-sm mt-2">Your transactions will appear here once you make any payments</p>
          </div>
        </div>
      )}

      {/* Table */}
      {!loading && payments.length > 0 && (
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">

            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="px-6 py-4 text-xs font-bold text-slate-500">Payment ID</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500">Amount</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500">Transaction ID</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500">Method</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500">Package</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500">Date</th>
              </tr>
            </thead>

            <tbody>
              {!loading && payments.map((p) => (
                <tr key={p.id} className="hover:bg-yellow-50/50 transition">

                  {/* ID */}
                  <td className="px-6 py-4 font-bold text-slate-600">
                    {p.id}
                  </td>

                  {/* Amount */}
                  <td className="px-6 py-4 text-sm font-semibold text-green-600">
                    {p.payment_method === "INR"
                      ? `₹${parseFloat(p.amount).toFixed(0)}`
                      : `$${parseFloat(p.amount).toFixed(0)}`}
                  </td>

                  {/* Transaction ID */}
                  <td className="px-6 py-4 text-xs text-slate-600 flex items-center gap-2">
                    <span className="font-mono">
                      {p.tx_hash ? p.tx_hash.slice(0, 10) + "..." : "N/A"}
                    </span>

                    {p.tx_hash && (
                      <button
                        onClick={() => navigator.clipboard.writeText(p.tx_hash)}
                        className="text-neutral-900 hover:text-neutral-900 text-xs"
                        title="Copy full TXN"
                      >
                        Copy
                      </button>
                    )}
                  </td>

                  {/* Method */}
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {p.payment_method}
                  </td>

                  {/* Package */}
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {p.package_name}
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
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-10 text-slate-400">
          Loading transactions...
        </div>
      )}
    </div>
  );
};

export default UserTransactions;