import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import {
  AlertTriangle, QrCode, Upload, Loader2, CheckCircle,
  ShieldCheck, Image as ImageIcon, X, ArrowRight,
  Copy, Check
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
  const [copiedWallet, setCopiedWallet] = useState(false);

  const getCurrencySymbol = () => {
    if (selectedMethod === "INR") return "₹";
    if (selectedMethod === "AED") return "د.إ";
    return "$";
  };

  const formatAmount = () => {
    if (!paymentData?.amount) return 0;
    const amount = Number(paymentData.amount);
    if (selectedMethod === "INR") {
      return amount.toFixed(0);
    }
    return amount.toFixed(0);
  };

  const handleChangeMethod = async (method: 'USD' | 'INR' | 'AED') => {
    setSelectedMethod(method);
    setPaymentData(null); // Temporarily clear data while fetching

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

  const checkPaymentStatus = async () => {
    if (!paymentData?.paymentId) return;

    try {
      const res = await fetch(`${API_BASE}/payment-status/${paymentData.paymentId}`);
      const data = await res.json();

      if (data.status === "success") {
        setPaymentVerified(true);

        // ✅ only USD flow
        if (selectedMethod === "USD") {
          setIsChecking(false);
          setStep('success');

          setTimeout(() => {
            navigate('/user/dashboard');
          }, 3000);
        }
      }
    } catch (err) {
      console.log("Error checking payment:", err);
    }
  };

  useEffect(() => {
    if (step !== "pay" || !paymentData?.paymentId) return;
    if (selectedMethod === "INR") return;

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
    formData.append('amount', paymentData.amount.toString());
    formData.append('method', paymentData.payment_method);
    formData.append('paymentId', paymentData.paymentId);

    try {
      const response = await fetch(`${API_BASE}/payment/upload`, {
        method: 'POST',
        body: formData,
      });

      const data: any = await response.json();

      if (data.success) {
        setStep('success');
        addPackage({
          ...selectedPackage,
          purchasedAt: new Date().toISOString(),
          transactionId: data.txnId
        });

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

  const handleCopyAmount = () => {
    if (!paymentData?.amount) return;
    navigator.clipboard.writeText(paymentData.amount.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyWallet = () => {
    if (!paymentData?.wallet && !paymentData?.upiId) return;
    navigator.clipboard.writeText(paymentData.wallet || paymentData.upiId);
    setCopiedWallet(true);
    setTimeout(() => setCopiedWallet(false), 2000);
  };

  if (!selectedPackage) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-white">
        <div className="bg-white rounded-xl p-10 text-center shadow-sm border border-slate-200 max-w-md w-full animate-in fade-in zoom-in duration-300">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-400">
            <QrCode size={36} strokeWidth={1.5} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-3">No Package Selected</h2>
          <p className="text-slate-500 text-base mb-8 leading-relaxed">Please choose a package from our catalog before proceeding to checkout.</p>
          <button
            onClick={() => navigate('/packages')}
            className="w-full py-4 rounded-xl bg-[#FFD700] text-black font-bold hover:bg-[#E6C200] transition-all shadow-lg shadow-black/20 active:scale-[0.98]"
          >
            Browse Packages
          </button>
        </div>
      </div>
    );
  }

  const stepsList = ['Terms', 'Payment', 'Complete'];
  const currentStepIndex = ['terms', 'pay', 'success'].indexOf(step);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-12 bg-white font-sans">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200">

        {/* Header & Stepper */}
        <div className="p-8 pb-6 border-b border-slate-200 bg-white">
          <div className="flex justify-between items-center mb-8 relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-100 rounded-full -z-10"></div>
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-[#FFD700] rounded-full -z-10 transition-all duration-500"
              style={{ width: `${(currentStepIndex / (stepsList.length - 1)) * 100}%` }}
            ></div>

            {stepsList.map((s, i) => (
              <div key={s} className="flex flex-col items-center gap-2 bg-white px-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${i < currentStepIndex ? 'bg-[#FFD700] text-black shadow-sm' :
                  i === currentStepIndex ? 'bg-white border-2 border-neutral-900 text-neutral-900 shadow-sm' :
                    'bg-slate-100 text-slate-400'
                  }`}>
                  {i < currentStepIndex ? <Check size={20} strokeWidth={3} /> : i + 1}
                </div>
                <span className={`text-xs font-semibold ${i <= currentStepIndex ? 'text-slate-800' : 'text-slate-400'}`}>
                  {s}
                </span>
              </div>
            ))}
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">
              {step === 'terms' && 'Payment Terms'}
              {step === 'pay' && 'Complete Payment'}
              {step === 'success' && 'Payment Successful'}
            </h1>
            <p className="text-slate-500 mt-2 text-sm">
              {step === 'terms' && 'Please acknowledge that payments are non-refundable before proceeding.'}
              {step === 'pay' && 'Scan the QR code or copy the address to pay.'}
              {step === 'success' && 'Your transaction is complete.'}
            </p>
          </div>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="mx-8 mt-6 p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-3 animate-in slide-in-from-top-2">
            <AlertTriangle size={20} className="shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        <div className="p-8">
          {/* STEP 1: TERMS (Restored Warning Paragraph) */}
          {step === "terms" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">

              <div className="bg-[#FFF9E6] border border-yellow-200/80 rounded-xl p-6 flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#FFD700] flex items-center justify-center text-black shrink-0">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2">
                    Please review before proceeding
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    You are about to make a payment of{" "}
                    <span className="font-semibold text-slate-800">
                      ${paymentData ? `${getCurrencySymbol()} ${formatAmount()}` : `$${selectedPackage.price}`}
                    </span>
                    . Once the transaction is successfully completed, it will be processed instantly.
                  </p>
                  <p className="text-sm text-slate-500 mt-3 font-medium border-l-2 border-yellow-400 pl-3">
                    By proceeding, you acknowledge our Terms of Service. Due to the irreversible nature of digital asset and fiat settlements, all processed transactions are final and strictly non-refundable.
                  </p>
                </div>
              </div>

              <button
                onClick={handleCreatePayment}
                disabled={isSubmitting}
                className="w-full py-4 rounded-xl bg-[#FFD700] text-black text-lg font-bold shadow-lg shadow-black/20 hover:bg-[#E6C200] hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:hover:translate-y-0"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={24} /> : 'Proceed to Checkout'}
                {!isSubmitting && <ArrowRight size={20} />}
              </button>
            </div>
          )}

          {/* STEP 2: PAYMENT */}
          {step === 'pay' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="flex gap-1 justify-center bg-[#F2F2F2] p-1 rounded-xl w-max mx-auto border border-slate-200/80">
                {['USD', 'INR', 'AED'].map((method) => {
                  const isDisabled =
                    selectedPackage.id === 'intl-tour' && method === 'INR';

                  return (
                    <button
                      key={method}
                      onClick={() => !isDisabled && handleChangeMethod(method as any)}
                      disabled={isDisabled}
                      className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-300
        ${selectedMethod === method
                          ? 'bg-[#FFD700] text-black shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'}
        ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}
      `}
                    >
                      {method}
                    </button>

                  );

                })}

                {selectedPackage.id === 'intl-tour' && selectedMethod === 'INR' && (
                  <p className="text-center text-red-500 text-sm mt-2">
                    INR payment is under process for International Tour
                  </p>
                )}
              </div>

              {/* Show loader while switching methods to prevent crash */}
              {isSubmitting ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="animate-spin text-neutral-900 mb-4" size={40} />
                  <p className="text-slate-500 font-medium">Fetching payment details...</p>
                </div>
              ) : paymentData?.type === 'bank' ? (
                <div className="flex flex-col items-center justify-center p-12 bg-[#FFF9E6] border border-yellow-200/80 rounded-xl text-center">
                  <div className="w-16 h-16 bg-[#F2F2F2] text-neutral-800 rounded-full flex items-center justify-center mb-4 border border-slate-200">
                    <AlertTriangle size={32} />
                  </div>
                  <p className="text-2xl font-bold text-slate-800 mb-2">AED Payment Coming Soon</p>
                  <p className="text-slate-600">We are currently setting up our AED gateway.<br />Please switch to UPI or USDT for now.</p>
                </div>
              ) : paymentData ? (
                <div className="border border-slate-200 rounded-xl p-8 bg-white">
                  <div className="flex justify-center mb-8">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                      {paymentData?.type === 'crypto' && paymentData?.wallet && (
                        <QRCodeCanvas value={paymentData.wallet} size={220} className="rounded-xl" />
                      )}
                      {paymentData?.type === 'upi' && paymentData?.qr && (
                        <img src={paymentData.qr} alt="UPI QR" className="w-[220px] h-[220px] object-cover rounded-xl" />
                      )}
                    </div>
                  </div>

                  <div className="bg-[#F9F9F9] rounded-xl p-6 border border-slate-200 space-y-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-6 border-b border-slate-200">
                      <div>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Total to Pay</p>
                        <p className="text-3xl font-black text-slate-800">
                          {getCurrencySymbol()} {formatAmount()}
                        </p>
                        {selectedMethod === "INR" && (
                          <>
                            {selectedPackage.id === "india-tour" && (
                              <p className="text-xs text-slate-500 mt-1">
                                ₹60,000 + 18% GST included
                              </p>
                            )}

                            {selectedPackage.id === "meet-guru" && (
                              <p className="text-xs text-slate-500 mt-1">
                                ₹10000 + 18% GST included
                              </p>
                            )}
                          </>
                        )}
                        <p className="text-[11px] text-red-500 font-semibold mt-1">
                          {selectedMethod === "USD" ? "* Send exact amount. Do not round." : "* Send exact amount."}
                        </p>
                      </div>
                      <button
                        onClick={handleCopyAmount}
                        className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold text-sm rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
                      >
                        {copied ? <Check size={18} className="text-yellow-600" /> : <Copy size={18} />}
                        {copied ? "Copied" : "Copy Amount"}
                      </button>
                    </div>

                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                      <div className="w-full truncate">
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
                          {paymentData?.type === 'crypto' ? 'USDT (trc20) address' : 'UPI ID'}
                        </p>
                        {/* THIS LINE IS FIXED: Added `?.wallet` and `?.upiId` to prevent crash */}
                        <p className="font-mono text-sm text-slate-800 truncate font-semibold">
                          {paymentData?.type === 'crypto' ? paymentData?.wallet : paymentData?.upiId}
                        </p>
                      </div>
                      <button
                        onClick={handleCopyWallet}
                        className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold text-sm rounded-xl hover:bg-slate-50 transition-colors shadow-sm shrink-0"
                      >
                        {copiedWallet ? <Check size={18} className="text-yellow-600" /> : <Copy size={18} />}
                        {copiedWallet ? "Copied" : "Copy Details"}
                      </button>
                    </div>
                  </div>

                  {selectedMethod !== "INR" && (
                    <div className="mt-8 flex flex-col items-center justify-center py-6 bg-[#FFF9E6] rounded-xl border border-yellow-200/80">
                      <Loader2 className="animate-spin text-neutral-900 mb-3" size={36} />
                      <p className="text-base font-bold text-neutral-900">Awaiting Payment</p>
                      <p className="text-sm text-slate-600 mt-1 text-center px-2">Please do not close this window. We will detect your payment automatically.</p>
                    </div>
                  )}
                </div>
              ) : null}

              {selectedMethod === "INR" && (
                <div className="mt-8 border-t pt-6">

                  <h3 className="text-lg font-bold text-slate-800 mb-4 text-center">
                    Upload Payment Screenshot
                  </h3>

                  {!preview ? (
                    <label className="flex flex-col items-center justify-center w-full h-56 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer bg-[#F9F9F9] hover:bg-[#FFF9E6]">
                      <Upload size={28} className="mb-2 text-neutral-900" />
                      <p className="text-sm font-medium">Click to upload receipt</p>
                      <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                    </label>
                  ) : (
                    <div className="relative">
                      <img src={preview} className="w-full h-56 object-cover rounded-xl" />
                      <button
                        onClick={removeFile}
                        className="absolute top-2 right-2 bg-white p-2 rounded-full shadow"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  )}

                  <button
                    onClick={handleConfirmPayment}
                    disabled={!file || isSubmitting}
                    className="w-full mt-4 py-3 bg-[#FFD700] text-black font-bold rounded-xl disabled:opacity-50"
                  >
                    {isSubmitting ? "Processing..." : "Submit & Complete"}
                  </button>

                </div>
              )}
            </div>
          )}

          {/* STEP 3: UPLOAD SCREEN */}


          {/* STEP 4: SUCCESS */}
          {step === 'success' && (
            <div className="py-12 text-center animate-in zoom-in-95 duration-500">
              <div className="relative w-32 h-32 mx-auto mb-8">
                <div className="relative w-full h-full bg-[#FFF9E6] rounded-full flex items-center justify-center border-2 border-yellow-200/80 shadow-sm">
                  <CheckCircle className="text-neutral-900" size={64} strokeWidth={2.5} />
                </div>
              </div>
              <h2 className="text-3xl font-extrabold text-slate-800 mb-3">All Done!</h2>
              <p className="text-slate-500 text-lg mb-8 max-w-sm mx-auto">Your payment and receipt have been verified. Welcome aboard!</p>
              <div className="flex items-center justify-center gap-3 text-neutral-900 font-semibold bg-[#FFF9E6] border border-yellow-200/80 w-max mx-auto px-6 py-3 rounded-full">
                <Loader2 className="animate-spin" size={20} />
                Redirecting to dashboard...
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default PaymentPage;