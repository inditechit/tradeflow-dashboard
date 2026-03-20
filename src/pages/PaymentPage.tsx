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

  const [selectedMethod, setSelectedMethod] = useState<'USDT' | 'INR' | 'AED'>('USDT');
  const API_BASE = 'https://mt5api.inditechit.com/api';



  const handleChangeMethod = async (method: 'USDT' | 'INR' | 'AED') => {
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

      if (data.success) {
        setStep('success');
        addPackage({
          ...selectedPackage,
          purchasedAt: new Date().toISOString(),
          transactionId: data.txnId // Storing the AI-extracted ID
        });

        // Auto redirect after 3 seconds
        setTimeout(() => {
          navigate('/dashboard');
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
        <div className="text-center p-8 pb-6 border-b border-slate-100 bg-slate-50/50">
          <div className="inline-flex items-center justify-center gap-2 mb-3 px-4 py-1.5 rounded-full bg-cyan-50 text-cyan-600 border border-cyan-100">
            <ShieldCheck size={18} />
            <span className="font-semibold tracking-wide uppercase text-xs">Secure Checkout</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Payment Details</h1>
          <p className="text-slate-500 mt-2">
            Completing purchase for <span className="font-semibold text-slate-700">{selectedPackage.name}</span>
          </p>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="mx-8 mt-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium flex items-start gap-3">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="p-8">
          {/* STEP 1: TERMS */}
          {step === 'terms' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-500">
                  <AlertTriangle size={32} />
                </div>
                <h3 className="text-lg font-bold text-amber-900 mb-2">Important Notice</h3>
                <p className="text-amber-700/80 text-sm leading-relaxed">
                  By proceeding, you acknowledge that the amount of{' '}
                  <span className="font-bold text-amber-900">${selectedPackage.price.toLocaleString()}</span>{' '}
                  is strictly non-refundable once the transaction is verified.
                </p>
              </div>

              <button
                onClick={handleCreatePayment}
                className="w-full py-4 rounded-xl bg-cyan-600 text-white text-lg font-bold shadow-lg shadow-cyan-600/25 hover:bg-cyan-700 transition-all flex items-center justify-center gap-2"
              >
                I Understand & Accept <ArrowRight size={20} />
              </button>
            </div>
          )}

          {/* STEP 2: PAYMENT & UPLOAD */}
          {step === 'pay' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">

              {/* Payment Info Card */}
              <div className="border border-slate-200 rounded-xl p-6 text-center bg-slate-50">
                <div className="flex gap-2 mb-4 justify-center">
                  {['USDT', 'INR', 'AED'].map((method) => (
                    <button
                      key={method}
                      onClick={() => handleChangeMethod(method as 'USDT' | 'INR' | 'AED')}
                      className={`px-4 py-2 rounded-lg border text-sm font-semibold
        ${selectedMethod === method
                          ? 'bg-cyan-600 text-white border-cyan-600'
                          : 'bg-white text-slate-600 border-slate-300'}`}
                    >
                      {method}
                    </button>
                  ))}
                </div>

                <p className="text-sm font-semibold text-cyan-600 uppercase tracking-wider mb-4">
                  {paymentData?.type === 'crypto' && 'Send USDT (TRC20)'}
                  {paymentData?.type === 'upi' && 'Pay via UPI'}
                  {paymentData?.type === 'bank' && 'Bank Transfer'}
                  {!paymentData && 'Select payment method'}
                </p>

                <div className="flex justify-center mb-4">
                  <div className="bg-white p-2 rounded-xl shadow-md border border-slate-200">

                    {paymentData?.type === 'crypto' && (
                      <QRCodeCanvas
                        value={`tron:${paymentData.wallet}?amount=${paymentData.amount}`}
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

                    {paymentData?.type === 'bank' && (
                      <img
                        src={paymentData.qr}
                        alt="Bank QR"
                        className="w-[220px] h-[220px] object-cover rounded-lg"
                      />
                    )}

                  </div>
                </div>

                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-400 font-medium mb-1 uppercase tracking-wider">Amount to Pay</p>
                  <p className="text-2xl font-bold text-slate-800">${paymentData?.amount || selectedPackage?.price.toLocaleString()}</p>
                </div>

                {paymentData?.type === 'crypto' && (
                  <div className="mt-4">
                    <p className="text-xs text-slate-400">Wallet Address</p>
                    <div className="bg-slate-100 px-4 py-3 text-black rounded-lg text-sm font-mono break-all">
                      {paymentData.wallet}
                    </div>
                  </div>
                )}

                {paymentData?.type === 'upi' && (
                  <div className="mt-4">
                    <p className="text-xs text-slate-400">UPI ID</p>
                    <div className="bg-slate-100 text-black px-4 py-3 rounded-lg text-sm font-mono">
                      {paymentData.upiId}
                    </div>
                  </div>
                )}

                {paymentData?.type === 'bank' && (
                  <div className="mt-4">
                    <p className="text-xs text-slate-400">Bank Account</p>
                    <div className="bg-slate-100 text-black px-4 py-3 rounded-lg text-sm">
                      {paymentData.account}
                    </div>
                  </div>
                )}

                {paymentData && (
                  <div className="mt-3">
                    <p className="text-xs text-slate-400">Payment ID</p>
                    <p className="font-mono text-slate-800 text-sm">{paymentData.paymentId}</p>
                  </div>
                )}
              </div>

              {/* Upload Dropzone */}
              <div>
                <p className="text-sm font-semibold text-slate-800 mb-3">Upload Payment Receipt</p>

                {!preview ? (
                  <label className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-cyan-500 hover:bg-cyan-50/50 transition-colors group bg-white">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center group-hover:bg-cyan-100 transition-colors">
                      <Upload className="text-slate-400 group-hover:text-cyan-600 transition-colors" size={24} />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-slate-700">Click to upload screenshot</p>
                      <p className="text-xs text-slate-400 mt-1">PNG, JPG up to 5MB</p>
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                  </label>
                ) : (
                  <div className="border border-cyan-200 bg-cyan-50 rounded-xl p-4 flex items-center gap-4 relative">
                    <div className="w-16 h-16 rounded-lg bg-black/5 flex-shrink-0 overflow-hidden border border-black/10">
                      <img src={preview} alt="Receipt Preview" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{file?.name}</p>
                      <p className="text-xs text-cyan-600 flex items-center gap-1 mt-1">
                        <CheckCircle size={14} /> Ready for AI Scan
                      </p>
                    </div>
                    <button
                      onClick={removeFile}
                      className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 text-slate-500 transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>
                )}
              </div>

              {/* Submit Action */}
              <button
                onClick={handleConfirmPayment}
                disabled={!file || isSubmitting}
                className="w-full py-4 rounded-xl text-lg font-bold transition-all flex items-center justify-center gap-2 shadow-lg
                  disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none
                  bg-cyan-600 text-white hover:bg-cyan-700 hover:-translate-y-0.5"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={22} /> : null}
                {isSubmitting ? 'AI Verifying Receipt...' : 'Submit Payment'}
              </button>
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