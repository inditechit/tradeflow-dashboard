import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Save, User, MapPin, Shield, Camera, ImageIcon, Wallet, KeyRound, ShieldBan } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useApp } from "@/context/AppContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LiveCameraCaptureDialog } from "@/components/profile/LiveCameraCaptureDialog";
import { notifyProfileComplianceRefresh } from "@/utils/profileComplianceEvents";
import { proofImageSrc } from "@/utils/userImageUrl";

export { proofImageSrc } from "@/utils/userImageUrl";

/** Light fields — global theme uses dark `background`; profile cards are light paper. */
const fieldInputClass =
  "mt-2 h-11 rounded-lg border-slate-200 bg-white text-slate-900 shadow-sm placeholder:text-slate-400 " +
  "focus-visible:border-neutral-900 focus-visible:ring-2 focus-visible:ring-yellow-500/30 " +
  "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-600 disabled:opacity-100";

const fieldLabelClass = "text-sm font-medium text-slate-700";

const API_BASE = "https://api.copytradeengine.org/api";

export type ProfilePanelProps = {
  targetUserId: string;
  /** Admin UI: KYC status control + view any user */
  showAdminExtras?: boolean;
};

export function ProfilePanel({ targetUserId, showAdminExtras }: ProfilePanelProps) {
  const { currentUser } = useApp();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);

  const [form, setForm] = useState({
    name: "",
    mobile: "",
    country: "",
    state: "",
    city: "",
    pincode: "",
    address: "",
    trc20WithdrawAddress: "",
  });

  const [pwdOtp, setPwdOtp] = useState("");
  const [pwdNew, setPwdNew] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [pwdSending, setPwdSending] = useState(false);
  const [pwdSubmitting, setPwdSubmitting] = useState(false);
  const [affiliateTierCycles, setAffiliateTierCycles] = useState(1);
  const [affiliateTierSaving, setAffiliateTierSaving] = useState(false);
  const [blockAccess, setBlockAccess] = useState<Record<string, unknown> | null>(null);
  const [blockReason, setBlockReason] = useState("Blocked by admin");
  const [blockBusy, setBlockBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/user/profile/${targetUserId}`);
      const data = await res.json();
      if (!data.success || !data.profile) {
        toast({ title: "Could not load profile", variant: "destructive" });
        setProfile(null);
        return;
      }
      const p = data.profile as Record<string, unknown>;
      setProfile(p);
      setForm({
        name: String(p.name ?? ""),
        mobile: String(p.mobile ?? ""),
        country: String(p.country ?? ""),
        state: String(p.state ?? ""),
        city: String(p.city ?? ""),
        pincode: String(p.pincode ?? ""),
        address: String(p.address ?? ""),
        trc20WithdrawAddress: String(p.trc20WithdrawAddress ?? ""),
      });
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [targetUserId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!showAdminExtras || !targetUserId) return;
    const loadAffiliate = async () => {
      try {
        const res = await fetch(`${API_BASE}/user/affiliate/summary/${targetUserId}`);
        const data = await res.json();
        if (data.success) {
          setAffiliateTierCycles(Number(data.affiliateTierCycles ?? 1) || 1);
        }
      } catch {
        /* optional */
      }
    };
    loadAffiliate();
  }, [showAdminExtras, targetUserId]);

  useEffect(() => {
    if (!showAdminExtras || !targetUserId) return;
    const loadBlock = async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/users/${targetUserId}/block`);
        const data = await res.json();
        if (data.success) setBlockAccess(data.access ?? null);
      } catch {
        /* optional */
      }
    };
    loadBlock();
  }, [showAdminExtras, targetUserId]);

  const blockUser = async () => {
    if (!targetUserId) return;
    setBlockBusy(true);
    try {
      const res = await fetch(`${API_BASE}/admin/users/${targetUserId}/block`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminId: currentUser?.userId,
          reason: blockReason,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        toast({ title: "Block failed", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "User blocked", description: "Trading continues until package expires; no new packages." });
      setBlockAccess(data.access ?? { block_status: data.block_status ?? "blocked" });
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setBlockBusy(false);
    }
  };

  const unblockUser = async () => {
    if (!targetUserId) return;
    setBlockBusy(true);
    try {
      const res = await fetch(`${API_BASE}/admin/users/${targetUserId}/unblock`, { method: "POST" });
      const data = await res.json();
      if (!data.success) {
        toast({ title: "Unblock failed", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "User unblocked" });
      setBlockAccess({ block_status: "none" });
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setBlockBusy(false);
    }
  };

  /** Deep-link from withdraw flow: /user/profile#trc20-payout */
  const scrollToTrc20 = useCallback(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (hash !== "trc20-payout") return;
    window.setTimeout(() => {
      document.getElementById("trc20-payout")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 150);
  }, []);

  useEffect(() => {
    if (loading || !profile) return;
    scrollToTrc20();
  }, [loading, profile, scrollToTrc20]);

  useEffect(() => {
    const onHashChange = () => {
      if (!profile) return;
      scrollToTrc20();
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [profile, scrollToTrc20]);

  const handleSaveDetails = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/user/profile/${targetUserId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          mobile: form.mobile.trim(),
          country: form.country,
          state: form.state,
          city: form.city,
          pincode: form.pincode,
          address: form.address,
          trc20_withdraw_address: form.trc20WithdrawAddress.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Saved", description: "Profile details updated." });
        load();
        notifyProfileComplianceRefresh();
      } else {
        toast({ title: "Save failed", description: data.error ?? "Try again", variant: "destructive" });
      }
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const uploadDoc = async (
    field: "livePhotoBase64" | "idProofBase64" | "addressProofBase64",
    dataUrl: string,
  ) => {
    setSaving(true);
    try {
      const body: Record<string, string> = { [field]: dataUrl };
      const res = await fetch(`${API_BASE}/user/profile/${targetUserId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Uploaded", description: "Document saved." });
        load();
        notifyProfileComplianceRefresh();
      } else {
        toast({ title: "Upload failed", description: data.error ?? "", variant: "destructive" });
      }
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveKycStatus = async (status: string) => {
    if (!showAdminExtras) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/admin/update-user/${targetUserId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kyc_status: status }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "KYC status updated" });
        load();
      } else {
        toast({ title: "Update failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Update failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveAffiliateTierCycles = async () => {
    if (!showAdminExtras || currentUser?.role !== "admin") return;
    const n = Math.floor(Number(affiliateTierCycles));
    if (!Number.isFinite(n) || n < 1 || n > 100) {
      toast({ title: "Invalid value", description: "Use 1–100 tier cycles.", variant: "destructive" });
      return;
    }
    setAffiliateTierSaving(true);
    try {
      const res = await fetch(`${API_BASE}/admin/users/${targetUserId}/affiliate-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ affiliate_tier_cycles: n }),
      });
      const data = await res.json();
      if (data.success) {
        setAffiliateTierCycles(Number(data.affiliate_tier_cycles ?? n));
        toast({
          title: "Refer-a-friend cycles updated",
          description: `${n} cycle(s) × 4 tier referrals before 10% flat.`,
        });
      } else {
        toast({ title: "Update failed", description: data.error ?? "", variant: "destructive" });
      }
    } catch {
      toast({ title: "Update failed", variant: "destructive" });
    } finally {
      setAffiliateTierSaving(false);
    }
  };

  const viewerIsOwner = String(currentUser?.userId ?? "") === String(targetUserId);
  const isAdmin = currentUser?.role === "admin";
  const canEdit = viewerIsOwner || isAdmin;

  const sendPasswordChangeOtp = async () => {
    if (!viewerIsOwner) return;
    setPwdSending(true);
    try {
      const res = await fetch(`${API_BASE}/user/password-change/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: Number(targetUserId) }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Code sent", description: data.message ?? "Check your email." });
      } else {
        toast({
          title: "Could not send code",
          description: data.error ?? "",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setPwdSending(false);
    }
  };

  const confirmPasswordChange = async () => {
    if (!viewerIsOwner) return;
    if (pwdNew.length < 6) {
      toast({ title: "Password too short", description: "Use at least 6 characters.", variant: "destructive" });
      return;
    }
    if (pwdNew !== pwdConfirm) {
      toast({ title: "Mismatch", description: "New passwords do not match.", variant: "destructive" });
      return;
    }
    if (!pwdOtp.trim()) {
      toast({ title: "Code required", description: "Enter the email verification code.", variant: "destructive" });
      return;
    }
    setPwdSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/user/password-change/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: Number(targetUserId),
          otp: pwdOtp.trim(),
          newPassword: pwdNew,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Password updated", description: data.message ?? "Use your new password at login." });
        setPwdOtp("");
        setPwdNew("");
        setPwdConfirm("");
      } else {
        toast({
          title: "Update failed",
          description: data.error ?? "",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setPwdSubmitting(false);
    }
  };

  if (loading && !profile) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500 gap-2">
        <Loader2 className="animate-spin h-5 w-5" /> Loading profile…
      </div>
    );
  }

  if (!profile) {
    return <p className="text-center text-slate-500 py-12">Profile not found.</p>;
  }

  const liveSrc = proofImageSrc(profile.livePhotoData as string);
  const idSrc = proofImageSrc(profile.idProofData as string);
  const addrSrc = proofImageSrc(profile.addressProofData as string);
  const kycStatus = String(profile.kycStatus ?? "pending");
  const kycRejected = kycStatus === "rejected";
  const ownerCanReplaceDocs = viewerIsOwner && !isAdmin && kycRejected;

  return (
    <div className="font-sans w-full min-w-0 max-w-4xl space-y-6 text-slate-800 sm:space-y-8">
      {/* Summary */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <h2 className="font-sans text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <User className="shrink-0 text-neutral-900" size={22} aria-hidden />
              Account
            </h2>
            <p className="text-sm text-slate-600">
              User ID <span className="font-mono font-semibold text-slate-800">{String(profile.id)}</span>
              {profile.telegram ? (
                <>
                  {" "}
                  · <span className="text-neutral-800">@{String(profile.telegram)}</span>
                </>
              ) : null}
            </p>
            <p className="text-sm text-slate-700">
              <span className="font-medium text-slate-500">Email</span>
              <span className="mx-2 text-slate-300">·</span>
              {String(profile.email ?? "—")}
            </p>
            <p className="text-sm text-slate-700">
              <span className="font-medium text-slate-500">Joined</span>
              <span className="mx-2 text-slate-300">·</span>
              {profile.createdAt
                ? new Date(String(profile.createdAt)).toLocaleString()
                : "—"}
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50/90 p-4 lg:max-w-sm lg:shrink-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Verification</p>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex text-xs font-semibold uppercase tracking-wide px-3 py-1.5 rounded-full ${
                  kycStatus === "verified"
                    ? "bg-[#FFF9E6] text-neutral-900 ring-1 ring-yellow-200/80"
                    : kycStatus === "submitted"
                      ? "bg-amber-100 text-amber-900 ring-1 ring-amber-200/80"
                      : kycStatus === "rejected"
                        ? "bg-red-100 text-red-900 ring-1 ring-red-200/80"
                        : "bg-white text-slate-700 ring-1 ring-slate-200"
                }`}
              >
                KYC: {kycStatus}
              </span>
            </div>
            {showAdminExtras && isAdmin && (
              <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
                <Label htmlFor="kyc-status" className={`${fieldLabelClass} shrink-0`}>
                  Set status
                </Label>
                <Select value={kycStatus} onValueChange={saveKycStatus} disabled={saving}>
                  <SelectTrigger
                    id="kyc-status"
                    className="h-10 w-full border-slate-200 bg-white text-slate-900 shadow-sm sm:w-[200px]"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-slate-200 bg-white">
                    <SelectItem value="pending">pending</SelectItem>
                    <SelectItem value="submitted">submitted</SelectItem>
                    <SelectItem value="verified">verified</SelectItem>
                    <SelectItem value="rejected">rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {viewerIsOwner && !isAdmin && kycRejected && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950">
                <p className="font-semibold text-red-900">Verification rejected</p>
                <p className="mt-1">
                  Re-upload your live photo, ID proof, and address proof below. Withdrawals stay blocked until
                  an admin verifies your documents again.
                </p>
              </div>
            )}
            {showAdminExtras && isAdmin && (
              <div className="mt-4 border-t border-slate-200 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Refer a friend
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Tier bonus cycles before 10% flat (each cycle = 4 direct referrals&apos; first packages).
                </p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <Label htmlFor="aff-tier-cycles" className={fieldLabelClass}>
                      Tier cycles (N × 4 referrals)
                    </Label>
                    <Input
                      id="aff-tier-cycles"
                      type="number"
                      min={1}
                      max={100}
                      value={affiliateTierCycles}
                      onChange={(e) => setAffiliateTierCycles(Number(e.target.value))}
                      className={fieldInputClass}
                      disabled={affiliateTierSaving}
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-[#FFD700] font-semibold text-black hover:bg-[#E6C200]"
                    disabled={affiliateTierSaving}
                    onClick={saveAffiliateTierCycles}
                  >
                    {affiliateTierSaving ? "Saving…" : "Save cycles"}
                  </Button>
                </div>
              </div>
            )}
            {showAdminExtras && isAdmin && (
              <div className="mt-4 border-t border-slate-200 pt-4">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <ShieldBan className="h-3.5 w-3.5" aria-hidden />
                  Account block
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Blocked users cannot buy new packages. Trading and settlement continue until their current
                  package expires. After expiry they may withdraw remaining balance only; after final withdrawal
                  the account is permanently blocked (email, mobile, device).
                </p>
                <p className="mt-2 text-sm font-medium text-slate-800">
                  Status:{" "}
                  <span
                    className={
                      String(blockAccess?.block_status ?? "none") === "permanent"
                        ? "text-red-700"
                        : String(blockAccess?.block_status ?? "none") === "withdraw_only" ||
                            String(blockAccess?.block_status ?? "none") === "blocked"
                          ? "text-amber-700"
                          : "text-emerald-700"
                    }
                  >
                    {String(blockAccess?.block_status ?? "none")}
                    {String(blockAccess?.block_status ?? "none") === "blocked"
                      ? " (trading active)"
                      : ""}
                  </span>
                </p>
                {String(blockAccess?.block_status ?? "none") === "none" ? (
                  <div className="mt-3 space-y-2">
                    <Label htmlFor="block-reason" className={fieldLabelClass}>
                      Reason (internal)
                    </Label>
                    <Input
                      id="block-reason"
                      value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                      className={fieldInputClass}
                      disabled={blockBusy}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={blockBusy}
                      onClick={blockUser}
                    >
                      {blockBusy ? "Blocking…" : "Block user"}
                    </Button>
                  </div>
                ) : String(blockAccess?.block_status ?? "none") === "permanent" ? (
                  <p className="mt-2 text-xs text-red-700">
                    Permanently blocked. Unblock only if this was a mistake.
                  </p>
                ) : null}
                {String(blockAccess?.block_status ?? "none") !== "none" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-3 border-slate-200"
                    disabled={blockBusy}
                    onClick={unblockUser}
                  >
                    {blockBusy ? "Working…" : "Unblock user"}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {viewerIsOwner ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 font-sans text-lg font-semibold tracking-tight text-slate-900">
            <KeyRound className="h-5 w-5 shrink-0 text-neutral-900" aria-hidden />
            Password
          </h3>
          {String(profile.email ?? "").trim() === "" ? (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Add an email above to reset your password with a code.
            </p>
          ) : (
            <div className="space-y-4">
              <Button
                type="button"
                variant="outline"
                className="border-slate-200"
                disabled={pwdSending || pwdSubmitting}
                onClick={sendPasswordChangeOtp}
              >
                {pwdSending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
                  </>
                ) : (
                  "Send verification code to email"
                )}
              </Button>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-0">
                  <Label htmlFor="pf-pwd-otp" className={fieldLabelClass}>
                    Email code
                  </Label>
                  <Input
                    id="pf-pwd-otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={pwdOtp}
                    onChange={(e) => setPwdOtp(e.target.value)}
                    disabled={pwdSubmitting}
                    className={`${fieldInputClass} font-mono tracking-widest`}
                    placeholder="6-digit code"
                  />
                </div>
                <div />
                <div className="space-y-0">
                  <Label htmlFor="pf-pwd-new" className={fieldLabelClass}>
                    New password
                  </Label>
                  <PasswordInput
                    id="pf-pwd-new"
                    autoComplete="new-password"
                    value={pwdNew}
                    onChange={(e) => setPwdNew(e.target.value)}
                    disabled={pwdSubmitting}
                    className={fieldInputClass}
                  />
                </div>
                <div className="space-y-0">
                  <Label htmlFor="pf-pwd-confirm" className={fieldLabelClass}>
                    Confirm new password
                  </Label>
                  <PasswordInput
                    id="pf-pwd-confirm"
                    autoComplete="new-password"
                    value={pwdConfirm}
                    onChange={(e) => setPwdConfirm(e.target.value)}
                    disabled={pwdSubmitting}
                    className={fieldInputClass}
                  />
                </div>
              </div>
              <Button
                type="button"
                className="bg-[#FFD700] font-semibold text-black hover:bg-[#E6C200]"
                disabled={pwdSubmitting}
                onClick={confirmPasswordChange}
              >
                {pwdSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating…
                  </>
                ) : (
                  "Update password"
                )}
              </Button>
            </div>
          )}
        </div>
      ) : null}

      {/* Editable details */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="font-sans text-lg font-semibold tracking-tight text-slate-900 mb-6 flex items-center gap-2">
          <MapPin className="shrink-0 text-neutral-900" size={20} aria-hidden />
          Contact & address
        </h3>
        <div className="grid sm:grid-cols-2 gap-x-5 gap-y-6">
          <div className="space-y-0">
            <Label htmlFor="pf-name" className={fieldLabelClass}>
              Full name
            </Label>
            <Input
              id="pf-name"
              value={form.name}
              disabled={!canEdit}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={fieldInputClass}
            />
          </div>
          <div className="space-y-0">
            <Label htmlFor="pf-mobile" className={fieldLabelClass}>
              Mobile
            </Label>
            <Input
              id="pf-mobile"
              value={form.mobile}
              disabled={!canEdit || Boolean(String(profile?.mobile ?? "").trim())}
              readOnly={Boolean(String(profile?.mobile ?? "").trim())}
              onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
              className={fieldInputClass}
            />
            <p className="text-xs text-slate-500 mt-1">
              {String(profile?.mobile ?? "").trim()
                ? "Mobile number cannot be changed once saved."
                : "Add your mobile number here (required for compliance)."}
            </p>
          </div>
          <div className="space-y-0">
            <Label htmlFor="pf-country" className={fieldLabelClass}>
              Country
            </Label>
            <Input
              id="pf-country"
              value={form.country}
              disabled={!canEdit}
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
              className={fieldInputClass}
            />
          </div>
          <div className="space-y-0">
            <Label htmlFor="pf-state" className={fieldLabelClass}>
              State / region
            </Label>
            <Input
              id="pf-state"
              value={form.state}
              disabled={!canEdit}
              onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
              className={fieldInputClass}
            />
          </div>
          <div className="space-y-0">
            <Label htmlFor="pf-city" className={fieldLabelClass}>
              City
            </Label>
            <Input
              id="pf-city"
              value={form.city}
              disabled={!canEdit}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              className={fieldInputClass}
            />
          </div>
          <div className="space-y-0">
            <Label htmlFor="pf-pin" className={fieldLabelClass}>
              Pincode
            </Label>
            <Input
              id="pf-pin"
              value={form.pincode}
              disabled={!canEdit}
              onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))}
              className={fieldInputClass}
            />
          </div>
        </div>
    
    {currentUser?.role === "admin" && (
        <div className="mt-6 space-y-0">
          <Label htmlFor="pf-addr" className={fieldLabelClass}>
            Full address
          </Label>
          <Input
            id="pf-addr"
            value={form.address}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            className={fieldInputClass}
          />
        </div>
    )}

        <div
          id="trc20-payout"
          className="scroll-mt-24 mt-8 border-t border-slate-100 pt-8"
        >
          <h4 className="mb-2 flex items-center gap-2 font-sans text-base font-semibold text-slate-900">
            <Wallet className="h-5 w-5 shrink-0 text-neutral-900" aria-hidden />
            USDT trc20 payout address
          </h4>
          <p className="mb-4 text-sm leading-relaxed text-slate-600">
            Withdrawals are paid in{" "}
            <strong className="font-medium text-slate-800">USDT on the TRON network (trc20)</strong>.
            Enter the wallet address where you want to receive funds. Verify it carefully—wrong addresses cannot be reversed.
          </p>
          <div className="space-y-0">
            <Label htmlFor="pf-trc20" className={fieldLabelClass}>
              trc20 address (starts with T…)
            </Label>
            <Input
              id="pf-trc20"
              placeholder="TXyz…"
              autoComplete="off"
              spellCheck={false}
              value={form.trc20WithdrawAddress}
              disabled={!canEdit}
              onChange={(e) => setForm((f) => ({ ...f, trc20WithdrawAddress: e.target.value }))}
              className={`${fieldInputClass} font-mono text-sm`}
            />
          </div>
        </div>

        {canEdit && (
          <div className="mt-8 pt-2">
            <Button
              type="button"
              onClick={handleSaveDetails}
              disabled={saving}
              className="gap-2 bg-[#FFD700] text-black hover:bg-[#E6C200]"
            >
              {saving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
              Save details
            </Button>
          </div>
        )}
      </div>

      {/* KYC */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <h3 className="font-sans text-lg font-semibold tracking-tight text-slate-900 flex items-center gap-2">
          <Shield className="shrink-0 text-neutral-900" size={20} aria-hidden />
          Identity & proofs
        </h3>

        <DocBlock
          title="Live photo"
          subtitle={
            ownerCanReplaceDocs
              ? "Re-upload a clear selfie — your previous photo was rejected."
              : liveSrc && viewerIsOwner && !isAdmin
                ? "Your live photo is on file. Contact support if it needs to change."
                : "Upload a clear selfie — take a photo with the camera or choose one from your gallery."
          }
          src={liveSrc}
          canUpload={isAdmin || (viewerIsOwner && (!liveSrc || kycRejected))}
          locked={Boolean(liveSrc) && viewerIsOwner && !isAdmin && !kycRejected}
          disabled={saving}
          facingMode="user"
          onCaptured={(dataUrl) => uploadDoc("livePhotoBase64", dataUrl)}
        />

        <DocBlock
          title="ID proof"
          subtitle={
            ownerCanReplaceDocs
              ? "Re-upload a clear photo of your government ID."
              : idSrc && viewerIsOwner && !isAdmin
                ? "Your ID proof is on file. Contact support if it needs to change."
                : "Photograph your government ID with the camera, or choose a photo from your gallery."
          }
          src={idSrc}
          canUpload={isAdmin || (viewerIsOwner && (!idSrc || kycRejected))}
          locked={Boolean(idSrc) && viewerIsOwner && !isAdmin && !kycRejected}
          disabled={saving}
          facingMode="environment"
          onCaptured={(dataUrl) => uploadDoc("idProofBase64", dataUrl)}
        />

        <DocBlock
          title="Address proof"
          subtitle={
            ownerCanReplaceDocs
              ? "Re-upload a clear photo of your address proof."
              : addrSrc && viewerIsOwner && !isAdmin
                ? "Your address proof is on file. Contact support if it needs to change."
                : "Photograph your document with the camera, or choose a photo from your gallery."
          }
          src={addrSrc}
          canUpload={isAdmin || (viewerIsOwner && (!addrSrc || kycRejected))}
          locked={Boolean(addrSrc) && viewerIsOwner && !isAdmin && !kycRejected}
          disabled={saving}
          facingMode="environment"
          onCaptured={(dataUrl) => uploadDoc("addressProofBase64", dataUrl)}
        />
      </div>
    </div>
  );
}

function DocBlock({
  title,
  subtitle,
  src,
  canUpload,
  locked,
  disabled,
  facingMode,
  onCaptured,
}: {
  title: string;
  subtitle: string;
  src: string | null;
  canUpload: boolean;
  locked?: boolean;
  disabled: boolean;
  facingMode: "user" | "environment";
  onCaptured: (dataUrl: string) => void;
}) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleGalleryPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") onCaptured(result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="border border-slate-100 rounded-xl p-5 bg-slate-50/60">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="space-y-1">
          <p className="font-sans font-semibold text-slate-900">{title}</p>
          <p className="text-xs leading-relaxed text-slate-600">{subtitle}</p>
        </div>
        {locked && (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">
            <Camera className="h-3 w-3" /> On file
          </span>
        )}
        {canUpload && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 touch-manipulation border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
              disabled={disabled}
              onClick={() => setCameraOpen(true)}
            >
              <Camera className="h-4 w-4" />
              {src ? "Retake" : "Camera"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 touch-manipulation border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
              disabled={disabled}
              onClick={() => galleryInputRef.current?.click()}
            >
              <ImageIcon className="h-4 w-4" />
              {src ? "Replace from gallery" : "Gallery"}
            </Button>
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleGalleryPick}
            />
            <LiveCameraCaptureDialog
              open={cameraOpen}
              onOpenChange={setCameraOpen}
              facingMode={facingMode}
              title={title}
              onCaptured={onCaptured}
            />
          </div>
        )}
      </div>
      <div className="rounded-lg overflow-hidden bg-slate-100 ring-1 ring-inset ring-slate-200/80 min-h-[160px] flex items-center justify-center">
        {src ? (
          <img src={src} alt={title} className="max-h-64 w-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-2 py-8 text-slate-400">
            <Camera size={28} />
            <span className="text-sm">No image on file</span>
          </div>
        )}
      </div>
    </div>
  );
}
