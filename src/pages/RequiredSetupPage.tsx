import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  MapPin,
  Camera,
  User,
  CheckCircle2,
  Circle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/AppContext";
import { API_BASE } from "@/config/api";
import { LiveCameraCaptureDialog } from "@/components/profile/LiveCameraCaptureDialog";
import { notifyProfileComplianceRefresh } from "@/utils/profileComplianceEvents";
import {
  isProfileComplianceComplete,
  type ProfileRecord,
} from "@/utils/profileCompliance";

function filled(val: unknown): boolean {
  if (val == null) return false;
  if (typeof val === "string") return val.trim().length > 0;
  return true;
}

function hasLivePhoto(profile: ProfileRecord): boolean {
  const raw = profile.livePhotoData;
  if (raw == null) return false;
  const s = String(raw);
  if (s === "permissions_granted") return false;
  if (s.length < 40) return false;
  if (s.startsWith("data:image")) return true;
  return s.length >= 500;
}

function hasLocation(profile: ProfileRecord): boolean {
  const lat = profile.latitude;
  const lng = profile.longitude;
  if (lat == null || lng == null) return false;
  const la = Number(lat);
  const lo = Number(lng);
  return Number.isFinite(la) && Number.isFinite(lo);
}

const RequiredSetupPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useApp();
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [locBusy, setLocBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  const load = useCallback(async () => {
    const uid = currentUser?.userId;
    if (!uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/user/profile/${uid}`);
      const data = await res.json();
      if (!data?.success || !data.profile) {
        setError("Could not load profile.");
        setProfile(null);
        return;
      }
      setProfile(data.profile as ProfileRecord);
    } catch {
      setError("Network error loading profile.");
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.userId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveLocation = () => {
    const uid = currentUser?.userId;
    if (!uid) return;
    if (!("geolocation" in navigator)) {
      setError("Location is not available in this browser.");
      return;
    }
    setLocBusy(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(`${API_BASE}/user/profile/${uid}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            }),
          });
          const data = await res.json();
          if (!data.success) {
            setError(data.error || "Could not save location.");
          } else {
            notifyProfileComplianceRefresh();
            await load();
          }
        } catch {
          setError("Failed to save location.");
        } finally {
          setLocBusy(false);
        }
      },
      () => {
        setLocBusy(false);
        setError(
          "Location was denied or unavailable. Enable it in browser settings and try again.",
        );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  };

  const uploadLivePhoto = async (dataUrl: string) => {
    const uid = currentUser?.userId;
    if (!uid) return;
    setError("");
    try {
      const res = await fetch(`${API_BASE}/user/profile/${uid}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ livePhotoBase64: dataUrl }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Upload failed.");
        return;
      }
      setCameraOpen(false);
      notifyProfileComplianceRefresh();
      await load();
    } catch {
      setError("Upload failed.");
    }
  };

  if (loading && !profile) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-slate-600">
        <Loader2 className="h-6 w-6 animate-spin" />
        Loading…
      </div>
    );
  }

  const p = profile ?? {};
  const rows = [
    {
      label: "Name, email, mobile, Telegram",
      ok:
        filled(p.name) &&
        filled(p.email) &&
        filled(p.mobile) &&
        filled(p.telegram),
      hint: "Edit on Profile if anything is missing.",
    },
    {
      label: "USDT TRC20 withdrawal address",
      ok: filled(p.trc20WithdrawAddress),
      hint: "Add your payout wallet on Profile.",
    },
    {
      label: "Location permission (saved to profile)",
      ok: hasLocation(p),
      hint: "Use the button below and allow access.",
    },
    {
      label: "Live camera photo (selfie)",
      ok: hasLivePhoto(p),
      hint: "Capture below — camera permission required.",
    },
  ];

  return (
    <div className="mx-auto max-w-xl py-6 sm:py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold text-slate-900">Required setup</h1>
        <p className="mt-2 text-sm text-slate-600">
          With an active package, the following must be completed for compliance. This applies to
          all accounts, including Google sign-in.
        </p>

        {error ? (
          <div className="mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <ul className="mt-8 space-y-4">
          {rows.map((row) => (
            <li
              key={row.label}
              className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3"
            >
              {row.ok ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              ) : (
                <Circle className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" />
              )}
              <div>
                <p className="font-medium text-slate-900">{row.label}</p>
                <p className="text-xs text-slate-500">{row.hint}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={saveLocation}
            disabled={locBusy || hasLocation(p)}
          >
            <MapPin className="mr-2 h-4 w-4" />
            {locBusy ? "Saving…" : hasLocation(p) ? "Location saved" : "Save location"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => setCameraOpen(true)}
            disabled={hasLivePhoto(p)}
          >
            <Camera className="mr-2 h-4 w-4" />
            {hasLivePhoto(p) ? "Live photo OK" : "Capture live photo"}
          </Button>
        </div>

        <Button asChild variant="secondary" className="mt-4 w-full">
          <Link to="/user/profile" className="inline-flex items-center justify-center gap-2">
            <User className="h-4 w-4" />
            Open full profile
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>

        {profile && isProfileComplianceComplete(profile) ? (
          <Button
            type="button"
            className="mt-6 w-full bg-[#FFD700] py-6 text-base font-semibold text-black hover:bg-[#e6c200]"
            onClick={() => {
              notifyProfileComplianceRefresh();
              navigate("/user/dashboard");
            }}
          >
            Continue to dashboard
            <ArrowRight className="ml-2 inline h-5 w-5" />
          </Button>
        ) : null}
      </div>

      <LiveCameraCaptureDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        facingMode="user"
        title="Live selfie"
        description="Allow camera access. Your face should be clearly visible — same requirement as manual signup."
        onCaptured={uploadLivePhoto}
      />
    </div>
  );
};

export default RequiredSetupPage;
