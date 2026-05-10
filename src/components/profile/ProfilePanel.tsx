import { useCallback, useEffect, useState } from "react";
import { Loader2, Save, User, MapPin, Shield, Camera, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const API_BASE = "https://mt5api.inditechit.com/api";

/** Light fields — global theme uses dark `background`; profile cards are light paper. */
const fieldInputClass =
  "mt-2 h-11 rounded-lg border-slate-200 bg-white text-slate-900 shadow-sm placeholder:text-slate-400 " +
  "focus-visible:border-neutral-900 focus-visible:ring-2 focus-visible:ring-yellow-500/30 " +
  "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-600 disabled:opacity-100";

const fieldLabelClass = "text-sm font-medium text-slate-700";

export function proofImageSrc(raw: string | null | undefined): string | null {
  if (!raw || raw === "permissions_granted") return null;
  if (raw.length < 40) return null;
  if (raw.startsWith("data:")) return raw;
  return `data:image/jpeg;base64,${raw}`;
}

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
          mobile: form.mobile,
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

  const viewerIsOwner = String(currentUser?.userId ?? "") === String(targetUserId);
  const isAdmin = currentUser?.role === "admin";
  const canEdit = viewerIsOwner || isAdmin;

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
                    ? "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/80"
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
          </div>
        </div>
      </div>

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
              disabled={!canEdit}
              onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
              className={fieldInputClass}
            />
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
              className="gap-2 bg-neutral-950 text-[#FFD700] hover:bg-black"
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
          subtitle="Take a selfie with your camera only — picking from the gallery is not allowed."
          src={liveSrc}
          canUpload={canEdit}
          disabled={saving}
          facingMode="user"
          onCaptured={(dataUrl) => uploadDoc("livePhotoBase64", dataUrl)}
        />

        <DocBlock
          title="ID proof"
          subtitle="Photograph your government ID with the camera — gallery upload is not used."
          src={idSrc}
          canUpload={canEdit}
          disabled={saving}
          facingMode="environment"
          onCaptured={(dataUrl) => uploadDoc("idProofBase64", dataUrl)}
        />

        <DocBlock
          title="Address proof"
          subtitle="Photograph your document with the camera — gallery upload is not used."
          src={addrSrc}
          canUpload={canEdit}
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
  disabled,
  facingMode,
  onCaptured,
}: {
  title: string;
  subtitle: string;
  src: string | null;
  canUpload: boolean;
  disabled: boolean;
  facingMode: "user" | "environment";
  onCaptured: (dataUrl: string) => void;
}) {
  const [cameraOpen, setCameraOpen] = useState(false);

  return (
    <div className="border border-slate-100 rounded-xl p-5 bg-slate-50/60">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="space-y-1">
          <p className="font-sans font-semibold text-slate-900">{title}</p>
          <p className="text-xs leading-relaxed text-slate-600">{subtitle}</p>
        </div>
        {canUpload && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 touch-manipulation border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
              disabled={disabled}
              onClick={() => setCameraOpen(true)}
            >
              <Camera className="h-4 w-4" />
              {src ? "Replace (camera)" : "Take with camera"}
            </Button>
            <LiveCameraCaptureDialog
              open={cameraOpen}
              onOpenChange={setCameraOpen}
              facingMode={facingMode}
              title={title}
              onCaptured={onCaptured}
            />
          </>
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
