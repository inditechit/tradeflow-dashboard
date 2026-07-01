import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import {
  AlertTriangle, QrCode, Loader2, CheckCircle,
  ShieldCheck, ArrowRight, Copy, Check
} from 'lucide-react';
import { QRCodeCanvas } from "qrcode.react";
import { TRIAL_TERMS } from "@/constants/packages";
import { notifySubscriptionRefresh } from "@/utils/subscriptionEvents";
import { notifyProfileComplianceRefresh } from "@/utils/profileComplianceEvents";
import { API_BASE } from "@/config/api";
import {
  getStoredReferralKey,
  getStoredCouponCode,
  setStoredCouponCode,
} from "@/hooks/usePackages";
import { Wallet } from "lucide-react";

const PaymentPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, selectedPackage, addPackage } = useApp();
  const resumeStartedRef = useRef(false);

  const [step, setStep] = useState<'terms' | 'pay' | 'success'>('terms');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [paymentData, setPaymentData] = useState<any>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [paymentVerified, setPaymentVerified] = useState(false);

  const [copied, setCopied] = useState(false);
  const [copiedWallet, setCopiedWallet] = useState(false);
  const [trialTermsAccepted, setTrialTermsAccepted] = useState(
    Boolean((location.state as { trialTermsAccepted?: boolean })?.trialTermsAccepted)
  );
  const [couponPreview, setCouponPreview] = useState<{
    code: string;
    original_price_usd: number;
    list_price_usd: number;
    base_amount: number;
    discount_amount: number;
    final_amount: number;
  } | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletTxFee, setWalletTxFee] = useState(5);
  const [payingWithWallet, setPayingWithWallet] = useState(false);

  const isTrial = selectedPackage ? Boolean(selectedPackage.isTrial) : false;
  const listPrice = Number(selectedPackage?.listPrice ?? couponPreview?.list_price_usd ?? selectedPackage?.price ?? 0);
  const originalPrice = Number(selectedPackage?.originalPrice ?? couponPreview?.original_price_usd ?? listPrice);
  const displayPrice =
    couponPreview?.final_amount ?? Number(selectedPackage?.price ?? 0);

  useEffect(() => {
    const uid = currentUser?.userId;
    if (!uid) return;
    void (async () => {
      try {
        const res = await fetch(`${API_BASE}/user/block-access/${uid}`);
        const data = await res.json();
        if (data.access?.can_purchase_package === false) {
          navigate("/packages", { replace: true });
        }
      } catch {
        /* backend will reject purchase anyway */
      }
    })();
  }, [currentUser?.userId, navigate]);

  const isReferralCheckout = Boolean(
    getStoredReferralKey() || selectedPackage?.hasReferralDiscount,
  );

  useEffect(() => {
    if (getStoredReferralKey()) setStoredCouponCode(null);
  }, []);

  useEffect(() => {
    if (!selectedPackage || isTrial) return;
    const referralKey = getStoredReferralKey();
    const storedCoupon = selectedPackage.couponCode || getStoredCouponCode();
    const referralCheckout = Boolean(referralKey || selectedPackage.hasReferralDiscount);
    if (!referralCheckout && !storedCoupon && !currentUser?.userId) return;

    void (async () => {
      try {
        const body: Record<string, string> = { packageId: selectedPackage.id };
        if (currentUser?.userId) body.userId = String(currentUser.userId);
        if (referralKey) body.r = referralKey;
        else if (storedCoupon) body.code = storedCoupon;

        const res = await fetch(`${API_BASE}/coupons/validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.success && Number(data.discount_amount) > 0) {
          setCouponPreview({
            code: referralCheckout ? "REFERRAL" : (data.code || storedCoupon || ""),
            original_price_usd: Number(data.original_price_usd ?? selectedPackage.originalPrice ?? data.base_amount),
            list_price_usd: Number(data.list_price_usd ?? selectedPackage.listPrice ?? data.base_amount),
            base_amount: Number(data.base_amount),
            discount_amount: Number(data.discount_amount),
            final_amount: Number(data.final_amount),
          });
        }
      } catch {
        // optional pricing preview
      }
    })();
  }, [selectedPackage, isTrial, currentUser?.userId]);

  useEffect(() => {
    if (!currentUser?.userId || isTrial) return;
    setWalletLoading(true);
    void Promise.all([
      fetch(`${API_BASE}/user/wallet/${currentUser.userId}`).then((r) => r.json()),
      fetch(`${API_BASE}/purchase-package-with-wallet/fee`).then((r) => r.json()),
    ])
      .then(([wData, feeData]) => {
        if (wData.success && wData.wallet) {
          setWalletBalance(Math.max(0, Number(wData.wallet.balance ?? 0)));
        } else {
          setWalletBalance(0);
        }
        if (feeData.success && feeData.transactionFeeUsd != null) {
          setWalletTxFee(Number(feeData.transactionFeeUsd));
        }
      })
      .catch(() => setWalletBalance(0))
      .finally(() => setWalletLoading(false));
  }, [currentUser?.userId, isTrial]);

  const formatAmount = () => {
    if (!paymentData?.amount) return 0;
    return Number(paymentData.amount).toFixed(0);
  };

  const buildPaymentBody = (): Record<string, unknown> => {
    const body: Record<string, unknown> = {
      userId: currentUser!.userId,
      packageId: selectedPackage!.id,
    };
    if (isReferralCheckout) {
      const referralKey = getStoredReferralKey();
      if (referralKey) body.ref_key = referralKey;
      return body;
    }
    const storedCoupon = selectedPackage!.couponCode || getStoredCouponCode();
    if (couponPreview?.code && couponPreview.code !== "REFERRAL") {
      body.coupon_code = couponPreview.code;
    } else if (storedCoupon) {
      body.coupon_code = storedCoupon;
    }
    return body;
  };

  const completePurchaseSuccess = (paymentId: string | number) => {
    addPackage({
      ...selectedPackage!,
      purchasedAt: new Date().toISOString(),
      transactionId: String(paymentId),
    });
    notifySubscriptionRefresh();
    notifyProfileComplianceRefresh();
    setStep("success");
    setTimeout(() => navigate("/user/dashboard"), 3000);
  };

  const handlePayWithWallet = async () => {
    if (!currentUser?.userId || !selectedPackage) return;
    try {
      setPayingWithWallet(true);
      setErrorMessage("");
      const res = await fetch(`${API_BASE}/purchase-package-with-wallet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPaymentBody()),
      });
      const data = await res.json();
      if (data.success && data.activated) {
        if (data.walletBalanceAfter != null) {
          setWalletBalance(Number(data.walletBalanceAfter));
        }
        completePurchaseSuccess(data.paymentId ?? "");
      } else {
        setErrorMessage(data.error ?? "Could not complete wallet purchase");
      }
    } catch {
      setErrorMessage("Failed to pay from wallet");
    } finally {
      setPayingWithWallet(false);
    }
  };

  const handleCreatePayment = async () => {
    if (!currentUser?.userId || !selectedPackage) return;

    try {
      setIsSubmitting(true);
      setErrorMessage("");
      const body = { ...buildPaymentBody(), payment_method: "USDT" };
      const res = await fetch(`${API_BASE}/create-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.success) {
        if (data.activated || (isTrial && Number(data.amount) === 0)) {
          completePurchaseSuccess(data.paymentId ?? "");
          return;
        }
        setPaymentData(data);
        setStep("pay");
      } else {
        setErrorMessage(data.error ?? "Could not start payment");
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
        setIsChecking(false);
        setStep('success');

        // Automatically add package to user context on successful crypto payment
        addPackage({
          ...selectedPackage,
          purchasedAt: new Date().toISOString(),
          transactionId: paymentData.paymentId
        });
        notifySubscriptionRefresh();
        notifyProfileComplianceRefresh();

        setTimeout(() => {
          navigate('/user/dashboard');
        }, 3000);
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

  useEffect(() => {
    const resume = Boolean((location.state as { resumePayment?: boolean })?.resumePayment);
    if (!resume || !selectedPackage || !currentUser?.userId || resumeStartedRef.current) return;
    resumeStartedRef.current = true;
    handleCreatePayment();
  }, [location.state, selectedPackage, currentUser?.userId]);

  const handleCopyAmount = () => {
    if (!paymentData?.amount) return;
    navigator.clipboard.writeText(paymentData.amount.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyWallet = () => {
    if (!paymentData?.wallet) return;
    navigator.clipboard.writeText(paymentData.wallet);
    setCopiedWallet(true);
    setTimeout(() => setCopiedWallet(false), 2000);
  };

  const walletTotalDue =
    Math.round((displayPrice + walletTxFee) * 100) / 100;

  const canPayWithWallet =
    !isTrial &&
    displayPrice > 0 &&
    walletBalance != null &&
    walletBalance + 0.001 >= walletTotalDue;

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
              {step === 'pay' && 'Scan the QR code or copy the address to pay via USDT (TRC20).'}
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
          {/* STEP 1: TERMS */}
          {step === "terms" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div
                className={`rounded-xl p-6 flex items-start gap-4 border ${
                  isTrial
                    ? "bg-emerald-50 border-emerald-200"
                    : "bg-[#FFF9E6] border-yellow-200/80"
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                    isTrial ? "bg-emerald-500 text-white" : "bg-[#FFD700] text-black"
                  }`}
                >
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2">
                    {isTrial ? "Activate your 7-day trial" : "Please review before proceeding"}
                  </h3>
                  {isTrial ? (
                    <>
                      <ul className="text-sm text-slate-700 space-y-2 mb-4">
                        {TRIAL_TERMS.map((line) => (
                          <li key={line} className="flex gap-2">
                            <Check className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          className="mt-1 w-5 h-5 rounded border-emerald-400 text-emerald-600"
                          checked={trialTermsAccepted}
                          onChange={(e) => setTrialTermsAccepted(e.target.checked)}
                        />
                        <span className="text-sm font-semibold text-emerald-900">
                          I accept the trial terms and want to activate now.
                        </span>
                      </label>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        You are about to pay{" "}
                        <span className="font-semibold text-slate-800">
                          ${displayPrice.toFixed(0)} USDT
                        </span>
                        {couponPreview ? (
                          <span className="block mt-1 text-xs text-slate-500">
                            Original ${originalPrice.toFixed(0)} · Discounted ${listPrice.toFixed(0)} · You
                            pay ${displayPrice.toFixed(0)}
                          </span>
                        ) : originalPrice > listPrice ? (
                          <span className="block mt-1 text-xs text-slate-500">
                            Original ${originalPrice.toFixed(0)} · Discounted ${listPrice.toFixed(0)}
                          </span>
                        ) : null}
                        {couponPreview ? (
                          <span className="block mt-1 text-emerald-700 text-xs font-medium">
                            {couponPreview.code === "REFERRAL"
                              ? `Referral pricing — saved $${couponPreview.discount_amount.toFixed(0)}`
                              : `Coupon ${couponPreview.code} applied — saved $${couponPreview.discount_amount.toFixed(0)} (${Math.round((couponPreview.discount_amount / couponPreview.list_price_usd) * 100)}% off)`}
                          </span>
                        ) : null}
                        . Once the transaction is successfully completed, it will be processed instantly.
                      </p>
                      <p className="text-sm text-slate-500 mt-3 font-medium border-l-2 border-yellow-400 pl-3">
                        By proceeding, you acknowledge our Terms of Service. Due to the irreversible nature of digital asset settlements, all processed transactions are final and strictly non-refundable.
                      </p>
                    </>
                  )}
                </div>
              </div>

              {!isTrial && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-neutral-800" />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">Trading wallet</p>
                        <p className="text-xs text-slate-500">
                          {walletLoading
                            ? "Checking balance…"
                            : `Available: $${(walletBalance ?? 0).toFixed(2)}`}
                        </p>
                        {!walletLoading && displayPrice > 0 && walletTxFee > 0 ? (
                          <p className="mt-1 text-xs text-slate-500">
                            Package ${displayPrice.toFixed(2)} + ${walletTxFee.toFixed(2)} transaction fee = ${walletTotalDue.toFixed(2)} total
                          </p>
                        ) : null}
                      </div>
                    </div>
                    {canPayWithWallet ? (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                        Enough to pay with wallet
                      </span>
                    ) : !walletLoading && displayPrice > 0 ? (
                      <span className="text-xs text-slate-500">
                        Need ${walletTotalDue.toFixed(2)} (incl. ${walletTxFee.toFixed(2)} fee) — recharge or pay with USDT
                      </span>
                    ) : null}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row">
                {canPayWithWallet && (
                  <button
                    type="button"
                    onClick={() => void handlePayWithWallet()}
                    disabled={payingWithWallet || isSubmitting}
                    className="flex w-full flex-1 items-center justify-center gap-2 rounded-xl border-2 border-neutral-900 bg-white py-4 text-lg font-bold text-neutral-900 shadow-sm transition hover:bg-slate-50 disabled:opacity-70"
                  >
                    {payingWithWallet ? (
                      <Loader2 className="animate-spin" size={24} />
                    ) : (
                      <Wallet size={22} />
                    )}
                    Pay ${walletTotalDue.toFixed(2)} from wallet
                  </button>
                )}
                <button
                  onClick={handleCreatePayment}
                  disabled={isSubmitting || payingWithWallet || (isTrial && !trialTermsAccepted)}
                  className={`flex w-full flex-1 items-center justify-center gap-2 rounded-xl py-4 text-lg font-bold shadow-lg transition-all duration-200 disabled:opacity-70 disabled:hover:translate-y-0 ${
                    isTrial
                      ? "bg-emerald-500 text-white hover:bg-emerald-600"
                      : "bg-[#FFD700] text-black hover:bg-[#E6C200] hover:-translate-y-0.5 shadow-black/20"
                  }`}
                >
                  {isSubmitting ? (
                    <Loader2 className="animate-spin" size={24} />
                  ) : isTrial ? (
                    "Activate free trial"
                  ) : canPayWithWallet ? (
                    "Pay with USDT instead"
                  ) : (
                    "Proceed to Checkout"
                  )}
                  {!isSubmitting && <ArrowRight size={20} />}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: PAYMENT (USDT ONLY) */}
          {step === 'pay' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              
              {isSubmitting ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="animate-spin text-neutral-900 mb-4" size={40} />
                  <p className="text-slate-500 font-medium">Fetching payment details...</p>
                </div>
              ) : paymentData ? (
                <div className="border border-slate-200 rounded-xl p-8 bg-white">
                  <div className="flex justify-center mb-8">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                      {paymentData?.wallet && (
                        <QRCodeCanvas value={paymentData.wallet} size={220} className="rounded-xl" />
                      )}
                    </div>
                  </div>

                  <div className="bg-[#F9F9F9] rounded-xl p-6 border border-slate-200 space-y-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-6 border-b border-slate-200">
                      <div>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Total to Pay</p>
                        <p className="text-3xl font-black text-slate-800">
                          ${formatAmount()}
                        </p>
                        <p className="text-[11px] text-red-500 font-semibold mt-1">
                          * Send exact amount via TRC20. Do not round.
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
                          USDT (TRC20) Address
                        </p>
                        <p className="font-mono text-sm text-slate-800 truncate font-semibold">
                          {paymentData?.wallet}
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

                  <div className="mt-8 flex flex-col items-center justify-center py-6 bg-[#FFF9E6] rounded-xl border border-yellow-200/80">
                    <Loader2 className="animate-spin text-neutral-900 mb-3" size={36} />
                    <p className="text-base font-bold text-neutral-900">Awaiting Payment</p>
                    <p className="text-sm text-slate-600 mt-1 text-center px-2">Please do not close this window. We will detect your payment automatically.</p>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* STEP 3: SUCCESS */}
          {step === 'success' && (
            <div className="py-12 text-center animate-in zoom-in-95 duration-500">
              <div className="relative w-32 h-32 mx-auto mb-8">
                <div className="relative w-full h-full bg-[#FFF9E6] rounded-full flex items-center justify-center border-2 border-yellow-200/80 shadow-sm">
                  <CheckCircle className="text-neutral-900" size={64} strokeWidth={2.5} />
                </div>
              </div>
              <h2 className="text-3xl font-extrabold text-slate-800 mb-3">All Done!</h2>
              <p className="text-slate-500 text-lg mb-8 max-w-sm mx-auto">
                {isTrial
                  ? "Your 7-day free trial is active. Welcome aboard!"
                  : "Your payment has been successfully verified. Welcome aboard!"}
              </p>
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