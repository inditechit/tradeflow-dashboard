import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { AlertTriangle, QrCode, Upload, Loader2, CheckCircle } from 'lucide-react';

const PaymentPage = () => {
  const navigate = useNavigate();
  const { currentUser, selectedPackage, addPackage } = useApp();
  const [step, setStep] = useState<'terms' | 'pay'>('terms');
  const [processing, setProcessing] = useState(false);
  const [uploaded, setUploaded] = useState(false);

  const depositMethod = currentUser?.depositMethod || 'USDT';
  const isCrypto = depositMethod === 'USDT';

  const handleConfirmPayment = () => {
    setProcessing(true);
    setTimeout(() => {
      if (selectedPackage) {
        addPackage({ ...selectedPackage, purchasedAt: new Date().toISOString() });
      }
      navigate('/dashboard');
    }, 2000);
  };

  if (!selectedPackage) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glow-box p-8 text-center">
          <p className="text-muted-foreground">No package selected.</p>
          <button onClick={() => navigate('/packages')} className="btn-gold mt-4 px-6 py-3 rounded-lg">
            Browse Packages
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glow-box w-full max-w-lg p-8 md:p-10">
        <h1 className="text-2xl font-heading font-bold text-secondary text-center mb-2">Payment</h1>
        <p className="text-muted-foreground text-center text-sm mb-6">
          {selectedPackage.name} — <span className="text-secondary font-bold">${selectedPackage.price}</span>
        </p>

        {step === 'terms' && (
          <div className="text-center space-y-6">
            <div className="glow-box p-6 flex flex-col items-center gap-4">
              <AlertTriangle className="text-secondary" size={48} />
              <p className="text-foreground text-sm leading-relaxed">
                By proceeding, you acknowledge that the amount of{' '}
                <span className="text-secondary font-bold">${selectedPackage.price}</span>{' '}
                is <span className="text-destructive font-semibold">strictly non-refundable</span>.
              </p>
            </div>
            <button onClick={() => setStep('pay')} className="btn-gold w-full py-4 rounded-lg text-lg tracking-wider">
              I Accept
            </button>
          </div>
        )}

        {step === 'pay' && (
          <div className="space-y-6">
            {/* QR Code area */}
            <div className="glow-box p-6 flex flex-col items-center gap-4">
              <p className="text-sm text-muted-foreground">{isCrypto ? 'Crypto Payment (TRC20)' : 'Fiat Payment'}</p>
              <div className="bg-foreground/90 p-4 rounded-lg">
                <QrCode className="text-background" size={120} />
              </div>
              {isCrypto && (
                <div className="w-full">
                  <p className="text-xs text-muted-foreground mb-1">TRC20 Address</p>
                  <div className="glow-input px-3 py-2 rounded text-xs font-mono break-all">
                    TKx9a4gPf8RwQU2E7mnVxR3jP5qZbNdYwQ
                  </div>
                </div>
              )}
            </div>

            {/* Action */}
            {isCrypto ? (
              <button
                onClick={handleConfirmPayment}
                disabled={processing}
                className="btn-gold w-full py-4 rounded-lg text-lg tracking-wider disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {processing ? <><Loader2 className="animate-spin" size={20} /> Processing...</> : 'Confirm Payment'}
              </button>
            ) : (
              <div className="space-y-4">
                <label className="glow-box flex items-center justify-center gap-3 py-4 cursor-pointer hover:bg-primary/5 transition-colors">
                  {uploaded ? (
                    <><CheckCircle className="text-primary" size={20} /> <span className="text-primary text-sm">Screenshot uploaded</span></>
                  ) : (
                    <><Upload className="text-primary" size={20} /> <span className="text-muted-foreground text-sm">Upload Payment Screenshot</span></>
                  )}
                  <input type="file" className="hidden" onChange={() => setUploaded(true)} />
                </label>
                <button
                  onClick={handleConfirmPayment}
                  disabled={!uploaded || processing}
                  className="btn-gold w-full py-4 rounded-lg text-lg tracking-wider disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {processing ? <><Loader2 className="animate-spin" size={20} /> Processing...</> : 'Submit Payment'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentPage;
