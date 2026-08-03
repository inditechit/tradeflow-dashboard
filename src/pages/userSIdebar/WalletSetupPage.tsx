import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Loader2, Wallet, ArrowRight, CheckCircle2 } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { API_BASE } from "@/config/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

/**
 * Asked once after first package purchase if TRC20 payout address is missing.
 */
export default function WalletSetupPage() {
  const { currentUser } = useApp();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [address, setAddress] = useState("");
  const [existing, setExisting] = useState("");

  const load = useCallback(async () => {
    const uid = currentUser?.userId;
    if (!uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/user/profile/${uid}`);
      const data = await res.json();
      const addr = String(data?.profile?.trc20WithdrawAddress ?? "").trim();
      setExisting(addr);
      setAddress(addr);
      if (addr) {
        // Already set — no need to stay here
        navigate("/user/dashboard", { replace: true });
      }
    } catch {
      /* allow manual entry */
    } finally {
      setLoading(false);
    }
  }, [currentUser?.userId, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!currentUser?.userId) {
    return <Navigate to="/login" replace />;
  }

  const save = async () => {
    const value = address.trim();
    if (!value) {
      toast({ title: "Enter your USDT TRC20 address", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/user/profile/${currentUser.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trc20_withdraw_address: value }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        toast({
          title: "Could not save address",
          description: data?.error || "Check the address and try again.",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Wallet saved", description: "You can update it later in Settings." });
      navigate("/user/dashboard", { replace: true });
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg py-6 sm:py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-yellow-50 px-3 py-1 text-xs font-semibold text-neutral-900 ring-1 ring-yellow-200">
          <Wallet className="h-4 w-4" />
          Payout wallet
        </div>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">Add your USDT address</h1>
        <p className="mt-2 text-sm text-slate-600">
          Package purchase is complete. Add your{" "}
          <strong className="font-medium text-slate-800">USDT TRC20</strong> (TRON) wallet so
          withdrawals can be paid to you. Double-check — wrong addresses cannot be reversed.
        </p>

        {existing ? (
          <p className="mt-4 flex items-center gap-2 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Address already on file
          </p>
        ) : null}

        <div className="mt-6 space-y-2">
          <Label htmlFor="wallet-trc20" className="text-sm font-medium text-slate-700">
            TRC20 address (starts with T…)
          </Label>
          <Input
            id="wallet-trc20"
            className="h-11 font-mono text-sm"
            placeholder="TXyz…"
            autoComplete="off"
            spellCheck={false}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            className="flex-1 bg-[#FFD700] font-bold text-black hover:bg-[#E6C200]"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              <>
                Save & continue <ArrowRight className="ml-1 h-4 w-4" />
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-slate-200"
            disabled={saving}
            onClick={() => navigate("/user/dashboard", { replace: true })}
          >
            Skip for now
          </Button>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          You can change this anytime in Settings.
        </p>
      </div>
    </div>
  );
}
