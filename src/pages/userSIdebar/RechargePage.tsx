import React, { useState } from "react";
import axios from "axios";

const Recharge = () => {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("INR");
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState(null);

  const userId = localStorage.getItem("userId");
  const API_BASE = 'https://mt5api.inditechit.com/api';

  const handleRecharge = async () => {
    if (!amount) return alert("Enter amount");

    if (method === "INR" && Number(amount) < 1000) {
      return alert("Minimum ₹1000 required");
    }

    if (method === "USDT" && Number(amount) < 10) {
      return alert("Minimum 10 USDT required");
    }

    try {
      setLoading(true);

      const res = await axios.post(`${API_BASE}/recharge`, {
        userId,
        amount: Number(amount),
        payment_method: method
      });

      setPaymentData(res.data);
    } catch (err) {
      alert(err.response?.data?.error || "Error");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-white p-8 text-black">
      
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Recharge Wallet</h1>
        <p className="text-gray-600 text-sm">
          Add funds securely to your trading wallet
        </p>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* LEFT SIDE - FORM */}
        <div className="border rounded-xl p-6 shadow-sm">
          
          {/* Amount */}
          <div className="mb-6">
            <label className="block font-medium mb-2">
              Enter Amount
            </label>
            <input
              type="number"
              className="w-full border rounded-lg p-4 text-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          {/* Payment Method */}
          <div className="mb-6">
            <label className="block font-medium mb-3">
              Payment Method
            </label>

            <div className="flex gap-4">
              <button
                onClick={() => setMethod("INR")}
                className={`flex-1 py-3 rounded-lg border font-semibold ${
                  method === "INR"
                    ? "bg-black text-white"
                    : "bg-gray-100"
                }`}
              >
                INR
              </button>

              <button
                onClick={() => setMethod("USDT")}
                className={`flex-1 py-3 rounded-lg border font-semibold ${
                  method === "USDT"
                    ? "bg-black text-white"
                    : "bg-gray-100"
                }`}
              >
                USDT
              </button>
            </div>

            <p className="text-sm text-gray-500 mt-2">
              {method === "INR"
                ? "Minimum ₹1000 recharge"
                : "Minimum 10 USDT recharge"}
            </p>
          </div>

          {/* Button */}
          <button
            onClick={handleRecharge}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition"
          >
            {loading ? "Processing..." : "Proceed to Pay"}
          </button>
        </div>

        {/* RIGHT SIDE - PAYMENT DETAILS */}
        <div className="border rounded-xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">
            Payment Details
          </h2>

          {!paymentData && (
            <p className="text-gray-500 text-sm">
              Enter amount and proceed to see payment instructions
            </p>
          )}

          {paymentData && (
            <>
              <p className="mb-2">
                Amount: <b>{paymentData.amount}</b>
              </p>

              {paymentData.type === "crypto" && (
                <>
                  <p className="mb-2 font-medium">
                    Send USDT to this wallet:
                  </p>
                  <div className="bg-gray-100 p-3 rounded text-sm break-all">
                    {paymentData.wallet}
                  </div>
                </>
              )}

              {paymentData.type === "upi" && (
                <>
                  <p className="mb-2 font-medium">
                    UPI ID:
                  </p>
                  <div className="bg-gray-100 p-3 rounded text-sm">
                    {paymentData.upiId}
                  </div>

                  <img
                    src={paymentData.qr}
                    alt="QR"
                    className="mt-4 w-48"
                  />
                </>
              )}

              <div className="mt-4 text-green-600 text-sm">
                Payment will be verified automatically or by admin.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Recharge;