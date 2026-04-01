import React, { useState } from "react";
import axios from "axios";
import { QRCodeCanvas } from "qrcode.react"; // ✅ added

const Recharge = () => {
  const [amount, setAmount] = useState("");
  const [method] = useState("USD");
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState(null);

  const userData = JSON.parse(localStorage.getItem("mt5_user"));
  const userId = userData?.userId;
  const API_BASE = 'https://mt5api.inditechit.com/api';

  const handleRecharge = async () => {
    if (!amount) return alert("Enter amount");

    if (Number(amount) < 10) {
      return alert("Minimum 10 USD required");
    }

    try {
      setLoading(true);

      const res = await axios.post(`${API_BASE}/recharge`, {
        userId,
        amount: Number(amount),
        payment_method: "USD"
      });

      setPaymentData(res.data);
    } catch (err) {
      alert(err.response?.data?.error || "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-white p-8 text-black">

      <div className="mb-8">
        <h1 className="text-3xl font-bold">Recharge Wallet</h1>
        <p className="text-gray-600 text-sm">
          Add funds securely using USDT (Crypto)
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* LEFT */}
        <div className="border rounded-xl p-6 shadow-sm">

          <div className="mb-6">
            <label className="block font-medium mb-2">
              Enter Amount (USD)
            </label>
            <input
              type="number"
              className="w-full border rounded-lg p-4 text-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="text-sm text-gray-500 mt-2">
              Minimum 10 USD recharge
            </p>
          </div>

          <div className="mb-6">
            <label className="block font-medium mb-3">
              Payment Method
            </label>
            <div className="w-full py-3 rounded-lg border font-semibold bg-black text-white text-center">
              USD (Crypto)
            </div>
          </div>

          <button
            onClick={handleRecharge}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition"
          >
            {loading ? "Processing..." : "Proceed to Pay"}
          </button>
        </div>

        {/* RIGHT */}
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
                Amount:{" "}
                <b>{paymentData.amount.toFixed(6)} USD</b>
              </p>

              {/* ✅ QR CODE */}
              <div className="flex flex-col items-center my-4">
                <QRCodeCanvas
                  value={paymentData.wallet}
                  size={180}
                />
                <p className="text-xs text-gray-500 mt-2">
                  Scan QR to pay
                </p>
              </div>

              {/* WALLET */}
              <p className="mb-2 font-medium">
                Send USD to this wallet:
              </p>

              <div className="bg-gray-100 p-3 rounded text-sm break-all">
                {paymentData.wallet}
              </div>

              {/* WARNING */}
              <p className="text-[12px] text-red-500 mt-3">
                Send exact amount. Do not round.
              </p>

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