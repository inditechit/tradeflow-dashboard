import React, { useState, useEffect } from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  initialBalance: number | string;
  onUpdate: (balance: string) => void;
  isLoading: boolean;
}

const WalletModal: React.FC<Props> = ({
  isOpen,
  onClose,
  user,
  initialBalance,
  onUpdate,
  isLoading
}) => {
  const [balance, setBalance] = useState<string>("");

  // Sync the local state with the fetched balance when the modal opens
  useEffect(() => {
    if (isOpen) {
      setBalance(initialBalance !== null ? String(initialBalance) : "");
    }
  }, [isOpen, initialBalance]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    onUpdate(balance);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b pb-4 mb-6">
          <h2 className="text-xl font-bold text-slate-900">
            Wallet Balance
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-red-500 text-lg"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="py-8 text-center text-slate-500 animate-pulse">
            Fetching wallet data...
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Editing User</p>
              <p className="text-slate-800 font-medium">{user?.name} ({user?.email})</p>
            </div>

            <div>
              <label className="label block text-sm font-bold text-slate-700 mb-2">
                Balance (USD)
              </label>
              <input 
                type="number"
                step="0.01"
                placeholder="0.00"
                value={balance} 
                onChange={(e) => setBalance(e.target.value)} 
                className="w-full px-4 py-3 rounded-xl border text-black border-slate-200 focus:border-neutral-900 focus:ring-2 focus:ring-yellow-200 transition-all outline-none" 
              />
              <p className="text-xs text-slate-400 mt-2">
                Leave blank or enter 0 to reset balance to $0.00.
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-3 mt-8 pt-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-medium hover:bg-slate-200"
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-5 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow disabled:opacity-50"
          >
            Save Balance
          </button>
        </div>

      </div>
    </div>
  );
};

export default WalletModal;