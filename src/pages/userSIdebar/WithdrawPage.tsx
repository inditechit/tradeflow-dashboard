import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownToLine, Loader2, Wallet, XCircle } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useToast } from "@/hooks/use-toast";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { useUserFinance } from "@/hooks/useUserFinance";
import { getPackageFundWithdrawLock } from "@/utils/trialWithdrawLock";
import { API_BASE } from "@/config/api";
import { ListPaginationBar } from "@/components/trades/TradesPaginationBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MIN_WITHDRAW = 10;
const WITHDRAW_FEE = 5;
const MIN_TOTAL_WITHDRAW = MIN_WITHDRAW + WITHDRAW_FEE;
const WITHDRAW_PAGE_SIZE = 50;

type WithdrawRow = {
  id: number;
  amount_usd: string | number;
  fee_usd?: string | number | null;
  trc20_address: string;
  status: string;
  rejection_reason: string | null;
  outbound_tx_hash: string | null;
  created_at: string;
  completed_at: string | null;
};

const WithdrawPage = () => {
  const { currentUser } = useApp();
  const { toast } = useToast();
  const userId = currentUser?.userId;
  const subscription = useSubscriptionStatus();
  const fundLock = useMemo(
    () =>
      getPackageFundWithdrawLock(
        subscription.isActive,
        subscription.activeSegment,
        subscription.withdrawLock,
      ),
    [
      subscription.isActive,
      subscription.activeSegment,
      subscription.withdrawLock,
    ],
  );

  const { refresh: refreshFinance, ...finance } = useUserFinance(userId);
  const balance = finance.walletBalance;
  const withdrawableEquity = finance.withdrawable;
  const openPositions = finance.openPositions;
  const canWithdraw = finance.canWithdraw;
  const softBust = finance.softBust;
  const [payoutSaved, setPayoutSaved] = useState("");
  const [addressDraft, setAddressDraft] = useState("");
  const [amount, setAmount] = useState("");
  const [rows, setRows] = useState<WithdrawRow[]>([]);
  const [withdrawTotal, setWithdrawTotal] = useState(0);
  const [withdrawPage, setWithdrawPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpMaskedEmail, setOtpMaskedEmail] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpConfirming, setOtpConfirming] = useState(false);
  const [cancelBusyId, setCancelBusyId] = useState<number | null>(null);
  const [kycStatus, setKycStatus] = useState("pending");

  const load = useCallback(async (pageNum = 1) => {
    if (!userId) return;
    setLoading(true);
    try {
      const offset = (pageNum - 1) * WITHDRAW_PAGE_SIZE;
      const [pRes, rRes] = await Promise.all([
        fetch(`${API_BASE}/user/profile/${userId}`),
        fetch(
          `${API_BASE}/user/withdraw/${userId}?limit=${WITHDRAW_PAGE_SIZE}&offset=${offset}&page=${pageNum}`,
        ),
      ]);
      await refreshFinance();
      const pData = await pRes.json();
      if (pData.success && pData.profile) {
        const addr = String(pData.profile.trc20WithdrawAddress ?? "").trim();
        setPayoutSaved(addr);
        if (!addr) setAddressDraft("");
        setKycStatus(String(pData.profile.kycStatus ?? "pending").toLowerCase());
      } else {
        setPayoutSaved("");
        setKycStatus("pending");
      }
      const rData = await rRes.json();
      if (rData.success && Array.isArray(rData.requests)) {
        setRows(rData.requests);
        setWithdrawTotal(Number(rData.total ?? rData.requests.length));
        setWithdrawPage(pageNum);
      } else {
        setRows([]);
        setWithdrawTotal(0);
      }
    } catch {
      toast({ title: "Could not load data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [userId, toast, refreshFinance]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaveAddress = async () => {
    if (!userId) return;
    const trimmed = addressDraft.trim();
    if (!trimmed) {
      toast({
        title: "Address required",
        description: "Enter your trc20 payout address.",
        variant: "destructive",
      });
      return;
    }
    setSavingAddress(true);
    try {
      const res = await fetch(`${API_BASE}/user/profile/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trc20_withdraw_address: trimmed }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Saved", description: "Your trc20 payout address is saved." });
        setAddressDialogOpen(false);
        await load();
      } else {
        toast({
          title: "Could not save",
          description: data.error ?? "Check the address format.",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSavingAddress(false);
    }
  };

  const requestWithdrawOtp = async (amt: number) => {
    const res = await fetch(`${API_BASE}/user/withdraw/${userId}/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: amt }),
    });
    return res.json();
  };

  const handleSubmit = async () => {
    if (!userId) return;
    if (kycStatus !== "verified") {
      toast({
        title: kycStatus === "rejected" ? "KYC rejected" : "KYC required",
        description:
          kycStatus === "rejected"
            ? "Re-upload your documents in Profile, then wait for verification before withdrawing."
            : kycStatus === "submitted"
              ? "Your documents are under review. Withdrawals unlock after KYC is verified."
              : "Complete identity verification in your Profile before withdrawing.",
        variant: "destructive",
      });
      return;
    }
    if (fundLock.locked) {
      toast({
        title: "Withdrawal locked",
        description:
          fundLock.message ??
          "Withdrawals are locked until your package fund-lock period ends.",
        variant: "destructive",
      });
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < MIN_TOTAL_WITHDRAW) {
      toast({
        title: "Invalid amount",
        description: `Minimum withdrawal is $${MIN_WITHDRAW} after the $${WITHDRAW_FEE} fee (enter at least $${MIN_TOTAL_WITHDRAW} total).`,
        variant: "destructive",
      });
      return;
    }
    if (!payoutSaved) {
      setAddressDialogOpen(true);
      toast({
        title: "Add payout address",
        description: "Enter your trc20 wallet address in the popup to continue.",
        variant: "destructive",
      });
      return;
    }
    const maxOut = Math.max(0, finance.withdrawable);
    if (!canWithdraw) {
      toast({
        title: "Open trades active",
        description: "Settle Trade from the dashboard first. Withdrawals are from Safe Wallet only.",
        variant: "destructive",
      });
      return;
    }
    if (amt > maxOut) {
      toast({
        title: "Insufficient balance",
        description: `Amount exceeds your withdrawable balance (max $${maxOut.toFixed(2)} incl. $${WITHDRAW_FEE} fee).`,
        variant: "destructive",
      });
      return;
    }

    setOtpSending(true);
    try {
      const data = await requestWithdrawOtp(amt);
      if (!data.success) {
        toast({
          title: "Could not send code",
          description: data.error ?? "Try again",
          variant: "destructive",
        });
        return;
      }
      setOtpCode("");
      setOtpMaskedEmail(data.maskedEmail ?? data.message ?? "your email");
      setOtpDialogOpen(true);
      toast({
        title: "Verification code sent",
        description: data.message ?? "Check your email for the 6-digit code.",
      });
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setOtpSending(false);
    }
  };

  const handleConfirmOtp = async () => {
    if (!userId) return;
    const amt = Number(amount);
    const code = otpCode.trim();
    if (!code || code.length < 6) {
      toast({
        title: "Enter verification code",
        description: "Enter the 6-digit code from your email.",
        variant: "destructive",
      });
      return;
    }

    setOtpConfirming(true);
    try {
      const res = await fetch(`${API_BASE}/user/withdraw/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, otp: code }),
      });
      const data = await res.json();
      if (!data.success) {
        toast({
          title: "Request failed",
          description: data.error ?? "Try again",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Request submitted",
        description: "An admin will review and send USDT (trc20) to your saved address.",
      });
      setAmount("");
      setOtpDialogOpen(false);
      setOtpCode("");
      load();
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setOtpConfirming(false);
    }
  };

  const handleResendOtp = async () => {
    if (!userId) return;
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < MIN_TOTAL_WITHDRAW) return;
    setOtpSending(true);
    try {
      const data = await requestWithdrawOtp(amt);
      if (!data.success) {
        toast({
          title: "Could not resend code",
          description: data.error ?? "Try again",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Code resent",
        description: data.message ?? "Check your email again.",
      });
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setOtpSending(false);
    }
  };

  const handleCancelRequest = async (requestId: number) => {
    if (!userId) return;
    const ok = window.confirm("Cancel this pending withdrawal request?");
    if (!ok) return;
    setCancelBusyId(requestId);
    try {
      const res = await fetch(`${API_BASE}/user/withdraw/${userId}/${requestId}/cancel`, {
        method: "PATCH",
      });
      const data = await res.json();
      if (!data.success) {
        toast({
          title: "Could not cancel",
          description: data.error ?? "Try again",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Withdrawal cancelled" });
      load(withdrawPage);
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setCancelBusyId(null);
    }
  };

  if (!userId) {
    return null;
  }

  const hasAddress = Boolean(payoutSaved);
  const kycVerified = kycStatus === "verified";
  const kycBlocked = !kycVerified;
  const withdrawBlocked = fundLock.locked || !canWithdraw || openPositions > 0 || kycBlocked;
  const amountNum = Number(amount);
  const payoutPreview =
    Number.isFinite(amountNum) && amountNum > WITHDRAW_FEE
      ? Math.round((amountNum - WITHDRAW_FEE) * 100) / 100
      : 0;
  const unlockLabel = fundLock.unlockAt
    ? new Date(fundLock.unlockAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-0 py-4 sm:px-2 md:px-6 md:py-10">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 sm:text-2xl">
          <ArrowDownToLine className="h-7 w-7 text-neutral-900" aria-hidden />
          Withdraw USDT (trc20)
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Paid plans: outbound USDT typically within 5 seconds to 1 minute after approval. Enter how much
          you want to withdraw — we email a verification code to your registered address before submitting.
        </p>
      </div>

      {kycBlocked && kycStatus === "rejected" && (
        <div className="rounded-2xl border border-red-300 bg-red-50 px-5 py-4 text-sm text-red-950">
          <p className="font-bold text-red-900">Identity verification rejected</p>
          <p className="mt-2">
            Withdrawals are blocked until your documents are approved. Re-upload your live photo, ID proof, and
            address proof, then wait for admin verification.
          </p>
          <Link
            to="/user/profile"
            className="mt-3 inline-flex font-semibold text-red-900 underline underline-offset-2 hover:text-red-800"
          >
            Re-upload documents in Profile
          </Link>
        </div>
      )}

      {kycBlocked && kycStatus !== "rejected" && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-bold text-amber-900">
            {kycStatus === "submitted" ? "KYC under review" : "Complete KYC to withdraw"}
          </p>
          <p className="mt-2">
            {kycStatus === "submitted"
              ? "Your documents are being reviewed. Withdrawals unlock once verification is complete."
              : "Upload your identity documents in Profile before you can withdraw."}
          </p>
          <Link
            to="/user/profile"
            className="mt-3 inline-flex font-semibold text-amber-950 underline underline-offset-2 hover:text-amber-900"
          >
            Go to Profile
          </Link>
        </div>
      )}

      {withdrawBlocked && fundLock.locked && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-bold text-amber-900">
            {fundLock.trialActive ? "Free trial — withdrawals locked" : "Withdrawals locked"}
          </p>
          <p className="mt-2">
            {fundLock.message ??
              "Your funds stay locked during the package fund-lock period. You can stop trading anytime."}
          </p>
          {unlockLabel && (
            <p className="mt-2 font-semibold tabular-nums">
              Unlocks: {unlockLabel}
              {fundLock.daysRemaining > 0
                ? ` (${fundLock.daysRemaining} day${fundLock.daysRemaining === 1 ? "" : "s"} left)`
                : ""}
            </p>
          )}
        </div>
      )}

      {withdrawBlocked && !fundLock.locked && !kycBlocked && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-bold text-amber-900">Withdrawal unavailable</p>
          <p className="mt-2">
            {openPositions > 0
              ? "Close all open copy trades before withdrawing."
              : "Withdrawal is not available right now."}
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 space-y-3 border-b border-slate-100 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-slate-700">
              <Wallet className="h-5 w-5 text-neutral-900" />
              <span className="text-sm font-medium">Account balance (equity)</span>
            </div>
            <p className="text-xl font-bold tabular-nums text-slate-900">
              {loading || finance.loading
                ? "…"
                : `USD ${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-medium text-slate-700">Your withdrawable (USDT)</span>
            <p
              className={`text-2xl font-bold tabular-nums ${
                withdrawableEquity > 0 ? "text-emerald-800" : "text-slate-700"
              }`}
            >
              {loading || finance.loading
                ? "…"
                : `USD ${withdrawableEquity.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
          </div>
          {openPositions > 0 && !loading && !finance.loading && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              You have {openPositions} open trade{openPositions === 1 ? "" : "s"}. Use Settle Trade on
              the dashboard first — withdrawals are from Safe Wallet only and do not take admin share.
            </p>
          )}
          {softBust && openPositions > 0 && !loading && !finance.loading && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              Open trades are in loss — this affects your equity estimate only. Wallet updates when trades close.
            </p>
          )}
          <p className="text-xs text-slate-500">
            You can withdraw your settled wallet balance (minus the ${WITHDRAW_FEE} processing fee).
            While trades are open, withdrawable amount stays unavailable until positions are closed.
          </p>
        </div>

        <div className="space-y-6">
          {/* 1) Amount first */}
          <div className="space-y-2">
            <Label htmlFor="wd-amt" className="text-black">
              Total from wallet (USD)
            </Label>
            <Input
              id="wd-amt"
              type="number"
              min={MIN_TOTAL_WITHDRAW}
              step="0.01"
              placeholder={`Min $${MIN_TOTAL_WITHDRAW}`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="max-w-xs border-slate-200 bg-white text-slate-900"
              disabled={loading || otpSending || otpConfirming || withdrawBlocked}
            />
            <p className="text-xs text-slate-500">
              <strong>${WITHDRAW_FEE} processing fee</strong> per withdrawal. You receive the remainder in USDT
              (trc20).
            </p>
            {amountNum > WITHDRAW_FEE ? (
              <p className="text-sm text-slate-700">
                You receive:{" "}
                <span className="font-semibold tabular-nums text-slate-900">
                  ${payoutPreview.toFixed(2)}
                </span>
                {" · "}
                Fee:{" "}
                <span className="font-semibold tabular-nums text-slate-900">${WITHDRAW_FEE.toFixed(2)}</span>
                {" · "}
                Total deducted:{" "}
                <span className="font-semibold tabular-nums text-slate-900">${amountNum.toFixed(2)}</span>
              </p>
            ) : null}
          </div>

          {!loading && !hasAddress && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3">
              <p className="text-sm text-amber-950">No trc20 payout address saved yet.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-amber-400 bg-white font-semibold text-amber-950 hover:bg-amber-100"
                onClick={() => setAddressDialogOpen(true)}
              >
                Add trc20 address
              </Button>
            </div>
          )}

          {!loading && hasAddress && (
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Saved trc20 address</p>
              <p className="mt-1 break-all font-mono text-sm text-slate-900">{payoutSaved}</p>
              <Link
                to="/user/profile#trc20-payout"
                className="mt-2 inline-block text-sm font-semibold text-neutral-900 underline"
              >
                Change in profile
              </Link>
            </div>
          )}

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={loading || otpSending || otpConfirming || !amount || withdrawBlocked}
            className="gap-2 bg-[#FFD700] text-black hover:bg-[#E6C200]"
          >
            {otpSending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {otpSending ? "Sending code…" : "Continue — verify by email"}
          </Button>
          {!hasAddress && !loading && (
            <p className="text-xs text-slate-500">
              Enter an amount and continue — if no address is saved, a popup will ask for your trc20 wallet.
              A 6-digit code is sent to your profile email before the request is created.
            </p>
          )}
        </div>
      </div>

      <Dialog open={addressDialogOpen} onOpenChange={setAddressDialogOpen}>
        <DialogContent className="z-[100] max-w-md border-slate-200 bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-900">Add trc20 payout address</DialogTitle>
            <DialogDescription className="text-left text-slate-600">
              USDT withdrawals go to this Tron (trc20) address. You can also edit it anytime in profile.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="dlg-trc20" className="text-slate-800">
              trc20 address (starts with T…)
            </Label>
            <Input
              id="dlg-trc20"
              placeholder="TXyz…"
              autoComplete="off"
              spellCheck={false}
              value={addressDraft}
              onChange={(e) => setAddressDraft(e.target.value)}
              className="font-mono text-sm border-slate-200 bg-white text-slate-900"
              disabled={savingAddress}
            />
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <Button type="button" variant="outline" className="w-full border-slate-300 sm:w-auto" asChild>
              <Link to="/user/profile#trc20-payout" onClick={() => setAddressDialogOpen(false)}>
                Open in profile
              </Link>
            </Button>
            <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
              <Button type="button" variant="ghost" onClick={() => setAddressDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={savingAddress || !addressDraft.trim()}
                className="gap-2 bg-[#FFD700] text-black hover:bg-[#E6C200]"
                onClick={handleSaveAddress}
              >
                {savingAddress ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save address
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={otpDialogOpen} onOpenChange={setOtpDialogOpen}>
        <DialogContent className="z-[100] max-w-md border-slate-200 bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-900">Confirm withdrawal</DialogTitle>
            <DialogDescription className="text-left text-slate-600">
              Enter the 6-digit code sent to{" "}
              <span className="font-medium text-slate-800">{otpMaskedEmail || "your email"}</span>.
              The code expires in 5 minutes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="wd-otp" className="text-slate-800">
              Verification code
            </Label>
            <Input
              id="wd-otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="max-w-[10rem] font-mono text-lg tracking-widest border-slate-200 bg-white text-slate-900"
              disabled={otpConfirming}
            />
            <p className="text-xs text-slate-500">
              Withdrawing ${Number(amount || 0).toFixed(2)} total (${payoutPreview.toFixed(2)} payout + $
              {WITHDRAW_FEE.toFixed(2)} fee) to your saved trc20 address.
            </p>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              className="sm:mr-auto"
              disabled={otpSending || otpConfirming}
              onClick={() => void handleResendOtp()}
            >
              {otpSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Resend code
            </Button>
            <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
              <Button type="button" variant="ghost" onClick={() => setOtpDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={otpConfirming || otpCode.trim().length < 6}
                className="gap-2 bg-[#FFD700] text-black hover:bg-[#E6C200]"
                onClick={() => void handleConfirmOtp()}
              >
                {otpConfirming ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Confirm withdrawal
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-sans text-lg font-semibold text-slate-900">Your requests</h2>
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-neutral-900" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500">No withdrawal requests yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-4">When</th>
                  <th className="pb-2 pr-4">You receive</th>
                  <th className="pb-2 pr-4">Fee</th>
                  <th className="pb-2 pr-4">Total</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Tx / note</th>
                  <th className="pb-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const payout = Number(r.amount_usd);
                  const fee = Number(r.fee_usd ?? 0);
                  const total = Math.round((payout + fee) * 100) / 100;
                  return (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="py-3 pr-4 whitespace-nowrap text-slate-600">
                      {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                    </td>
                    <td className="py-3 pr-4 font-semibold tabular-nums text-slate-900">
                      ${payout.toFixed(2)}
                    </td>
                    <td className="py-3 pr-4 tabular-nums text-slate-600">
                      {fee > 0 ? `$${fee.toFixed(2)}` : "—"}
                    </td>
                    <td className="py-3 pr-4 font-semibold tabular-nums text-slate-900">
                      ${total.toFixed(2)}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${
                          r.status === "completed"
                            ? "border-yellow-200 bg-[#FFF9E6] text-neutral-900"
                            : r.status === "pending"
                              ? "border-amber-200 bg-amber-50 text-amber-900"
                              : r.status === "cancelled"
                                ? "border-slate-200 bg-slate-100 text-slate-700"
                                : "border-red-200 bg-red-50 text-red-900"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-600">
                      {r.status === "rejected" && r.rejection_reason ? (
                        <span className="text-sm text-red-800">{r.rejection_reason}</span>
                      ) : r.status === "cancelled" ? (
                        <span className="text-sm text-slate-600">
                          {r.rejection_reason ?? "Cancelled by you"}
                        </span>
                      ) : r.outbound_tx_hash ? (
                        <a
                          href={`https://tronscan.org/#/transaction/${encodeURIComponent(r.outbound_tx_hash)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="break-all font-mono text-xs text-neutral-800 underline"
                        >
                          {r.outbound_tx_hash}
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3">
                      {r.status === "pending" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={cancelBusyId === r.id}
                          className="gap-1 border-red-200 text-red-700 hover:bg-red-50"
                          onClick={() => void handleCancelRequest(r.id)}
                        >
                          {cancelBusyId === r.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5" />
                          )}
                          Cancel
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
            <ListPaginationBar
              page={withdrawPage}
              totalPages={Math.max(1, Math.ceil(withdrawTotal / WITHDRAW_PAGE_SIZE))}
              total={withdrawTotal}
              pageSize={WITHDRAW_PAGE_SIZE}
              onPageChange={(p) => void load(p)}
              itemLabel="requests"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default WithdrawPage;
