import { useCallback, useEffect, useState } from "react";
import { Loader2, Save, Upload, User, MapPin, Shield, Camera } from "lucide-react";
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

const API_BASE = "https://mt5api.inditechit.com/api";

export function proofImageSrc(raw: string | null | undefined): string | null {
  if (!raw || raw === "permissions_granted") return null;
  if (raw.length < 40) return null;
  if (raw.startsWith("data:")) return raw;
  return `data:image/jpeg;base64,${raw}`;
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(file);
  });
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

  const handleSaveDetails = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/user/profile/${targetUserId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
    file: File,
  ) => {
    const dataUrl = await fileToDataUrl(file);
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
    <div className="space-y-10 max-w-4xl">
      {/* Summary */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <User className="text-cyan-600" size={22} />
              Account
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              User ID <span className="font-mono font-semibold">{String(profile.id)}</span>
              {profile.telegram ? (
                <>
                  {" "}
                  · @{String(profile.telegram)}
                </>
              ) : null}
            </p>
            <p className="text-sm text-slate-600 mt-2">
              <span className="text-slate-400">Email:</span> {String(profile.email ?? "—")}
            </p>
            <p className="text-sm text-slate-600">
              <span className="text-slate-400">Joined:</span>{" "}
              {profile.createdAt
                ? new Date(String(profile.createdAt)).toLocaleString()
                : "—"}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span
              className={`text-xs font-semibold uppercase px-3 py-1 rounded-full ${
                kycStatus === "verified"
                  ? "bg-emerald-100 text-emerald-800"
                  : kycStatus === "submitted"
                    ? "bg-amber-100 text-amber-800"
                    : kycStatus === "rejected"
                      ? "bg-red-100 text-red-800"
                      : "bg-slate-100 text-slate-600"
              }`}
            >
              KYC: {kycStatus}
            </span>
            {showAdminExtras && isAdmin && (
              <div className="flex items-center gap-2">
                <Label className="text-xs text-slate-500">Set status</Label>
                <Select value={kycStatus} onValueChange={saveKycStatus} disabled={saving}>
                  <SelectTrigger className="w-[160px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
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
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <MapPin className="text-cyan-600" size={20} />
          Contact & address
        </h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="pf-name">Full name</Label>
            <Input
              id="pf-name"
              value={form.name}
              disabled={!canEdit}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="pf-mobile">Mobile</Label>
            <Input
              id="pf-mobile"
              value={form.mobile}
              disabled={!canEdit}
              onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="pf-country">Country</Label>
            <Input
              id="pf-country"
              value={form.country}
              disabled={!canEdit}
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="pf-state">State / region</Label>
            <Input
              id="pf-state"
              value={form.state}
              disabled={!canEdit}
              onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="pf-city">City</Label>
            <Input
              id="pf-city"
              value={form.city}
              disabled={!canEdit}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="pf-pin">Pincode</Label>
            <Input
              id="pf-pin"
              value={form.pincode}
              disabled={!canEdit}
              onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))}
              className="mt-1"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="pf-addr">Full address</Label>
          <Input
            id="pf-addr"
            value={form.address}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            className="mt-1"
          />
        </div>
        {canEdit && (
          <Button type="button" onClick={handleSaveDetails} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
            Save details
          </Button>
        )}
      </div>

      {/* KYC */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <Shield className="text-cyan-600" size={20} />
          Identity & proofs
        </h3>

        <DocBlock
          title="Live photo"
          subtitle="Captured at registration; you can replace it here."
          src={liveSrc}
          canUpload={canEdit}
          disabled={saving}
          inputId="live-photo"
          onFile={(f) => uploadDoc("livePhotoBase64", f)}
        />

        <DocBlock
          title="ID proof"
          subtitle="Government ID (image)."
          src={idSrc}
          canUpload={canEdit}
          disabled={saving}
          inputId="id-proof"
          onFile={(f) => uploadDoc("idProofBase64", f)}
        />

        <DocBlock
          title="Address proof"
          subtitle="Utility bill / bank statement (image)."
          src={addrSrc}
          canUpload={canEdit}
          disabled={saving}
          inputId="addr-proof"
          onFile={(f) => uploadDoc("addressProofBase64", f)}
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
  inputId,
  onFile,
}: {
  title: string;
  subtitle: string;
  src: string | null;
  canUpload: boolean;
  disabled: boolean;
  inputId: string;
  onFile: (f: File) => void;
}) {
  return (
    <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <p className="font-medium text-slate-800">{title}</p>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        {canUpload && (
          <div>
            <input
              id={inputId}
              type="file"
              accept="image/*"
              className="hidden"
              disabled={disabled}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={disabled}
              onClick={() => document.getElementById(inputId)?.click()}
            >
              <Upload className="h-4 w-4" />
              Upload / replace
            </Button>
          </div>
        )}
      </div>
      <div className="rounded-lg overflow-hidden bg-slate-200 min-h-[140px] flex items-center justify-center">
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
