import React, { useState, useEffect } from "react";
import axios from "axios";
import { QRCodeCanvas } from "qrcode.react";

const MIN_RECHARGE_USD = 100;

const Recharge = () => {
  const [amount, setAmount] = useState("");
  const [method] = useState("USD");
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState(null);

  // ✅ NEW STATES (added only)
  const [isChecking, setIsChecking] = useState(false);
  const [paymentVerified, setPaymentVerified] = useState(false);

  const userData = JSON.parse(localStorage.getItem("mt5_user"));
  const userId = userData?.userId;
  const API_BASE = 'https://api.copytradeengine.org/api';

  const amountUsd = Number(amount);
  const amountTooLow =
    amount !== "" && Number.isFinite(amountUsd) && amountUsd < MIN_RECHARGE_USD;

  const handleAmountChange = (raw: string) => {
    setAmount(raw);
  };

  const handleRecharge = async () => {
    if (!amount) return alert("Enter amount");

    if (amountUsd < MIN_RECHARGE_USD) {
      return alert(`Minimum ${MIN_RECHARGE_USD.toLocaleString()} USD required`);
    }
    try {
      setLoading(true);

      const res = await axios.post(`${API_BASE}/recharge`, {
        userId,
        amount: amountUsd,
        payment_method: "USDT"
      });

      setPaymentData(res.data);

      // ✅ START CHECKING
      setIsChecking(true);
      setPaymentVerified(false);

    } catch (err) {
      alert(err.response?.data?.error || "Error");
    } finally {
      setLoading(false);
    }
  };

  // ✅ CHECK STATUS
  const checkPaymentStatus = async () => {
    if (!paymentData?.paymentId) return;

    try {
      const res = await axios.get(
        `${API_BASE}/payment-status/${paymentData.paymentId}`
      );

      if (res.data.status === "success") {
        setPaymentVerified(true);
        setIsChecking(false);
      }
    } catch (err) {
      console.log("Error checking payment:", err);
    }
  };

  // ✅ AUTO POLLING (same as payment page)
  useEffect(() => {
    if (!paymentData?.paymentId) return;

    const interval = setInterval(() => {
      checkPaymentStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, [paymentData]);

  return (
    <div className="w-full min-h-screen bg-white p-8 text-black">

      <div className="mb-8">
        <h1 className="text-3xl font-bold">Recharge Wallet</h1>
        <p className="text-gray-600 text-sm">
          Add funds securely using USDT (TRC 20 network)
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* LEFT */}
        <div className="border rounded-xl p-6 shadow-sm">

          <div className="mb-6">
            <label className="block text-black font-medium mb-2">
              Enter Amount (USD)
            </label>
            <input
              type="number"
              min={MIN_RECHARGE_USD}
              step={1}
              className="w-full border rounded-lg p-4 text-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder={`${MIN_RECHARGE_USD.toLocaleString()} or more`}
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
            />
            <p className="text-sm text-gray-500 mt-2">
              Minimum {MIN_RECHARGE_USD.toLocaleString()} USD per recharge ($100 and below are not allowed)
            </p>
            {amountTooLow && (
              <p className="text-sm text-red-600 mt-1 font-medium">
                Amount must be at least {MIN_RECHARGE_USD.toLocaleString()} USD to recharge.
              </p>
            )}
          </div>

          <div className="mb-6">
            <label className="block font-medium mb-3">
              Payment Method
            </label>
            <div className="w-full py-3 rounded-lg border font-semibold bg-black text-white text-center">
              Usdt (TRC 20 network)
            </div>
          </div>

          <button
            onClick={handleRecharge}
            disabled={
              loading ||
              !amount ||
              !Number.isFinite(amountUsd) ||
              amountUsd < MIN_RECHARGE_USD
            }
            className="w-full bg-blue-600 text-white py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition"
          >
            {loading ? "Processing..." : "Proceed to Pay"}
          </button>
        </div>

        {/* RIGHT */}
        <div className="border rounded-xl p-6 shadow-sm flex flex-col h-full">
          {paymentVerified ? (
            /* ✅ SUCCESS UI (Replaces everything on the right) */
            <div className="flex-1 flex flex-col items-center justify-center text-center py-10 animate-pulse">
              <div className="w-24 h-24 bg-yellow-300 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-blue-200">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-[#21c17a] mb-2">Payment Successful!</h2>
              <p className="text-gray-600 font-medium">Your recharge has been verified securely.</p>
            </div>
          ) : (
            /* ⏳ PENDING UI */
            <>
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
                    <b>{Number(paymentData.amount).toFixed(0)} USD</b>
                  </p>

                  {/* QR */}
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

                  <div className="mt-4 text-yellow-700 text-sm">
                    Payment will be verified automatically or by admin.
                  </div>

                  {/* ⏳ WAITING */}
                  {isChecking && (
                    <div className="mt-3 text-blue-600 text-sm flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Waiting for payment verification...
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Recharge;