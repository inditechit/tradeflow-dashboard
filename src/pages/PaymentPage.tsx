import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import {
  AlertTriangle, QrCode, Upload, Loader2, CheckCircle,
  ShieldCheck, Image as ImageIcon, X, ArrowRight
} from 'lucide-react';
import { QRCodeCanvas } from "qrcode.react";

const PaymentPage = () => {
  const navigate = useNavigate();
  const { currentUser, selectedPackage, addPackage } = useApp();
  const [step, setStep] = useState<'terms' | 'pay' | 'success'>('terms');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [paymentData, setPaymentData] = useState<any>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [paymentVerified, setPaymentVerified] = useState(false);

  const [selectedMethod, setSelectedMethod] = useState<'USD' | 'INR' | 'AED'>('USD');
  const API_BASE = 'https://mt5api.inditechit.com/api';

  const [copied, setCopied] = useState(false);

  const getCurrencySymbol = () => {
    if (selectedMethod === "INR") return "₹";
    if (selectedMethod === "AED") return "د.إ";
    return "$";
  };

  const formatAmount = () => {
    if (!paymentData?.amount) return 0;

    const amount = Number(paymentData.amount);

    if (selectedMethod === "INR") {
      return amount.toFixed(0); // no decimals
    }

    return amount.toFixed(6); // keep decimals for crypto/USD
  };


  const handleChangeMethod = async (method: 'USD' | 'INR' | 'AED') => {
    setSelectedMethod(method);
    setPaymentData(null); // reset old data

    if (!currentUser?.userId || !selectedPackage) return;

    try {
      setIsSubmitting(true);

      const res = await fetch(`${API_BASE}/create-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.userId,
          packageId: selectedPackage.id,
          payment_method: method
        })
      });

      const data = await res.json();
      console.log(data);

      if (data.success) {
        setPaymentData(data);
      } else {
        setErrorMessage(data.error);
      }

    } catch (err) {
      setErrorMessage('Failed to switch payment method');
    } finally {
      setIsSubmitting(false);
    }
  };





  // Handle file selection and generate a preview thumbnail
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 5 * 1024 * 1024) {
        setErrorMessage('File is too large. Please upload an image under 5MB.');
        return;
      }
      setErrorMessage('');
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleCreatePayment = async () => {
    if (!currentUser?.userId || !selectedPackage) return;

    try {
      setIsSubmitting(true);

      const res = await fetch(`${API_BASE}/create-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.userId,
          packageId: selectedPackage.id,
          payment_method: selectedMethod
        })
      });

      const data = await res.json();
      console.log('Payment data:', data);

      if (data.success) {
        setPaymentData(data);
        setStep('pay');
      } else {
        setErrorMessage(data.error);
      }

    } catch (err) {
      setErrorMessage('Failed to create payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const checkPaymentStatus = async () => {
    if (!paymentData?.paymentId) return;

    try {
      const res = await fetch(
        `${API_BASE}/payment-status/${paymentData.paymentId}`
      );

      const data = await res.json();

      console.log("🔍 Status:", data.status);

      if (data.status === "success") {
        setPaymentVerified(true);
        setIsChecking(false);
      }

    } catch (err) {
      console.log("Error checking payment:", err);
    }
  };

  useEffect(() => {
    if (step !== "pay" || !paymentData?.paymentId) return;

    setIsChecking(true);

    const interval = setInterval(() => {
      checkPaymentStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, [step, paymentData]);

  const removeFile = () => {
    setFile(null);
    setPreview(null);
  };

  const handleConfirmPayment = async () => {
    if (!file) {
      setErrorMessage('Please upload a screenshot of your payment receipt.');
      return;
    }

    if (!paymentData?.paymentId) {
      setErrorMessage('Payment not initialized. Please try again.');
      return;
    }

    if (!currentUser?.userId || !selectedPackage) return;

    setIsSubmitting(true);
    setErrorMessage('');

    const formData = new FormData();
    formData.append('receipt', file);
    formData.append('userId', currentUser.userId.toString());
    formData.append('packageName', selectedPackage.name);
    formData.append('amount', selectedPackage.price.toString());
    formData.append('method', paymentData.payment_method);
    formData.append('paymentId', paymentData.paymentId);

    try {
      const response = await fetch(`${API_BASE}/payment/upload`, {
        method: 'POST',
        body: formData, // Fetch automatically sets multipart/form-data boundary
      });

      const data: any = await response.json();
      console.log('Payment data:', data);

      if (data.success) {
        setStep('success');
        addPackage({
          ...selectedPackage,
          purchasedAt: new Date().toISOString(),
          transactionId: data.txnId // Storing the AI-extracted ID
        });

        // Auto redirect after 3 seconds
        setTimeout(() => {
          navigate('/user/dashboard');
        }, 3000);
      } else {
        setErrorMessage(data.error || 'Failed to verify payment receipt.');
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage('Server error while processing receipt via AI.');
      setIsSubmitting(false);
    }
  };

  const handleCopy = () => {
    if (!paymentData?.amount) return;

    navigator.clipboard.writeText(paymentData.amount.toString());
    setCopied(true);

    setTimeout(() => setCopied(false), 2000);
  };


  // Fallback if no package is selected
  if (!selectedPackage) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <div className="bg-white rounded-2xl p-10 text-center shadow-xl border border-slate-100 max-w-md w-full">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
            <QrCode size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">No Package Selected</h2>
          <p className="text-slate-500 text-sm mb-8">Please choose a package before proceeding to checkout.</p>
          <button
            onClick={() => navigate('/packages')}
            className="w-full py-3.5 rounded-xl bg-cyan-600 text-white font-bold hover:bg-cyan-700 transition-colors shadow-lg shadow-cyan-600/20"
          >
            Browse Packages
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-12 bg-slate-50">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl shadow-cyan-900/5 overflow-hidden border border-slate-100">

        {/* Header */}
        <div className="text-center p-8 pb-6 border-b border-slate-200 bg-white">
          <div className="inline-flex items-center justify-center gap-2 mb-3 px-4 py-1.5 rounded-full bg-cyan-50 text-cyan-600 border border-cyan-100">
            <ShieldCheck size={18} />
            <span className="font-semibold tracking-wide uppercase text-xs">
              Secure Payment
            </span>
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
            Payment Details
          </h1>

          <p className="text-slate-500 mt-2 text-sm">
            You're purchasing{" "}
            <span className="font-semibold text-slate-700">
              {selectedPackage.name}
            </span>
          </p>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="mx-8 mt-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-start gap-3">
            <AlertTriangle size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="p-8">
          {step === "terms" && (
            <div className="space-y-6">

              {/* ✅ Clean Notice Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex items-start gap-4">

                {/* Nice Icon (not warning) */}
                <div className="w-12 h-12 rounded-xl bg-cyan-100 flex items-center justify-center text-cyan-600">
                  <ShieldCheck size={24} />
                </div>

                {/* Content */}
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-1">
                    Please review before proceeding
                  </h3>

                  <p className="text-sm text-slate-600 leading-relaxed">
                    You are about to make a payment of{" "}
                    <span className="font-semibold text-slate-800">
                      ${selectedPackage.price.toLocaleString()}
                    </span>
                    . Once the transaction is successfully completed, it will be processed instantly.
                  </p>

                <p className="text-sm text-slate-500 mt-2">
                  Please ensure. Payments once processed are non-refundable.
                </p>
                </div>
              </div>

              {/* CTA Button */}
              <button
                onClick={handleCreatePayment}
                className="w-full py-4 rounded-xl bg-cyan-600 text-white text-lg font-semibold shadow-md hover:bg-cyan-700 transition-all flex items-center justify-center gap-2"
              >
                Continue to Payment
                <ArrowRight size={20} />
              </button>
            </div>
          )}


          {/* STEP 2: PAYMENT & UPLOAD */}
          {step === 'pay' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">

              {/* Payment Method Switch */}
              <div className="flex gap-2 mb-4 justify-center">
                {['USD', 'INR', 'AED'].map((method) => (
                  <button
                    key={method}
                    onClick={() => handleChangeMethod(method as 'USD' | 'INR' | 'AED')}
                    className={`px-4 py-2 rounded-lg border text-sm font-semibold
            ${selectedMethod === method
                        ? 'bg-cyan-600 text-white border-cyan-600'
                        : 'bg-white text-slate-600 border-slate-300'}`}
                  >
                    {method}
                  </button>
                ))}
              </div>

              {/*AED ONLY VIEW */}
              {paymentData?.type === 'bank' ? (

                <div className="flex flex-col items-center justify-center p-8 bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl shadow-sm text-center">

                  <p className="text-xl font-bold text-yellow-700">
                    🚧 AED Payment Coming Soon
                  </p>

                  <p className="text-sm text-gray-600 mt-3">
                    We are currently setting up AED payments.
                    <br />
                    Please use UPI or USDT for now.
                  </p>

                </div>

              ) : (

                <>
                  {/* NORMAL PAYMENT UI */}

                  <div className="border border-slate-200 rounded-xl p-6 text-center bg-slate-50">

                    <p className="text-sm font-semibold text-cyan-600 uppercase tracking-wider mb-4">
                      {paymentData?.type === 'crypto' && 'Send USDT (TRC20)'}
                      {paymentData?.type === 'upi' && 'Pay via UPI'}
                    </p>

                    <div className="flex justify-center mb-4">
                      <div className="bg-white p-2 rounded-xl shadow-md border border-slate-200">

                        {paymentData?.type === 'crypto' && (
                          <QRCodeCanvas
                            value={paymentData.wallet}
                            size={220}
                          />
                        )}

                        {paymentData?.type === 'upi' && (
                          <img
                            src={paymentData.qr}
                            alt="UPI QR"
                            className="w-[220px] h-[220px] object-cover rounded-lg"
                          />
                        )}

                      </div>
                    </div>

                    {/* Amount */}
                    <div className="bg-white p-3 rounded-lg border border-slate-200">
                      <p className="text-xs text-slate-400 font-medium mb-1 uppercase tracking-wider">
                        Amount to Pay
                      </p>

                      <div className="flex items-center justify-center">
                        <p className="text-2xl font-bold text-slate-800">
                          {getCurrencySymbol()} {formatAmount()}
                        </p>

                        <button
                          onClick={handleCopy}
                          className="ml-3 px-3 py-1 text-xs font-medium bg-blue-500 text-white rounded hover:bg-blue-600 transition"
                        >
                          {copied ? "Copied!" : "Copy"}
                        </button>
                      </div>

                      {/* Warning */}
                      <p className="text-[10px] text-red-500 mt-2">
                        {selectedMethod === "USD"
                          ? "Send exact amount. Do not round."
                          : "Send exact amount"}
                      </p>
                    </div>

                    {/* Wallet */}
                    {paymentData?.type === 'crypto' && (
                      <div className="mt-4">
                        <p className="text-xs text-slate-400">Wallet Address</p>
                        <div className="bg-slate-100 px-4 py-3 text-black rounded-lg text-sm font-mono break-all">
                          {paymentData.wallet}
                        </div>
                      </div>
                    )}

                    {/* UPI */}
                    {paymentData?.type === 'upi' && (
                      <div className="mt-4">
                        <p className="text-xs text-slate-400">UPI ID</p>
                        <div className="bg-slate-100 text-black px-4 py-3 rounded-lg text-sm font-mono">
                          {paymentData.upiId}
                        </div>
                      </div>
                    )}

                    {/* Payment ID */}
                    {paymentData && (
                      <div className="mt-3">
                        <p className="text-xs text-slate-400">Payment ID</p>
                        <p className="font-mono text-slate-800 text-sm">{paymentData.paymentId}</p>
                      </div>
                    )}

                    {/* 🔄 WAITING */}
                    {isChecking && !paymentVerified && (
                      <div className="flex flex-col items-center mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <Loader2 className="animate-spin text-blue-600 mb-2" size={28} />
                        <p className="text-sm text-blue-700">Waiting for payment...</p>
                        <p className="text-xs text-blue-500 mt-1">
                          We will detect your payment automatically
                        </p>
                      </div>
                    )}

                    {/* ✅ VERIFIED */}
                    {paymentVerified && (
                      <div className="flex flex-col items-center mt-4 bg-green-50 border border-green-200 rounded-xl p-4">
                        <CheckCircle className="text-green-600 mb-2" size={28} />
                        <p className="text-sm font-semibold text-green-700">
                          Payment Verified Successfully 🎉
                        </p>
                        <p className="text-xs text-green-600 mt-1">
                          Now upload your screenshot and submit
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Upload Section */}
                  <div>
                    <p className="text-sm font-semibold text-slate-800 mb-3">Upload Payment Receipt</p>

                    {!preview ? (
                      <label className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-cyan-500 hover:bg-cyan-50/50 transition-colors group bg-white">
                        <Upload size={24} />
                        <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                      </label>
                    ) : (
                      <div className="border border-cyan-200 bg-cyan-50 rounded-xl p-4 flex items-center gap-4 relative">
                        <img src={preview} className="w-16 h-16 object-cover rounded" />
                        <button onClick={removeFile}><X size={18} /></button>
                      </div>
                    )}
                  </div>

                  {/* Submit */}
                  <button
                    onClick={handleConfirmPayment}
                    disabled={!file || isSubmitting || !paymentVerified}
                    className="w-full py-4 rounded-xl text-lg font-bold bg-cyan-600 text-white"
                  >
                    {isSubmitting
                      ? 'Processing...'
                      : paymentVerified
                        ? 'Submit Payment'
                        : 'Waiting for Verification'}
                  </button>
                </>
              )}

            </div>
          )}

          {/* STEP 3: SUCCESS */}
          {step === 'success' && (
            <div className="py-8 text-center animate-in zoom-in-95 duration-500">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="text-green-500" size={40} />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Payment Verified!</h2>
              <p className="text-slate-500 mb-6">Our AI successfully scanned your receipt. Redirecting you to the dashboard...</p>
              <Loader2 className="animate-spin text-cyan-500 mx-auto" size={24} />
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default PaymentPage;